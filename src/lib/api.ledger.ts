/* Ledger / finance / catalogue / dashboard aggregations. Owned by the
 * Ledger/Finance-domain wiring pass — edit only this file for that domain.
 * See apiClient.ts / api.ts.
 *
 * Reconciled against the actual src/mock call sites in this domain's pages
 * (Ledger, BondLadder, Nav, Liquidity, Reconciliation, UnallocatedFunds,
 * Transactions, Distributions, Dashboard) and against apps/core-api's ledger
 * module (LedgerController/FinanceController/DashboardController/
 * TransactionsController, all under ledger/api/), plus CatalogueController.
 *
 * Every JdbcTemplate `Map<String,Object>` row comes back keyed by the raw SQL
 * column name (snake_case) — the mock fixtures/types this domain's pages
 * still render against are camelCase, so every read response is deep-mapped
 * here (`toCamel`), same convention api.compliance.ts already established.
 *
 * NOT everything the pages ask for is built. Genuinely unbuilt functions are
 * left exported here as thin `NotImplemented`-throwing stubs are NOT used —
 * instead their import is simply left pointing at "../mock" at the page
 * call site (see each page's import split) and the gap is reported rather
 * than papered over with an invented computation. See the gap list in the
 * wiring pass's final report for the specific fields/functions and why. */
import { get, post } from "./apiClient";
import {
  INDICATIVE_USD_KES, JOURNAL_EVENT_LABELS,
  type SubFund, type BondPosition, type ReconciliationBreak, type UnallocatedFund, type CouponMonth,
  type ClientLifecycleStatus, type RiskRating, type CaseStatus, type WithholdingPolicy,
  type NavComposition, type FeeAccrual, type FacilityState, type DayCountConvention,
} from "../mock";
// Cross-domain reads only (not edits) — Approvals and Clients are owned by
// the admin/platform and compliance wiring passes respectively. Their own
// files already map CORE's raw rows into the mock-shaped types; reused here
// only to bucket ops-snapshot panels that the ledger endpoint alone can't
// supply (see getOpsSnapshot below), never to re-derive their business logic.
import { getApprovalQueue } from "./api.admin";
import { getClients } from "./api.compliance";

// ---- snake_case (JdbcTemplate rows) -> camelCase (mock-shaped) ----

function toCamelKey(k: string): string {
  return k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function toCamel<T = unknown>(v: unknown): T {
  if (Array.isArray(v)) return v.map((x) => toCamel(x)) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[toCamelKey(k)] = toCamel(val);
    return out as T;
  }
  return v as T;
}

// ==================================================================
// General ledger & fund accounting (Ledger.tsx)
// ==================================================================

/* getChartOfAccounts, getInstitutionAccounts, getContracts, getContractAccruals
 * and getBusinessRules are NOT exported here — see the wiring report's gap
 * list. In short: /api/chart-of-accounts returns only the chart definition
 * (code/name/type/normalBalance/note), not the per-account balance/instance
 * aggregation the AccountsTab renders (that requires enumerating gl_accounts,
 * which has no endpoint) — and there is no institution-accounts, contracts,
 * per-contract-accrual or business-rules endpoint at all. Those five imports
 * stay on "../mock" at the Ledger.tsx call site. */

export type JournalLineDTO = { glAccountId: string; code: string; debit: number; credit: number };
export type JournalEntryDTO = {
  id: string;
  eventType: string;
  eventLabel: string;
  currency: "KES" | "USD";
  contractId: string | null;
  status: "initiated" | "pending_approval" | "posted";
  referenceTxId: string;
  postedAt: string;
  valueDated: string;
  narrative: string;
  lines: JournalLineDTO[];
  amount: number;
  balanced: boolean;
  reversalOfId: string | null;
  reversedById: string | null;
  approvalId: string | null;
};

function toJournalEntry(row: Record<string, unknown>): JournalEntryDTO {
  const camel = toCamel<Record<string, unknown>>(row);
  const lines = (camel.lines as JournalLineDTO[]) ?? [];
  const debits = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const credits = lines.reduce((s, l) => s + (l.credit || 0), 0);
  return {
    ...camel,
    eventLabel: JOURNAL_EVENT_LABELS[camel.eventType as keyof typeof JOURNAL_EVENT_LABELS] ?? (camel.eventType as string),
    amount: lines.reduce((s, l) => s + (l.debit || 0), 0),
    balanced: Math.abs(debits - credits) < 0.005,
  } as JournalEntryDTO;
}

export const getJournalEntries = async (filter?: { status?: string; contractId?: string; currency?: string }): Promise<JournalEntryDTO[]> => {
  const params = new URLSearchParams();
  if (filter?.status) params.set("status", filter.status);
  if (filter?.contractId) params.set("contractId", filter.contractId);
  if (filter?.currency) params.set("currency", filter.currency);
  const qs = params.toString();
  const rows = await get<Record<string, unknown>[]>(`/api/journal-entries${qs ? `?${qs}` : ""}`);
  return rows.map(toJournalEntry);
};

/** Kept under its real name for any future call site; Ledger.tsx keeps
 * calling `postCorrection(entryId, reason, actor)` (see the wrapper below)
 * so the page body needed no rewrite. */
export const reverseJournal = (id: string, reason: string): Promise<JournalEntryDTO> =>
  post<Record<string, unknown>>(`/api/journal-entries/${id}/reverse`, { reason }).then(toJournalEntry);

/** Adapter preserving the mock's `postCorrection(entryId, reason, actor)`
 * signature Ledger.tsx already calls — actor is accepted for call-site
 * compatibility but unused: the real endpoint derives who acted from the
 * session, never a client-supplied name. */
export const postCorrection = (entryId: string, reason: string, _actor?: string): Promise<JournalEntryDTO> =>
  reverseJournal(entryId, reason);

export type UnitLedgerEntryDTO = {
  id: string;
  contractId: string;
  /** Not carried by unit_ledger (no product_id column, and ledger_contracts
   * has no product reference either) — always empty. Flagged gap: the
   * Product column on the Unit ledger tab renders blank against real data. */
  productId: string;
  kind: "issuance" | "cancellation" | "distribution" | "transfer";
  unitsDelta: number;
  navAtEntry: number;
  amount: number;
  occurredAt: string;
  valueDated: string;
  status: "posted" | "pending";
  referenceTxId: string;
  onchainTxHash: string | null;
};

export const getUnitLedger = async (contractId?: string): Promise<UnitLedgerEntryDTO[]> => {
  const rows = await get<Record<string, unknown>[]>(`/api/unit-ledger${contractId ? `?contractId=${contractId}` : ""}`);
  return rows.map((row) => ({ productId: "", onchainTxHash: null, ...toCamel<Record<string, unknown>>(row) }) as UnitLedgerEntryDTO);
};

export type AccrualRunDTO = {
  id: string;
  runDate: string;
  status: "success" | "partial" | "failed";
  contractsProcessed: number;
  contractsSkipped: number;
  totalAccrued: { currency: "KES" | "USD"; amount: number }[];
  startedAt: string;
  finishedAt?: string;
  note?: string;
};

export const getAccrualRuns = (): Promise<AccrualRunDTO[]> =>
  get<Record<string, unknown>[]>("/api/accrual-runs").then((rows) => rows.map((r) => toCamel<AccrualRunDTO>(r)));

export type AccrualRunResult = { id: string; status: string; contractsProcessed: number; contractsSkipped: number };

/** Already camelCase server-side (AccrualService.runBatch builds the
 * response with Map.of(...) directly, not a raw SELECT row), so no mapping
 * needed beyond the call. */
export const runAccrualBatch = (date: string): Promise<AccrualRunResult> => post<AccrualRunResult>("/api/accrual-runs", { date });

/** Adapter preserving the mock's `triggerAccrualRun(runDate, actor)` name/
 * signature Ledger.tsx already calls; actor is unused (see postCorrection). */
export const triggerAccrualRun = (runDate: string, _actor?: string): Promise<AccrualRunResult> => runAccrualBatch(runDate);

export type CloseCheckDTO = {
  currency: "KES" | "USD";
  unitLedgerCost: number;
  generalLedgerPrincipal: number;
  variance: number;
  withinTolerance: boolean;
  marketValue: number;
  accruedInterest: number;
  unrealised: number;
};

export type CloseRunDTO = {
  id: string;
  date: string;
  status: "closed" | "blocked";
  checks: CloseCheckDTO[];
  unbalancedJournals: string[];
  pendingApprovalJournals: string[];
  runAt: string;
  closedBy?: string | null;
  blockedReason?: string | null;
};

/** close_runs.close_date -> `date` (not `closeDate`) is the one field toCamel
 * can't get right by itself — everything else on the row already matches the
 * mock's DayEndClose shape once snake_case is converted. */
function toCloseRun(row: Record<string, unknown>): CloseRunDTO {
  const camel = toCamel<Record<string, unknown> & { closeDate: string }>(row);
  const { closeDate, ...rest } = camel;
  return { ...rest, date: closeDate } as CloseRunDTO;
}

export const getCloseRuns = (): Promise<CloseRunDTO[]> =>
  get<Record<string, unknown>[]>("/api/close-runs").then((rows) => rows.map(toCloseRun));

export const runDayEndClose = (date: string): Promise<CloseRunDTO> =>
  post<Record<string, unknown>>("/api/close-runs", { date }).then(toCloseRun);

/** Adapter preserving the mock's `runClose(date, actor)` name/signature
 * Ledger.tsx already calls; actor is unused (see postCorrection). */
export const runClose = (date: string, _actor?: string): Promise<CloseRunDTO> => runDayEndClose(date);

// ==================================================================
// NAV / bond ladder / liquidity (BondLadder.tsx, Nav.tsx, Liquidity.tsx)
// ==================================================================

/** Built from positions, cash, accrued income and accrued expenses — see
 * NavService.navComposition. Response keys are already camelCase (the
 * controller builds the map by hand, not off a raw SELECT row), so toCamel
 * is a no-op safety net rather than load-bearing here. */
export const getNavComposition = (subFund: string): Promise<NavComposition> =>
  get<Record<string, unknown>>(`/api/nav/composition/${subFund}`).then((r) => toCamel<NavComposition>(r));

export const getNavHistory = (subFund: string, days = 90): Promise<{ date: string; nav: number }[]> =>
  get<Record<string, unknown>[]>(`/api/nav/history/${subFund}?days=${days}`).then((rows) =>
    rows.map((r) => toCamel<{ date: string; nav: number }>(r)),
  );

export const getFeeAccrual = (subFund: string): Promise<FeeAccrual> =>
  get<Record<string, unknown>>(`/api/fee-accrual/${subFund}`).then((r) => toCamel<FeeAccrual>(r));

/** sub_funds row -> mock's SubFund shape. Real fields: code, name, currency,
 * nav, navAsOf, aum, liquidityFacility, liquidityUsed. NOT computed
 * server-side yet: minInvestment, ytdReturn, sevenDayYield, launchDate,
 * whtSettingKey, gateActive — defaulted below ONLY to satisfy the shared
 * `SubFund` type these pages still import from src/mock; none of those
 * five are rendered by any page in this domain slice except `gateActive`
 * (Liquidity.tsx, Dashboard.tsx), which defaults to `false` — the safe
 * direction to be wrong in, per this repo's own convention — since the gate
 * state isn't computed server-side yet either. Flagged gap. */
function toSubFund(row: Record<string, unknown>): SubFund {
  const camel = toCamel<Record<string, unknown>>(row);
  return {
    minInvestment: 0,
    ytdReturn: 0,
    sevenDayYield: 0,
    launchDate: "",
    whtSettingKey: "",
    gateActive: false,
    ...camel,
  } as unknown as SubFund;
}

export const getSubFunds = (): Promise<SubFund[]> => get<Record<string, unknown>[]>("/api/nav/sub-funds").then((rows) => rows.map(toSubFund));
export const getSubFund = (code: string): Promise<SubFund> => get<Record<string, unknown>>(`/api/nav/sub-funds/${code}`).then(toSubFund);

/** bond_ladder row -> mock's BondPosition shape: `label` -> `name`.
 * `couponRate` is stored server-side as a percentage (14.25 for 14.25%,
 * matching bond_ladder.coupon_rate and how the coupon-calendar endpoint
 * already divides it by 100 itself) but the mock — and BondLadder.tsx's
 * `(r.couponRate * 100).toFixed(2)` — treats it as a fraction (0.1425), so
 * it's divided by 100 here to match. `couponDates` is not stored (only
 * maturity + a flat coupon rate) and defaults to `[]` — unused by
 * BondLadder.tsx, which reads couponRate and maturity directly, never
 * couponDates. */
function toBondPosition(row: Record<string, unknown>): BondPosition {
  const camel = toCamel<Record<string, unknown> & { label: string; couponRate: number }>(row);
  const { label, couponRate, ...rest } = camel;
  return { couponDates: [], ...rest, name: label, couponRate: couponRate / 100 } as unknown as BondPosition;
}

export const getBondLadder = (subFund?: string): Promise<BondPosition[]> =>
  get<Record<string, unknown>[]>(`/api/bond-ladder${subFund ? `?subFund=${subFund}` : ""}`).then((rows) => rows.map(toBondPosition));

/** Full liquidity-facility state — drawn amount, headroom, facility rate,
 * interest accrued (read live off the GL's 3100 account, not cached),
 * scaling covenant and the gate threshold. Genuinely richer than a re-return
 * of the sub-fund row (that gap is closed — see NavService.facilityState).
 * `/api/liquidity` (plural sub-fund list) is untouched below; it still just
 * lists sub_funds and stays that way, only used where a fund's own AUM/NAV
 * fields are wanted alongside the facility state, not instead of it. */
export const getFacilityState = (subFund: string): Promise<FacilityState> =>
  get<Record<string, unknown>>(`/api/liquidity/facility/${subFund}`).then((r) => toCamel<FacilityState>(r));

// ==================================================================
// Reconciliation / Unallocated funds (Reconciliation.tsx, UnallocatedFunds.tsx)
// ==================================================================

export const getReconciliationBreaks = (): Promise<ReconciliationBreak[]> =>
  get<Record<string, unknown>[]>("/api/reconciliation").then((rows) => rows.map((r) => toCamel<ReconciliationBreak>(r)));

/** FinanceController.resolveBreak returns the WHOLE updated list (Spring
 * convenience, not a single-row response) — Reconciliation.tsx expects the
 * one break it just resolved back, so that row is picked out here rather
 * than changing the page's `updated.id` merge logic. */
export const resolveReconciliationBreak = async (id: string): Promise<ReconciliationBreak> => {
  const rows = await post<Record<string, unknown>[]>(`/api/reconciliation/${id}/resolve`);
  const camel = rows.map((r) => toCamel<ReconciliationBreak>(r));
  const match = camel.find((r) => r.id === id);
  if (!match) throw new Error(`Break ${id} not found in the response`);
  return match;
};

export const getUnallocatedFunds = (): Promise<UnallocatedFund[]> =>
  get<Record<string, unknown>[]>("/api/unallocated-funds").then((rows) => rows.map((r) => toCamel<UnallocatedFund>(r)));

/** Same whole-list-response shape as resolveReconciliationBreak above. */
export const matchUnallocatedFund = async (id: string): Promise<UnallocatedFund> => {
  const rows = await post<Record<string, unknown>[]>(`/api/unallocated-funds/${id}/match`);
  const camel = rows.map((r) => toCamel<UnallocatedFund>(r));
  const match = camel.find((r) => r.id === id);
  if (!match) throw new Error(`Receipt ${id} not found in the response`);
  return match;
};

// ==================================================================
// Transactions / distributions
// ==================================================================

/* /api/transactions is a raw unit_ledger dump (kind: issuance/cancellation/
 * distribution/transfer, status: posted/pending) joined to contract/client —
 * not exactly the retail "Transaction" domain object Transactions.tsx
 * renders (type: subscription/redemption/distribution/fee, status: settled/
 * processing/pending/gated/failed, plus `channel`, `counterparty`,
 * `riskScore` and `settledAt`), but the V11 migration closed the channel gap:
 * unit_ledger now carries a real `channel` column (mpesa/bank_transfer/
 * system), populated at write time — no longer fabricated.
 *
 * Still genuinely absent, and deliberately NOT sourced (see V11's own
 * migration comment): `counterparty` (RULE-INV-071 — personal identity must
 * never touch the ledger) and `riskScore` (no fraud/risk-scoring engine
 * exists to derive one from). Verified against both call sites — neither
 * Transactions.tsx nor Screening.tsx renders `counterparty`/`riskScore`
 * without an optional guard, so leaving them `undefined` here matches what
 * both pages already do for a missing value; not a gap that needs fixing.
 * `settledAt` also stays undefined: unit_ledger has no settlement-timestamp
 * column (occurred_at is a single write-time timestamp), and both pages
 * already guard it as optional.
 *
 * What's real here: id, reference (= referenceTxId), createdAt (=
 * occurredAt), subFund, amount, units, channel, and status (posted/pending
 * mapped to settled/pending — the ledger has no processing/gated/failed
 * state to report). `type` is a best-effort relabelling of the real `kind`
 * column (issuance/cancellation/distribution/transfer -> subscription/
 * redemption/distribution/fee) — a real field reinterpreted under the
 * vocabulary the page expects, not an invented one.
 *
 * Also imported by Screening.tsx (compliance domain), which force-casts the
 * result (`as Promise<Transaction[]>`) — untouched by this change. */
export type TransactionDTO = {
  id: string;
  reference: string;
  createdAt: string;
  type: string;
  subFund: string;
  amount: number;
  status: string;
  units?: number;
  channel: "mpesa" | "bank_transfer" | "system";
  counterparty?: string;
  riskScore?: number;
  settledAt?: string;
};

const LEDGER_KIND_TO_TX_TYPE: Record<string, string> = {
  issuance: "subscription", cancellation: "redemption", distribution: "distribution", transfer: "fee",
};
const LEDGER_STATUS_TO_TX_STATUS: Record<string, string> = { posted: "settled", pending: "pending" };

export const getTransactions = (): Promise<TransactionDTO[]> =>
  get<Record<string, unknown>[]>("/api/transactions").then((rows) =>
    rows.map((row) => {
      const c = toCamel<{
        id: string; referenceTxId: string; occurredAt: string; kind: string; subFund: string;
        amount: number; status: string; unitsDelta: number; channel: "mpesa" | "bank_transfer" | "system";
      }>(row);
      return {
        id: c.id,
        reference: c.referenceTxId ?? c.id,
        createdAt: c.occurredAt,
        type: LEDGER_KIND_TO_TX_TYPE[c.kind] ?? c.kind,
        subFund: c.subFund,
        amount: c.amount,
        status: LEDGER_STATUS_TO_TX_STATUS[c.status] ?? c.status,
        units: c.unitsDelta,
        channel: c.channel,
      };
    }),
  );

/** Already camelCase server-side (the controller builds this by hand with
 * Map.of, not a raw SELECT row) — passed through as-is. */
export const getWithholdingPolicy = (subFund: string) => get<WithholdingPolicy>(`/api/withholding-policy/${subFund}`);

// ==================================================================
// Catalogue (Catalogue.tsx)
// ==================================================================

/* The V11 migration + CatalogueService rework closed the tariff-chain gap:
 * institution -> service-package -> product now resolves through a real
 * tariff_domains/tariff_types chain with effective-dated rows, not a flat
 * one-row-per-product table. Contract-level overrides stay unmodelled (the
 * data spec's own §5 note — no override table exists on the live system
 * either), which is why TariffsTab's own copy already says so; nothing to
 * add here for that.
 *
 * Own DTOs are declared below rather than reusing the mock's `ProductRow`/
 * `TariffValue`/etc. — those mock types carry configuration-authoring fields
 * (institutionId, structureType, assetClass, tariffId lookups, ...) that
 * exist as literal fixture data but have no equivalent column server-side.
 * These types instead describe exactly what CatalogueController returns,
 * which happens to be exactly what Catalogue.tsx's tabs render (verified
 * field-by-field against ProductsTab/PackagesTab/TariffsTab/TemplatesTab/
 * TokenizationTab below) — Catalogue.tsx's `ProductRow` import moves to the
 * page-local derived type the other four tabs already use. */

export type CatalogueProduct = {
  id: string;
  name: string;
  subFund: string;
  distributionClass: "income" | "growth";
  parentProductId: string | null;
  currency: "KES" | "USD";
  unitsOutstanding: number;
  managementFeePct: number | null;
  couponRatePct: number | null;
  dayCount: DayCountConvention | null;
  packageName: string;
  contractCount: number;
  capacity: { capacityUnits: number; issuedUnits: number; withinCapacity: boolean };
};

/** Already camelCase server-side (CatalogueService builds every row by hand
 * with LinkedHashMap.put(...), not a raw SELECT row) — no toCamel needed. */
export const getProducts = (): Promise<CatalogueProduct[]> => get<CatalogueProduct[]>("/api/products");

export type ServicePackageItemDTO = {
  id: string;
  label: string;
  note: string | null;
  transactionTypeLabel: string | null;
  feeTypeLabel: string | null;
  tariff: { id: string; value: number } | null;
};

export type ServicePackageDTO = {
  id: string;
  name: string;
  description: string | null;
  minSubscription: number;
  packageType: "product" | "additional";
  currency: "KES" | "USD";
  tariffDomainId: string | null;
  distributionFrequency: string;
  items: ServicePackageItemDTO[];
};

/** Top-level package fields come straight off a raw SELECT row (snake_case);
 * each item was already built camelCase by hand, so toCamel's recursion into
 * `items` is a harmless no-op there. */
export const getServicePackages = (): Promise<ServicePackageDTO[]> =>
  get<Record<string, unknown>[]>("/api/service-packages").then((rows) => rows.map((r) => toCamel<ServicePackageDTO>(r)));

export type TariffState = "in_force" | "scheduled" | "awaiting_approval" | "expired";

export type TariffDTO = {
  id: string;
  type: string;
  domainId: string;
  currency: "KES" | "USD";
  value: number;
  dayCount: DayCountConvention | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  approved: boolean;
  pendingApprovalId: string | null;
  typeRole: string;
  domainName: string;
  domainScope: string;
  state: TariffState;
  /** No `note` column exists on the real `tariffs` table (V7's original
   * shape) — always undefined server-side. TariffsTab already renders this
   * optionally ("—" fallback), so this is a real, visible-but-honest gap,
   * not a broken column. Flagged, not silently populated. */
  note?: string;
};

export const getTariffs = (): Promise<TariffDTO[]> =>
  get<Record<string, unknown>[]>("/api/tariffs").then((rows) => rows.map((r) => toCamel<TariffDTO>(r)));

export type AccountTemplateDTO = {
  schemeId: string;
  role: string;
  code: string;
  accountName: string;
  scope: "per_contract" | "per_institution";
  isAvailableBalance: boolean;
  instantiated: number;
};

/** Already camelCase server-side, same reason as getProducts above. */
export const getAccountTemplates = (): Promise<AccountTemplateDTO[]> => get<AccountTemplateDTO[]>("/api/account-templates");

export type TokenizationReadinessDTO = { level: "product" | "investor" | "settlement"; what: string; column: string; populated: number; total: number };

/** Reworked to the hook-population shape (data spec §10) Catalogue.tsx's
 * TokenizationTab renders — not the separate, unused `tokenization_readiness`
 * checklist table. Already camelCase server-side. */
export const getTokenizationReadiness = (): Promise<TokenizationReadinessDTO[]> => get<TokenizationReadinessDTO[]>("/api/tokenization-readiness");

/** Adapter preserving the mock's `proposeTariffChange(tariffTypeId, domainId,
 * currency, value, effectiveFrom, proposedBy, reason)` signature Catalogue.tsx
 * already calls; `proposedBy` is accepted for call-site compatibility but
 * unused — the real endpoint derives who proposed it from the session (see
 * postCorrection above for the same pattern). */
export const proposeTariffChange = (
  tariffTypeId: string, domainId: string, currency: "KES" | "USD",
  value: number, effectiveFrom: string, _proposedBy: string, reason: string,
): Promise<TariffDTO> =>
  post<Record<string, unknown>>("/api/tariffs/propose", { tariffTypeId, domainId, currency, value, effectiveFrom, reason })
    .then((r) => toCamel<TariffDTO>(r));

// ==================================================================
// Dashboard
// ==================================================================

export type DailyFlowDTO = { date: string; subscriptions: number; redemptions: number; tickets: number };

/** SQL aliases already produce `date`/`subscriptions`/`redemptions` with no
 * underscores. Two real gaps folded in rather than left broken:
 *  - `tickets` (count of settled inbound payments) isn't computed by the
 *    aggregation at all — counted here from /api/transactions (unit_ledger
 *    `issuance` rows, capped at the same 500-row window that endpoint
 *    returns) grouped by value date, a real count rather than a guess. On
 *    a history longer than 500 rows this undercounts older days; fine for
 *    this seeded dataset, flagged for a real deployment.
 *  - subscriptions/redemptions are summed across BOTH sub-funds' raw
 *    amounts with no FX conversion (unlike the mock, which converts USD to
 *    its KES-equivalent first) — a backend query detail outside this file's
 *    scope (DashboardController.java), flagged rather than silently
 *    "corrected" by guessing an FX rate client-side. */
export const getFundFlows = async (days = 30): Promise<DailyFlowDTO[]> => {
  const [flows, txRows] = await Promise.all([
    get<{ date: string; subscriptions: number; redemptions: number }[]>(`/api/dashboard/fund-flows?days=${days}`),
    get<Record<string, unknown>[]>("/api/transactions").then((rows) => rows.map((r) => toCamel<{ kind: string; valueDated: string }>(r))),
  ]);
  const ticketsByDate = new Map<string, number>();
  for (const tx of txRows) {
    if (tx.kind !== "issuance") continue;
    ticketsByDate.set(tx.valueDated, (ticketsByDate.get(tx.valueDated) ?? 0) + 1);
  }
  return flows.map((f) => ({ ...f, tickets: ticketsByDate.get(f.date) ?? 0 }));
};

export type AumPointDTO = { month: string; kes: number; usd: number };

/** Built with Map.of(...) directly, but one row per (month, subFund) with a
 * single `aum` in that fund's own currency — the mock's shape is one row per
 * month with kes/usd already summed across both funds. Pivoted here (using
 * getSubFunds for the subFund -> currency map) rather than changing what
 * BondLadder.tsx/Dashboard.tsx read off each point. */
export const getAumTrend = async (months = 12): Promise<AumPointDTO[]> => {
  const [rows, funds] = await Promise.all([
    get<{ month: string; subFund: string; aum: number }[]>(`/api/dashboard/aum-trend?months=${months}`),
    getSubFunds(),
  ]);
  const currencyByCode = new Map<string, string>(funds.map((f) => [f.code as string, f.currency]));
  const byMonth = new Map<string, AumPointDTO>();
  for (const r of rows) {
    const point = byMonth.get(r.month) ?? { month: r.month, kes: 0, usd: 0 };
    if (currencyByCode.get(r.subFund) === "USD") point.usd += r.aum; else point.kes += r.aum;
    byMonth.set(r.month, point);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
};

/** Built with Map.of(...) directly — already camelCase, except `bonds`
 * (which bond(s) pay that month) isn't tracked at all: the aggregation only
 * sums kes/usd, so it defaults to `[]` here to stop BondLadder.tsx's and
 * Dashboard.tsx's `m.bonds.join(...)` from throwing on a missing array.
 * Flagged gap: the coupon-calendar chart's tooltip table shows a blank
 * "Bonds paying" column against real data. */
export const getCouponCalendar = (months = 12): Promise<CouponMonth[]> =>
  get<{ month: string; kes: number; usd: number }[]>(`/api/dashboard/coupon-calendar?months=${months}`)
    .then((rows) => rows.map((r) => ({ bonds: [] as string[], ...r })));

export type OpsSnapshotDTO = {
  lifecycle: { status: ClientLifecycleStatus; count: number }[];
  riskMix: { rating: RiskRating; count: number }[];
  cases: { status: CaseStatus; count: number }[];
  alerts: { severity: RiskRating; count: number }[];
  approvalAgeing: { bucket: string; count: number }[];
  newClientsByMonth: { month: string; count: number }[];
  oldestApprovalDays: number;
  openBreaks: number;
  unallocatedCount: number;
  unresolvedScreeningMatches: number;
  /** Not returned by /api/dashboard/ops-snapshot (it only counts unmatched
   * receipts, never sums their value) — computed here from the real
   * unallocated-funds register with the same formula the mock used
   * (unmatched only, USD converted at the same indicative rate), rather than
   * left as a fabricated number or a silent zero. */
  unallocatedValueKes: number;
};

const AGE_BUCKETS: { bucket: string; test: (days: number) => boolean }[] = [
  { bucket: "Today", test: (d) => d < 1 },
  { bucket: "1–2d", test: (d) => d >= 1 && d < 3 },
  { bucket: "3–7d", test: (d) => d >= 3 && d < 8 },
  { bucket: "8+d", test: (d) => d >= 8 },
];

/** Adapter preserving the mock's `getOpsSnapshot(role)` signature
 * Dashboard.tsx already calls; role is unused — the real endpoint scopes by
 * the session's own RBAC permissions (`@rbac.has('dashboard:read')`), not a
 * client-supplied role string, so a caller without a given page's permission
 * already gets a 403 on the underlying query rather than a client-side
 * filter. lifecycle/riskMix/cases/alerts come back keyed generically as
 * `key` (one SQL alias reused across four different GROUP BY queries) —
 * renamed here to the field name each panel actually reads
 * (status/rating/status/severity). approvalAgeing and newClientsByMonth
 * aren't computed by the endpoint at all (it only reduces pending-approval
 * ages to a single `oldest`) — both are real, bucketed from the same
 * approvals/clients data the Approvals and Clients pages already render
 * (cross-domain reads only, via their own already-wired functions; not
 * re-implementing their business logic, just aggregating their output). */
export const getOpsSnapshot = async (_role?: string): Promise<OpsSnapshotDTO> => {
  const [rawSnapshot, unallocated, approvals, clients] = await Promise.all([
    get<{
      lifecycle: { key: ClientLifecycleStatus; count: number }[];
      riskMix: { key: RiskRating; count: number }[];
      cases: { key: CaseStatus; count: number }[];
      alerts: { key: RiskRating; count: number }[];
      oldestApprovalDays: number;
      openBreaks: number;
      unallocatedCount: number;
      unresolvedScreeningMatches: number;
    }>("/api/dashboard/ops-snapshot"),
    // Most roles (everyone but operations/system_admin) lack
    // unallocated_funds:read and get a 403 here — same graceful fallback as
    // the approvals/clients reads right below, so one restricted domain
    // doesn't fail the whole Promise.all and blank the rest of the Ops
    // snapshot (lifecycle/risk/cases/alerts) for every other role's Dashboard.
    get<Record<string, unknown>[]>("/api/unallocated-funds")
      .then((rows) => rows.map((r) => toCamel<UnallocatedFund>(r)))
      .catch(() => [] as UnallocatedFund[]),
    getApprovalQueue().catch(() => [] as { status: string; proposedAt: string }[]),
    getClients().catch(() => [] as { joinedAt?: string }[]),
  ]);

  const unallocatedValueKes = unallocated
    .filter((u) => u.status !== "matched")
    .reduce((sum, u) => sum + (u.currency === "USD" ? u.amount * INDICATIVE_USD_KES : u.amount), 0);

  const now = Date.now();
  const ages = approvals
    .filter((a) => a.status === "pending")
    .map((a) => (now - new Date(a.proposedAt).getTime()) / 86_400_000);
  const approvalAgeing = AGE_BUCKETS.map((b) => ({ bucket: b.bucket, count: ages.filter(b.test).length }));

  const monthCounts = new Map<string, { month: string; count: number; sortKey: string }>();
  for (const c of clients) {
    if (!c.joinedAt) continue;
    const at = new Date(c.joinedAt);
    const sortKey = `${at.getFullYear()}-${String(at.getMonth()).padStart(2, "0")}`;
    const row = monthCounts.get(sortKey) ?? { month: at.toLocaleDateString("en-GB", { month: "short" }), count: 0, sortKey };
    row.count += 1;
    monthCounts.set(sortKey, row);
  }
  const newClientsByMonth = [...monthCounts.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(-6).map(({ month, count }) => ({ month, count }));

  return {
    lifecycle: rawSnapshot.lifecycle.map((r) => ({ status: r.key, count: r.count })),
    riskMix: rawSnapshot.riskMix.map((r) => ({ rating: r.key, count: r.count })),
    cases: rawSnapshot.cases.map((r) => ({ status: r.key, count: r.count })),
    alerts: rawSnapshot.alerts.map((r) => ({ severity: r.key, count: r.count })),
    approvalAgeing,
    newClientsByMonth,
    oldestApprovalDays: rawSnapshot.oldestApprovalDays,
    openBreaks: rawSnapshot.openBreaks,
    unallocatedCount: rawSnapshot.unallocatedCount,
    unresolvedScreeningMatches: rawSnapshot.unresolvedScreeningMatches,
    unallocatedValueKes,
  };
};
