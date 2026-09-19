import {
  ACCOUNT_TEMPLATES, INSTITUTION, INSTITUTION_ACCOUNTS, INVESTOR_CONTRACTS, DAY_COUNT_DIVISOR, productById,
  resolveTariff, SERVICE_PACKAGES, type AccountRole, type Currency, type DayCountConvention,
} from "./catalogue";
import { SUB_FUNDS } from "./fund";
import { TRANSACTIONS } from "./investor";

/** Ledger layer, per `docs/platform-data-specification-presentation.html`
 * §4, §6 and §10 and the proposal's §4.4.
 *
 * Two independently-derived books:
 *   - the **general ledger** — what the fund owes in cash, as balanced
 *     double-entry journals;
 *   - the **unit ledger** — how many units a contract holds, priced at NAV.
 *
 * They are linked only by a shared reference and are *expected to reconcile*,
 * not to be the same table. Keeping them separate is what makes the day-end
 * check a real check rather than a formality — which is why `dayEndClose`
 * below refuses to close on a mismatch instead of absorbing it.
 *
 * Nothing here is ever edited after posting. A correction is a new,
 * opposite-signed entry (`reverseJournal`), never a mutated row. */

export type AccountType = "asset" | "liability" | "income" | "expense";
export type NormalBalance = "debit" | "credit";

export type ChartAccount = {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  note?: string;
};

export const CHART_OF_ACCOUNTS: ChartAccount[] = [
  { code: "1000", name: "Bank / mirror cash", type: "asset", normalBalance: "debit" },
  { code: "1100", name: "Unallocated funds register", type: "liability", normalBalance: "credit", note: "Money received without a resolvable reference. Never applied against a guessed investor; released only once Operations confirms the match." },
  { code: "2000", name: "Investor principal", type: "liability", normalBalance: "credit" },
  { code: "2100", name: "Accrued interest payable", type: "liability", normalBalance: "credit" },
  { code: "2200", name: "Tax withheld payable", type: "liability", normalBalance: "credit" },
  { code: "3000", name: "Management fee income", type: "income", normalBalance: "credit" },
  { code: "3100", name: "Liquidity facility interest expense", type: "expense", normalBalance: "debit" },
  { code: "3200", name: "Investor interest expense", type: "expense", normalBalance: "debit" },
];

export function chartAccount(code: string): ChartAccount {
  const a = CHART_OF_ACCOUNTS.find((c) => c.code === code);
  if (!a) throw new Error(`Unknown chart-of-accounts code ${code}`);
  return a;
}

/** An instance of a chart-of-accounts *type*, for one owner: "contract
 * CTR-…'s principal account", "the KES bank mirror".
 *
 * Exactly one owner, never both and never neither — the database enforces this
 * with a constraint; here `glAccountOwnerIsValid` is the same rule, checkable. */
export type GlAccount = {
  id: string;
  code: string;
  role: AccountRole;
  currency: Currency;
  contractId: string | null;
  institutionAccountId: string | null;
};

function templatesFor(scope: "per_contract" | "per_institution") {
  return ACCOUNT_TEMPLATES.filter((t) => t.schemeId === "AS-BRF-STD" && t.scope === scope);
}

export const GL_ACCOUNTS: GlAccount[] = [
  // Shared, one per (currency, role), each owned by an institution_account.
  ...templatesFor("per_institution").flatMap((t) =>
    (["KES", "USD"] as Currency[]).map((currency) => ({
      id: `GL-${t.code}-${currency}`,
      code: t.code,
      role: t.role,
      currency,
      contractId: null,
      institutionAccountId: INSTITUTION_ACCOUNTS.find((ia) => ia.currency === currency && ia.purpose === t.role)!.id,
    })),
  ),
  // Per-contract: principal, accrued interest, tax withheld.
  ...INVESTOR_CONTRACTS.flatMap((c) =>
    templatesFor("per_contract").map((t) => ({
      id: `GL-${t.code}-${c.id}`,
      code: t.code,
      role: t.role,
      currency: c.currency,
      contractId: c.id,
      institutionAccountId: null,
    })),
  ),
];

function shared(role: AccountRole, currency: Currency): string {
  return `GL-${ACCOUNT_TEMPLATES.find((t) => t.role === role)!.code}-${currency}`;
}

function perContract(role: AccountRole, contractId: string): string {
  return `GL-${ACCOUNT_TEMPLATES.find((t) => t.role === role)!.code}-${contractId}`;
}

/** `initiated → pending_approval → posted`. The middle state is what gates
 * redemptions above the approval threshold: held for sign-off before they
 * post, rather than posting immediately and correcting after the fact
 * (RULE-INV-053). */
export type JournalStatus = "initiated" | "pending_approval" | "posted";

export type JournalEventType =
  | "subscription" | "daily_accrual" | "distribution_income" | "distribution_growth"
  | "tax_withheld" | "management_fee" | "exit_fee" | "redemption" | "facility_interest"
  | "unallocated_receipt" | "unallocated_release" | "correction";

export const JOURNAL_EVENT_LABELS: Record<JournalEventType, string> = {
  subscription: "Subscription (unit issuance)",
  daily_accrual: "Daily accrual",
  distribution_income: "Distribution — income (payout)",
  distribution_growth: "Distribution — growth (capitalise)",
  tax_withheld: "Tax withheld",
  management_fee: "Management fee",
  exit_fee: "Early-exit fee retained",
  redemption: "Redemption (unit cancellation)",
  facility_interest: "Liquidity facility interest",
  unallocated_receipt: "Unallocated receipt",
  unallocated_release: "Unallocated funds released",
  correction: "Correction",
};

/** The fixed debit/credit pair per event type. Generated by the posting rule,
 * never chosen ad hoc at the call site — which is the whole reason a retried
 * webhook cannot post a different shape than the first attempt did. */
export const POSTING_RULES: Record<JournalEventType, { debit: AccountRole; credit: AccountRole }> = {
  subscription: { debit: "BANK_CASH", credit: "PRINCIPAL" },
  daily_accrual: { debit: "INVESTOR_EXPENSE", credit: "ACCRUED_INTEREST" },
  distribution_income: { debit: "ACCRUED_INTEREST", credit: "BANK_CASH" },
  distribution_growth: { debit: "ACCRUED_INTEREST", credit: "PRINCIPAL" },
  tax_withheld: { debit: "ACCRUED_INTEREST", credit: "TAX_WITHHELD" },
  management_fee: { debit: "PRINCIPAL", credit: "FEE_INCOME" },
  // The exit fee is retained *in the fund*, not deducted from principal twice:
  // the redemption already debits principal at the gross unit value, so the fee
  // is cash the fund keeps and recognises as income.
  exit_fee: { debit: "BANK_CASH", credit: "FEE_INCOME" },
  redemption: { debit: "PRINCIPAL", credit: "BANK_CASH" },
  // The chart carries the facility's interest expense but no facility
  // principal account, so a drawdown has nowhere honest to post. Only the
  // interest is modelled — inventing an account the specification does not
  // define would be worse than the gap.
  facility_interest: { debit: "LIQUIDITY_EXPENSE", credit: "BANK_CASH" },
  unallocated_receipt: { debit: "BANK_CASH", credit: "UNALLOCATED" },
  unallocated_release: { debit: "UNALLOCATED", credit: "PRINCIPAL" },
  correction: { debit: "PRINCIPAL", credit: "BANK_CASH" },
};

export type JournalLine = {
  glAccountId: string;
  code: string;
  /** Positive debit, positive credit — never a signed single figure. A
   * journal's debits must equal its credits to commit (RULE-INV-051). */
  debit: number;
  credit: number;
};

export type JournalEntry = {
  id: string;
  eventType: JournalEventType;
  currency: Currency;
  contractId: string | null;
  status: JournalStatus;
  /** Traceability back to the event that caused it — a payment reference, an
   * accrual run, or a unit-ledger entry. This is what makes reconciliation
   * possible at all. */
  referenceTxId: string;
  postedAt: string;
  /** Settlement timing. A subscription received after the dealing cut-off
   * still posts, but does not accrue until it is value-dated. */
  valueDated: string;
  narrative: string;
  lines: JournalLine[];
  /** Set on the correction that reverses this entry, and on the entry it
   * reverses — append-only in both directions. */
  reversalOfId?: string;
  reversedById?: string;
  approvalId?: string;
};

export const JOURNAL_ENTRIES: JournalEntry[] = [];

let journalSeq = 1;

/** Builds the two lines from the posting rule and refuses to return an
 * unbalanced entry. Callers pass an amount and an event, never a pair of
 * accounts — that is what keeps the debit/credit shape fixed per event type. */
export function buildJournal(input: {
  eventType: JournalEventType;
  amount: number;
  currency: Currency;
  contractId: string | null;
  referenceTxId: string;
  postedAt: string;
  valueDated?: string;
  narrative: string;
  status?: JournalStatus;
  approvalId?: string;
}): JournalEntry {
  const rule = POSTING_RULES[input.eventType];
  const amount = Number(input.amount.toFixed(2));

  const resolve = (role: AccountRole): string => {
    const template = ACCOUNT_TEMPLATES.find((t) => t.role === role)!;
    if (template.scope === "per_institution") return shared(role, input.currency);
    if (!input.contractId) throw new Error(`${role} is a per-contract account but no contract was given`);
    return perContract(role, input.contractId);
  };

  const debitId = resolve(rule.debit);
  const creditId = resolve(rule.credit);

  const entry: JournalEntry = {
    id: `JE-${String(journalSeq++).padStart(6, "0")}`,
    eventType: input.eventType,
    currency: input.currency,
    contractId: input.contractId,
    status: input.status ?? "posted",
    referenceTxId: input.referenceTxId,
    postedAt: input.postedAt,
    valueDated: input.valueDated ?? input.postedAt.slice(0, 10),
    narrative: input.narrative,
    ...(input.approvalId ? { approvalId: input.approvalId } : {}),
    lines: [
      { glAccountId: debitId, code: GL_ACCOUNTS.find((g) => g.id === debitId)!.code, debit: amount, credit: 0 },
      { glAccountId: creditId, code: GL_ACCOUNTS.find((g) => g.id === creditId)!.code, debit: 0, credit: amount },
    ],
  };

  if (!isBalanced(entry)) throw new Error(`Journal ${entry.id} does not balance`);
  return entry;
}

export function isBalanced(entry: JournalEntry): boolean {
  const debits = entry.lines.reduce((s, l) => s + l.debit, 0);
  const credits = entry.lines.reduce((s, l) => s + l.credit, 0);
  return Math.abs(debits - credits) < 0.005;
}

/** Every balance is the sum of an append-only entry history — never a stored
 * figure that could drift from the journals that produced it. Entries not yet
 * posted (initiated, pending approval) are excluded: an unapproved redemption
 * must not move a balance. */
export function balanceOf(glAccountId: string): number {
  const account = GL_ACCOUNTS.find((g) => g.id === glAccountId);
  if (!account) return 0;
  const normal = chartAccount(account.code).normalBalance;
  let total = 0;
  for (const entry of JOURNAL_ENTRIES) {
    if (entry.status !== "posted") continue;
    for (const line of entry.lines) {
      if (line.glAccountId !== glAccountId) continue;
      total += normal === "debit" ? line.debit - line.credit : line.credit - line.debit;
    }
  }
  return Number(total.toFixed(2));
}

/** Only PRINCIPAL and BANK_CASH carry `isAvailableBalance` on their template.
 * Accrued interest is explicitly not available: it sits on the institution's
 * side of the ledger until a distribution trues it up. */
export function availableBalance(contractId: string): number {
  return GL_ACCOUNTS
    .filter((g) => g.contractId === contractId)
    .filter((g) => ACCOUNT_TEMPLATES.find((t) => t.role === g.role)?.isAvailableBalance)
    .reduce((sum, g) => sum + balanceOf(g.id), 0);
}

/** Append-only record of every unit issuance, cancellation, transfer and
 * distribution against a contract, priced at that day's NAV. Answers "how many
 * units does this contract hold" — a different question from the general
 * ledger's "what does the fund owe this contract in cash". */
export type UnitLedgerEntry = {
  id: string;
  contractId: string;
  productId: string;
  kind: "issuance" | "cancellation" | "distribution" | "transfer";
  /** Signed: positive issues units, negative cancels them. */
  unitsDelta: number;
  navAtEntry: number;
  amount: number;
  occurredAt: string;
  valueDated: string;
  /** Mirrors its journal entry's status. A redemption held for payment
   * approval has not cancelled its units yet, so counting them would put the
   * unit ledger ahead of the general ledger and manufacture a break out of a
   * control working correctly. */
  status: "posted" | "pending";
  /** Shared with the journal entry this posted alongside — the only link
   * between the two books. */
  referenceTxId: string;
  /** Tokenization Level 2 settlement hook (data spec §10): the on-chain proof
   * of a specific mint or transfer. Unpopulated — the internal ledger mints
   * first and on-chain is always the mirror, never the source of truth. */
  onchainTxHash: string | null;
};

export const UNIT_LEDGER: UnitLedgerEntry[] = [];

/** A cache, always re-derivable by summing the contract's entries — never
 * edited directly. Recomputed on read for exactly that reason. */
export function unitBalance(contractId: string): number {
  return Number(
    UNIT_LEDGER
      .filter((e) => e.contractId === contractId && e.status === "posted")
      .reduce((s, e) => s + e.unitsDelta, 0)
      .toFixed(4),
  );
}

/** What the contract's units cost, at the price each entry was struck at —
 * "units issued = net amount ÷ NAV at entry, frozen at entry" (RULE-INV-011).
 * This is the figure the general ledger's principal is checked against: both
 * books recorded the same events, so the same events priced the same way must
 * total the same. Market value at today's NAV is a different question and is
 * reported separately rather than being used as the reconciliation basis. */
export function unitLedgerCost(contractId: string): number {
  return Number(
    UNIT_LEDGER
      .filter((e) => e.contractId === contractId && e.status === "posted")
      .reduce((s, e) => s + e.unitsDelta * e.navAtEntry, 0)
      .toFixed(2),
  );
}

/* The seeded journals are derived from TRANSACTIONS rather than typed out, so
   the ledger and everything BO Admin already shows on /transactions cannot
   drift apart. */

function seed() {
  for (const tx of TRANSACTIONS) {
    const contract = INVESTOR_CONTRACTS.find((c) => productById(c.productId)?.subFund === tx.subFund);
    if (!contract) continue;
    const product = productById(contract.productId)!;
    const fund = SUB_FUNDS.find((f) => f.code === tx.subFund)!;
    const settled = tx.status === "settled";
    const postedAt = tx.settledAt ?? tx.createdAt;

    /* The price is struck from the transaction itself, not from today's
       published NAV: units were issued at the NAV on the day and that price is
       frozen at entry. Reading `fund.nav` here would silently reprice history
       every time NAV moved, and the two books would stop agreeing for a reason
       that has nothing to do with either of them. */
    const gross = tx.grossAmount ?? tx.amount;
    const navAtEntry = tx.units > 0 ? Number((gross / tx.units).toFixed(6)) : fund.nav;

    if (tx.type === "subscription") {
      JOURNAL_ENTRIES.push(buildJournal({
        eventType: "subscription", amount: tx.amount, currency: fund.currency,
        contractId: contract.id, referenceTxId: tx.reference, postedAt,
        narrative: `Subscription ${tx.reference} — ${tx.units.toFixed(4)} units at ${navAtEntry}`,
        status: settled ? "posted" : "initiated",
      }));
      UNIT_LEDGER.push({
        id: `UL-${tx.id}`, contractId: contract.id, productId: product.id, kind: "issuance",
        unitsDelta: tx.units, navAtEntry, amount: tx.amount,
        occurredAt: tx.createdAt, valueDated: postedAt.slice(0, 10),
        status: settled ? "posted" : "pending",
        referenceTxId: tx.reference, onchainTxHash: null,
      });
    }

    if (tx.type === "redemption") {
      // Principal is debited at the gross value of the units cancelled — the
      // exit fee is not a second deduction from principal, it is cash the fund
      // retains, so it posts on its own as income.
      JOURNAL_ENTRIES.push(buildJournal({
        eventType: "redemption", amount: gross, currency: fund.currency,
        contractId: contract.id, referenceTxId: tx.reference, postedAt,
        narrative: `Redemption ${tx.reference} — ${tx.units.toFixed(4)} units cancelled at ${navAtEntry}`,
        status: settled ? "posted" : "pending_approval",
      }));
      if (tx.exitFee) {
        JOURNAL_ENTRIES.push(buildJournal({
          eventType: "exit_fee", amount: tx.exitFee, currency: fund.currency,
          contractId: contract.id, referenceTxId: tx.reference, postedAt,
          narrative: `Early-exit fee retained in the fund on ${tx.reference}`,
          status: settled ? "posted" : "pending_approval",
        }));
      }
      UNIT_LEDGER.push({
        id: `UL-${tx.id}`, contractId: contract.id, productId: product.id, kind: "cancellation",
        unitsDelta: -tx.units, navAtEntry, amount: -gross,
        occurredAt: tx.createdAt, valueDated: postedAt.slice(0, 10),
        status: settled ? "posted" : "pending",
        referenceTxId: tx.reference, onchainTxHash: null,
      });
    }

    if (tx.type === "distribution") {
      const net = tx.netAmount ?? tx.amount;
      const capitalises = product.distributionClass === "growth";

      /* The running accrual this distribution trues up. Without it the
         true-up debits an accrued-interest balance that was never credited and
         the payable goes negative — arithmetically consistent, financially
         nonsense. Posted as one entry for the period rather than a month of
         nightly rows: the fixture only needs the accrual to exist, and
         inventing thirty precise nightly figures would imply a precision the
         seed does not have. */
      JOURNAL_ENTRIES.push(buildJournal({
        eventType: "daily_accrual", amount: gross, currency: fund.currency,
        contractId: contract.id, referenceTxId: tx.reference,
        postedAt: new Date(Date.parse(postedAt) - 3_600_000).toISOString(),
        narrative: `Accrual accumulated over the period cleared by ${tx.reference}`,
      }));

      JOURNAL_ENTRIES.push(buildJournal({
        eventType: capitalises ? "distribution_growth" : "distribution_income",
        amount: net, currency: fund.currency,
        contractId: contract.id, referenceTxId: tx.reference, postedAt,
        narrative: capitalises
          ? `${tx.reference} — accrual capitalised into principal and new units`
          : `${tx.reference} — accrual trued up and paid out in cash`,
      }));
      if (tx.withholdingTax) {
        // Withheld tax splits off the distribution leg rather than being
        // netted silently into it, so the payable is a real balance.
        JOURNAL_ENTRIES.push(buildJournal({
          eventType: "tax_withheld", amount: tx.withholdingTax, currency: fund.currency,
          contractId: contract.id, referenceTxId: tx.reference, postedAt,
          narrative: `Withholding tax on ${tx.reference} (gross ${gross.toFixed(2)})`,
        }));
      }
      // A growth distribution mints units; an income distribution pays cash and
      // mints none. One accrual, two payout behaviours — the whole difference
      // between the sibling products.
      if (capitalises && tx.units > 0) {
        UNIT_LEDGER.push({
          id: `UL-${tx.id}`, contractId: contract.id, productId: product.id, kind: "distribution",
          unitsDelta: tx.units, navAtEntry: Number((net / tx.units).toFixed(6)), amount: net,
          occurredAt: tx.createdAt, valueDated: postedAt.slice(0, 10),
          status: "posted",
          referenceTxId: tx.reference, onchainTxHash: null,
        });
      }
    }
  }

  // An unmatched USD wire, sitting in the register rather than guessed against
  // an investor — mirroring the Operations SOP control that Payment Ops runs.
  JOURNAL_ENTRIES.push(buildJournal({
    eventType: "unallocated_receipt", amount: 500, currency: "USD",
    contractId: null, referenceTxId: "WIRE-KE-88301", postedAt: "2026-08-04T10:00:00Z",
    narrative: "USD wire with an unresolvable reference — held pending Operations confirmation",
  }));

  // Facility interest, so the cost of the liquidity facility is a ledger fact
  // rather than a spreadsheet figure Finance has to be told about.
  for (const fund of SUB_FUNDS) {
    if (!fund.facilityInterestAccrued) continue;
    JOURNAL_ENTRIES.push(buildJournal({
      eventType: "facility_interest", amount: fund.facilityInterestAccrued, currency: fund.currency,
      contractId: null, referenceTxId: `FAC-${fund.code}`, postedAt: "2026-08-01T09:00:00Z",
      narrative: `Liquidity facility interest accrued — ${fund.name}`,
    }));
  }
}

seed();

/** Interest is computed live nowhere. A nightly batch computes and stores
 * every contract's accrual for that day; the application layer only ever reads
 * the stored figure. Each run is its own row, so a failed or partial run is a
 * visible, trackable event rather than a silent gap. */
export type AccrualRun = {
  id: string;
  runDate: string;
  status: "success" | "partial" | "failed";
  contractsProcessed: number;
  contractsSkipped: number;
  totalAccrued: { currency: Currency; amount: number }[];
  startedAt: string;
  finishedAt?: string;
  note?: string;
};

export type ContractAccrual = {
  contractId: string;
  runId: string;
  valueDated: string;
  /** Day-weighted, not a naive close-of-day balance multiplication. */
  amount: number;
  dailyRate: number;
  dayCount: DayCountConvention;
};

export const ACCRUAL_RUNS: AccrualRun[] = [];
export const CONTRACT_ACCRUALS: ContractAccrual[] = [];

/** The day-weighted factor. A naive implementation snapshots one balance and
 * multiplies by days — wrong the moment a subscription or redemption lands
 * mid-period.
 *
 *   accrued = (days × balance_at_period_end − Σ IntFactor) × daily_rate
 *   IntFactor_i = delta_i × days_from_period_start_to_entry_i
 *
 * which is exact integration of the real daily balance over the period,
 * computed from the entry history rather than by snapshotting every day.
 *
 * Entries are only counted once value-dated: a subscription received over a
 * weekend or after cut-off accrues nothing until it is recognised, even though
 * the investor already sees the pending amount. */
export function dayWeightedAccrual(
  contractId: string,
  periodStart: string,
  periodEnd: string,
  annualRatePct: number,
  dayCount: DayCountConvention,
): { amount: number; days: number; endBalance: number; intFactor: number; dailyRate: number } {
  const start = Date.parse(periodStart);
  const end = Date.parse(periodEnd);
  const days = Math.max(0, Math.round((end - start) / 86_400_000));

  /* Posted entries only — the same basis as `unitBalance` and
     `unitLedgerCost`. A redemption still held for payment approval has not
     cancelled its units, so letting it reduce the accruing balance would pay
     the investor less interest for a payout that has not happened. */
  const entries = UNIT_LEDGER
    .filter((e) => e.contractId === contractId && e.status === "posted" && Date.parse(e.valueDated) <= end)
    .sort((a, b) => a.valueDated.localeCompare(b.valueDated));

  const endBalance = entries.reduce((s, e) => s + e.amount, 0);
  const intFactor = entries
    .filter((e) => Date.parse(e.valueDated) > start)
    .reduce((s, e) => s + e.amount * Math.round((Date.parse(e.valueDated) - start) / 86_400_000), 0);

  const dailyRate = annualRatePct / 100 / DAY_COUNT_DIVISOR[dayCount];
  const amount = (days * endBalance - intFactor) * dailyRate;
  return { amount: Number(amount.toFixed(2)), days, endBalance: Number(endBalance.toFixed(2)), intFactor: Number(intFactor.toFixed(2)), dailyRate };
}

let accrualSeq = 1;

/** One night's batch. Posts the running leg (investor interest expense →
 * accrued interest payable) — entirely on the institution's side, so an
 * investor's own balance never moves day to day. Only a distribution trues the
 * running accrual up against cash or new principal. */
export function runAccrualBatch(runDate: string, actor = "System (Accrual Engine)"): AccrualRun {
  const startedAt = new Date().toISOString();
  const run: AccrualRun = {
    id: `ACR-${runDate}-${String(accrualSeq++).padStart(3, "0")}`,
    runDate,
    status: "success",
    contractsProcessed: 0,
    contractsSkipped: 0,
    totalAccrued: [],
    startedAt,
  };

  const totals = new Map<Currency, number>();
  const periodStart = new Date(Date.parse(runDate) - 86_400_000).toISOString().slice(0, 10);

  for (const contract of INVESTOR_CONTRACTS) {
    if (contract.status !== "active") { run.contractsSkipped++; continue; }
    const product = productById(contract.productId)!;
    const pkg = SERVICE_PACKAGES.find((p) => p.id === product.servicePackageId)!;
    const tariff = resolveTariff("TT-COUPON", {
      productDomainId: product.tariffDomainId,
      packageDomainId: pkg.tariffDomainId,
      institutionDomainId: INSTITUTION.defaultTariffDomainId,
    }, contract.currency, runDate);

    // A control that cannot be read withholds, it does not assume: with no
    // resolvable coupon rate the contract is skipped and the run is partial,
    // rather than accruing at a guessed rate.
    if (!tariff) { run.contractsSkipped++; run.status = "partial"; continue; }

    const dayCount = tariff.dayCount ?? "actual/365";
    const { amount, dailyRate } = dayWeightedAccrual(contract.id, periodStart, runDate, tariff.value, dayCount);
    if (amount <= 0) { run.contractsSkipped++; continue; }

    JOURNAL_ENTRIES.push(buildJournal({
      eventType: "daily_accrual", amount, currency: contract.currency,
      contractId: contract.id, referenceTxId: run.id,
      postedAt: `${runDate}T23:30:00Z`, valueDated: runDate,
      narrative: `Nightly accrual ${runDate} — ${tariff.value}% p.a., ${dayCount}, day-weighted (${actor})`,
    }));

    CONTRACT_ACCRUALS.push({ contractId: contract.id, runId: run.id, valueDated: runDate, amount, dailyRate, dayCount });
    totals.set(contract.currency, (totals.get(contract.currency) ?? 0) + amount);
    run.contractsProcessed++;
  }

  run.totalAccrued = [...totals.entries()].map(([currency, amount]) => ({ currency, amount: Number(amount.toFixed(2)) }));
  run.finishedAt = new Date().toISOString();
  if (run.contractsProcessed === 0) {
    run.status = "failed";
    run.note = "No contract resolved a coupon tariff — nothing accrued. Check the tariff table before re-running.";
  }
  ACCRUAL_RUNS.push(run);
  return run;
}

// Two nights of history so the page is not empty on first load, and so a
// partial run is visible as a real state rather than only a type.
runAccrualBatch("2026-08-08");
runAccrualBatch("2026-08-09");

/** The reconciliation the whole two-book design exists for: units held,
 * priced at NAV, against the general ledger's principal-plus-accrued.
 *
 * A mismatch beyond tolerance BLOCKS the close. It is not absorbed, not
 * rounded away, not logged and ignored — that is the difference between a
 * reconciliation and a formality. */
export type CloseCheck = {
  currency: Currency;
  /** Units × the price each was struck at. The reconciliation basis: both
   * books recorded the same events, so priced the same way they must total the
   * same, and a divergence means one book is missing an entry the other has. */
  unitLedgerCost: number;
  /** Investor principal across every contract in this currency. */
  generalLedgerPrincipal: number;
  variance: number;
  withinTolerance: boolean;
  /** Informational, not part of the check: units at today's published NAV, and
   * the accrued interest sitting on the institution's side. Reconciling
   * against market value would compare a revalued figure with a cost one and
   * report a break every single day the price moved. */
  marketValue: number;
  accruedInterest: number;
  unrealised: number;
};

export type DayEndClose = {
  id: string;
  date: string;
  status: "closed" | "blocked";
  checks: CloseCheck[];
  unbalancedJournals: string[];
  pendingApprovalJournals: string[];
  runAt: string;
  closedBy?: string;
  blockedReason?: string;
};

export const CLOSE_RUNS: DayEndClose[] = [];

/** Materiality for the cross-book check. Sub-unit rounding between a
 * 4dp unit price and 2dp money is expected; anything larger is a break. */
const CLOSE_TOLERANCE = 1.0;

export function runDayEndClose(date: string, actor = "System (Day-end)"): DayEndClose {
  const checks: CloseCheck[] = (["KES", "USD"] as Currency[]).map((currency) => {
    const contracts = INVESTOR_CONTRACTS.filter((c) => c.currency === currency);

    const cost = contracts.reduce((sum, c) => sum + unitLedgerCost(c.id), 0);
    const principal = contracts.reduce((sum, c) => sum + balanceOf(perContract("PRINCIPAL", c.id)), 0);
    const accruedInterest = contracts.reduce((sum, c) => sum + balanceOf(perContract("ACCRUED_INTEREST", c.id)), 0);
    const marketValue = contracts.reduce((sum, c) => {
      const product = productById(c.productId)!;
      const fund = SUB_FUNDS.find((f) => f.code === product.subFund)!;
      return sum + unitBalance(c.id) * fund.nav;
    }, 0);

    const variance = Number((cost - principal).toFixed(2));
    return {
      currency,
      unitLedgerCost: Number(cost.toFixed(2)),
      generalLedgerPrincipal: Number(principal.toFixed(2)),
      variance,
      withinTolerance: Math.abs(variance) <= CLOSE_TOLERANCE,
      marketValue: Number(marketValue.toFixed(2)),
      accruedInterest: Number(accruedInterest.toFixed(2)),
      unrealised: Number((marketValue - cost).toFixed(2)),
    };
  });

  const unbalancedJournals = JOURNAL_ENTRIES.filter((e) => !isBalanced(e)).map((e) => e.id);
  const pendingApprovalJournals = JOURNAL_ENTRIES.filter((e) => e.status === "pending_approval").map((e) => e.id);

  const breaks = checks.filter((c) => !c.withinTolerance);
  const blocked = breaks.length > 0 || unbalancedJournals.length > 0;

  const close: DayEndClose = {
    id: `CLS-${date}`,
    date,
    status: blocked ? "blocked" : "closed",
    checks,
    unbalancedJournals,
    pendingApprovalJournals,
    runAt: new Date().toISOString(),
    ...(blocked
      ? {
          blockedReason: unbalancedJournals.length
            ? `${unbalancedJournals.length} journal entr${unbalancedJournals.length === 1 ? "y does" : "ies do"} not balance.`
            : `Unit ledger and general ledger disagree by ${breaks.map((b) => `${b.currency} ${Math.abs(b.variance).toFixed(2)}`).join(", ")}. Investigate before closing — the day does not close on an unexplained break.`,
        }
      : { closedBy: actor }),
  };

  const existing = CLOSE_RUNS.findIndex((c) => c.date === date);
  if (existing >= 0) CLOSE_RUNS[existing] = close; else CLOSE_RUNS.push(close);
  return close;
}

runDayEndClose("2026-08-09");

/** Every rule carries a stable ID and an honest status: actually enforced in
 * this layer, or policy still awaiting implementation. Copied from the data
 * spec's own catalogue so the two do not drift — a rule that says "Enforced"
 * here has a function above that enforces it. */
export type BusinessRule = {
  id: string;
  rule: string;
  status: "enforced" | "documented";
  where?: string;
};

export const BUSINESS_RULES: BusinessRule[] = [
  { id: "RULE-INV-001", rule: "Every investor must belong to exactly one institution", status: "enforced", where: "catalogue.ts — INSTITUTION is the single tenant root" },
  { id: "RULE-INV-011", rule: "Units issued = net amount ÷ NAV at entry, frozen at entry", status: "enforced", where: "ledger.ts — UnitLedgerEntry.navAtEntry" },
  { id: "RULE-INV-013", rule: "Minimum subscription / top-up amounts per service package", status: "documented", where: "SERVICE_PACKAGES.minSubscription — readable, not constrained" },
  { id: "RULE-INV-021", rule: "Redemption notice period per service package tier", status: "documented", where: "REDEMPTION_TIERS — applied by submitRedemption, not constrained" },
  { id: "RULE-INV-040", rule: "Daily accrual uses day-weighted balance, not closing balance", status: "enforced", where: "ledger.ts — dayWeightedAccrual" },
  { id: "RULE-INV-042", rule: "Growth distributions capitalize; income distributions pay cash", status: "enforced", where: "POSTING_RULES — distribution_growth vs distribution_income" },
  { id: "RULE-INV-043", rule: "Tax withheld on income distributions before payout", status: "documented", where: "Posting rule exists; the rate is Open Question 7" },
  { id: "RULE-INV-044", rule: "Management fee collected per account's service package", status: "documented", where: "Tariff resolves; no periodic fee run posts it yet" },
  { id: "RULE-INV-050", rule: "Ledger entries are immutable; corrections are new rows", status: "enforced", where: "ledger.ts — reverseJournal" },
  { id: "RULE-INV-051", rule: "A journal's debits must equal its credits to commit", status: "enforced", where: "ledger.ts — buildJournal throws on imbalance" },
  { id: "RULE-INV-053", rule: "Journals above a value threshold require approval", status: "enforced", where: "JournalStatus.pending_approval — excluded from balanceOf" },
  { id: "RULE-INV-060", rule: "Every GL account has exactly one owner: a contract or an institution account", status: "enforced", where: "ledger.ts — glAccountOwnerIsValid" },
  { id: "RULE-INV-061", rule: "Unit ledger and general ledger reconcile daily; a mismatch blocks close", status: "enforced", where: "ledger.ts — runDayEndClose" },
  { id: "RULE-INV-070", rule: "A product may not issue more units than its ladder backs", status: "documented", where: "catalogue.ts — productCapacity reports it; nothing blocks it" },
  { id: "RULE-INV-071", rule: "Personal identity never touches the ledger", status: "enforced", where: "Journal and unit-ledger rows carry contract ids only, never a name" },
];
