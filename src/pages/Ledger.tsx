import { useState } from "react";
import {
  getChartOfAccounts, getContractAccruals,
  getBusinessRules, getInstitutionAccounts, getContracts,
  DAY_COUNT_LABELS,
} from "../mock";
import {
  getJournalEntries, getUnitLedger, getAccrualRuns,
  getCloseRuns,
  postCorrection, triggerAccrualRun, runClose,
} from "../lib/api";
import {
  PageHeader, Card, Badge, DataTable, Tabs, Skeleton, Button, Modal, Field, Input,
  Money, StatCard, EmptyState, useToast, formatDate, formatDateTime, formatUnits,
  type Column, type TabDef,
} from "../ui";
import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { useAuth, ADMIN_USERS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";

/** The ledger layer: two independently-derived books that are expected to
 * reconcile, not to be the same table. Everything here is append-only —
 * there is no edit affordance anywhere on this page by design, only
 * "post a correction", which writes a new opposite-signed entry. */
export default function Ledger() {
  const [tab, setTab] = useState("close");
  const tabs: TabDef[] = [
    { key: "close", label: "Day-end close" },
    { key: "journals", label: "Journal entries" },
    { key: "accounts", label: "Chart of accounts" },
    { key: "units", label: "Unit ledger" },
    { key: "accrual", label: "Accrual runs" },
    { key: "rules", label: "Business rules" },
  ];

  return (
    <div>
      <PageHeader
        title="General ledger & fund accounting"
        tooltip="Double-entry means every movement posts as a balanced pair: one account debited, another credited, always summing to zero. The unit ledger tracks how many units a contract holds; the general ledger tracks what the fund owes it in cash. They are checked against each other every day."
        subtitle="Append-only. No balance is ever edited — every balance is the sum of its entry history, and a correction is a new, opposite-signed entry."
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-5" />
      {tab === "close" && <CloseTab />}
      {tab === "journals" && <JournalsTab />}
      {tab === "accounts" && <AccountsTab />}
      {tab === "units" && <UnitsTab />}
      {tab === "accrual" && <AccrualTab />}
      {tab === "rules" && <RulesTab />}
    </div>
  );
}

// ---- Day-end close ----

function CloseTab() {
  const { role } = useAuth();
  const toast = useToast();
  const { data: closes, loading, reload } = useAsyncData(getCloseRuns);
  const [busy, setBusy] = useState(false);
  const me = role ? ADMIN_USERS[role].name : "";
  const canClose = role === "head_of_finance" || role === "operations" || role === "system_admin";

  const latest = closes?.[0];

  const rerun = async () => {
    if (!latest) return;
    setBusy(true);
    try {
      const result = await runClose(latest.date, me);
      toast.push(
        result.status === "closed" ? "Day closed — both books agree." : "Close blocked — the books disagree.",
        result.status === "closed" ? "success" : "error",
      );
      reload();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not run the close", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Skeleton className="h-64" />;
  if (!latest) return <EmptyState title="No close has been run" body="Run the day-end check to reconcile the unit ledger against the general ledger." />;

  return (
    <div className="flex flex-col gap-5">
      <Card className={`p-5 border-l-4 ${latest.status === "blocked" ? "border-l-danger" : "border-l-success"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {latest.status === "blocked"
              ? <AlertTriangle size={20} className="text-danger mt-0.5 shrink-0" />
              : <CheckCircle2 size={20} className="text-success mt-0.5 shrink-0" />}
            <div>
              <div className="text-sm font-semibold text-text">
                {formatDate(latest.date)} — {latest.status === "blocked" ? "Close blocked" : "Closed"}
              </div>
              <div className="text-[13px] text-text-soft mt-1 max-w-2xl">
                {latest.blockedReason ?? `Signed off by ${latest.closedBy}. Unit ledger and general ledger agree within tolerance.`}
              </div>
            </div>
          </div>
          {canClose && <Button onClick={rerun} disabled={busy}>{busy ? "Running…" : "Re-run the check"}</Button>}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {latest.checks.map((c) => (
          <Card key={c.currency} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-text">{c.currency} books</span>
              <Badge tone={c.withinTolerance ? "success" : "danger"}>
                {c.withinTolerance ? "Reconciled" : "Break"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-xs text-text-faint mb-1">Unit ledger, at entry price</div>
                <div className="text-lg font-semibold tabular text-text"><Money amount={c.unitLedgerCost} currency={c.currency} /></div>
              </div>
              <div>
                <div className="text-xs text-text-faint mb-1">General ledger — investor principal</div>
                <div className="text-lg font-semibold tabular text-text"><Money amount={c.generalLedgerPrincipal} currency={c.currency} /></div>
              </div>
            </div>
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-text-faint">Variance</span>
              <span className={`text-sm font-semibold tabular ${c.withinTolerance ? "text-text-soft" : "text-danger"}`}>
                <Money amount={c.variance} currency={c.currency} signed />
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-text-faint mb-0.5">At today&rsquo;s NAV</div>
                <div className="tabular text-text-soft"><Money amount={c.marketValue} currency={c.currency} compact /></div>
              </div>
              <div>
                <div className="text-text-faint mb-0.5">Unrealised</div>
                <div className="tabular text-text-soft"><Money amount={c.unrealised} currency={c.currency} compact signed /></div>
              </div>
              <div>
                <div className="text-text-faint mb-0.5">Accrued interest</div>
                <div className="tabular text-text-soft"><Money amount={c.accruedInterest} currency={c.currency} compact /></div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-text-faint leading-relaxed">
              The check runs on entry price, not market value — comparing a revalued figure against a cost one would
              report a break every day the NAV moved. These three are context, not the test.
            </p>
          </Card>
        ))}
      </div>

      {latest.pendingApprovalJournals.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Lock size={16} className="text-warning" />
            <span className="text-sm font-semibold text-text">Held for approval</span>
          </div>
          <p className="text-[13px] text-text-soft max-w-3xl">
            {latest.pendingApprovalJournals.length} journal{latest.pendingApprovalJournals.length === 1 ? "" : "s"} sit
            at <span className="tabular">pending_approval</span> and are excluded from every balance on this page.
            A redemption above the release threshold is held for sign-off before it posts, rather than posting
            immediately and being corrected after the fact.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {latest.pendingApprovalJournals.map((id) => (
              <span key={id} className="tabular text-xs px-2 py-1 rounded bg-surface-sunken text-text-soft border border-border">{id}</span>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="text-sm font-semibold text-text mb-2">Why a mismatch blocks the day</div>
        <p className="text-[13px] text-text-soft leading-relaxed max-w-3xl">
          The two books answer different questions under different rules — units price at NAV and can be fractional;
          money settles in whole currency units and must satisfy double-entry balance. Keeping them independently
          derived, linked only by a shared reference, is what makes this a real check rather than a formality. A break
          that could be absorbed silently would make the reconciliation worthless.
        </p>
      </Card>

      <Card className="p-1">
        <DataTable
          columns={[
            { key: "date", header: "Date", render: (r) => <span className="tabular">{formatDate(r.date)}</span> },
            { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "closed" ? "success" : "danger"}>{r.status}</Badge> },
            { key: "by", header: "Closed by", render: (r) => r.closedBy ?? <span className="text-text-faint">—</span>, hideOnMobile: true },
            { key: "reason", header: "Detail", render: (r) => <span className="text-xs text-text-soft">{r.blockedReason ?? "Both books agree."}</span>, hideOnMobile: true },
            { key: "at", header: "Run at", render: (r) => <span className="tabular text-xs">{formatDateTime(r.runAt)}</span>, hideOnMobile: true, defaultHidden: true },
          ]}
          rows={closes ?? []}
          newest={(r) => r.date}
        />
      </Card>
    </div>
  );
}

// ---- Journals ----

type JournalRow = Awaited<ReturnType<typeof getJournalEntries>>[number];

const JOURNAL_STATUS_TONE = {
  posted: "success",
  pending_approval: "warning",
  initiated: "info",
} as const;

function JournalsTab() {
  const { role } = useAuth();
  const toast = useToast();
  const { data: entries, loading, reload } = useAsyncData(getJournalEntries);
  const [correcting, setCorrecting] = useState<JournalRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const me = role ? ADMIN_USERS[role].name : "";
  const canCorrect = role === "head_of_finance" || role === "system_admin";

  const submit = async () => {
    if (!correcting) return;
    setBusy(true);
    try {
      await postCorrection(correcting.id, reason, me);
      toast.push("Correction posted as a new opposite-signed entry — the original is untouched.", "success");
      setCorrecting(null);
      setReason("");
      reload();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not post the correction", "error");
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<JournalRow>[] = [
    { key: "id", header: "Entry", render: (r) => (
      <div>
        <div className="tabular text-text font-medium">{r.id}</div>
        <div className="text-xs text-text-faint">{r.eventLabel}</div>
      </div>
    ) },
    { key: "lines", header: "Posting", render: (r) => (
      <div className="flex flex-col gap-0.5 text-xs">
        {r.lines.map((l, i) => (
          <span key={i} className="tabular text-text-soft">
            {l.debit > 0 ? "Dr" : "Cr"} {l.code} <span className="text-text">{(l.debit || l.credit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </span>
        ))}
      </div>
    ), hideOnMobile: true },
    { key: "amount", header: "Amount", render: (r) => <Money amount={r.amount} currency={r.currency} /> },
    { key: "contract", header: "Contract", render: (r) => r.contractId
      ? <span className="tabular text-xs text-text-soft">{r.contractId}</span>
      : <span className="text-text-faint text-xs">institution</span>, hideOnMobile: true },
    { key: "ref", header: "Reference", render: (r) => <span className="tabular text-xs">{r.referenceTxId}</span>, hideOnMobile: true },
    { key: "valueDated", header: "Value date", render: (r) => <span className="tabular text-xs">{formatDate(r.valueDated)}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "status", header: "Status", render: (r) => (
      <div className="flex flex-col gap-1 items-start">
        <Badge tone={JOURNAL_STATUS_TONE[r.status]}>{r.status.replace("_", " ")}</Badge>
        {!r.balanced && <Badge tone="danger">unbalanced</Badge>}
      </div>
    ) },
    { key: "posted", header: "Posted", render: (r) => <span className="tabular text-xs">{formatDateTime(r.postedAt)}</span>, hideOnMobile: true },
    { key: "action", header: "", render: (r) => canCorrect && r.status === "posted" && !r.reversedById && !r.reversalOfId
      ? <Button variant="ghost" onClick={() => setCorrecting(r)}>Correct</Button>
      : r.reversalOfId
        ? <span className="text-xs text-text-faint">reverses {r.reversalOfId}</span>
        : r.reversedById
          ? <span className="text-xs text-text-faint">reversed by {r.reversedById}</span>
          : null },
  ];

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4 text-[13px] text-text-soft leading-relaxed">
        The debit/credit pair is fixed per event type and generated by the posting rule, never chosen at the call site —
        which is what stops a retried request or a duplicate webhook from posting a different shape than the first
        attempt did. Entries below <span className="tabular">posted</span> are excluded from every balance.
      </Card>
      <Card className="p-1"><DataTable newest={(r) => r.postedAt} columns={columns} rows={entries ?? []} columnPicker /></Card>

      <Modal open={!!correcting} onClose={() => setCorrecting(null)} title={`Post a correction to ${correcting?.id ?? ""}`}>
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-text-soft">
            This does not edit {correcting?.id}. It posts a new entry with the opposite sign and links the two, so both
            the original and the correction stay readable — which is the only way a past balance stays reconstructable.
          </p>
          <Field label="Reason" hint="The only record of why the original was wrong.">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. duplicate settlement callback" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCorrecting(null)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !reason.trim()}>{busy ? "Posting…" : "Post correction"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---- Chart of accounts ----

function AccountsTab() {
  const { data: coa, loading } = useAsyncData(getChartOfAccounts);
  const { data: institutionAccounts } = useAsyncData(getInstitutionAccounts);
  const { data: contracts } = useAsyncData(() => getContracts());

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-1">
        <DataTable
          columns={[
            { key: "code", header: "Code", render: (r) => <span className="tabular text-text font-medium">{r.code}</span> },
            { key: "name", header: "Account", render: (r) => (
              <div>
                <div className="text-text">{r.name}</div>
                {r.note && <div className="text-xs text-text-faint mt-0.5 max-w-md">{r.note}</div>}
              </div>
            ) },
            { key: "type", header: "Type", render: (r) => <Badge tone="neutral">{r.type}</Badge>, hideOnMobile: true },
            { key: "normal", header: "Normal balance", render: (r) => <span className="text-text-soft capitalize">{r.normalBalance}</span>, hideOnMobile: true },
            { key: "instances", header: "Instances", render: (r) => <span className="tabular">{r.instances}</span>, hideOnMobile: true },
            { key: "kes", header: "KES balance", render: (r) => <Money amount={r.balanceKes} currency="KES" /> },
            { key: "usd", header: "USD balance", render: (r) => <Money amount={r.balanceUsd} currency="USD" />, hideOnMobile: true },
          ]}
          rows={(coa ?? []).map((r) => ({ ...r, id: r.code }))}
          columnPicker
        />
      </Card>

      <div>
        <div className="text-sm font-semibold text-text mb-1">Institution accounts</div>
        <p className="text-[13px] text-text-soft mb-3 max-w-3xl">
          Not every ledger position belongs to a contract. These are the institution's own — one row per
          (institution, currency, purpose), so no GL account is an unowned bucket and every one has exactly one owner.
        </p>
        <Card className="p-1">
          <DataTable
            columns={[
              { key: "id", header: "Account", render: (r) => <span className="tabular text-text">{r.id}</span> },
              { key: "label", header: "Purpose", render: (r) => <span className="text-text-soft">{r.label}</span> },
              { key: "currency", header: "Ccy", render: (r) => <span className="tabular">{r.currency}</span> },
              { key: "gl", header: "GL account", render: (r) => <span className="tabular text-xs text-text-faint">{r.glAccountId ?? "—"}</span>, hideOnMobile: true },
              { key: "balance", header: "Balance", render: (r) => <Money amount={r.balance} currency={r.currency} /> },
            ]}
            rows={institutionAccounts ?? []}
          />
        </Card>
      </div>

      <div>
        <div className="text-sm font-semibold text-text mb-1">Contracts</div>
        <p className="text-[13px] text-text-soft mb-3 max-w-3xl">
          The contract is the wallet — there is no separate wallet object. Currency is fixed at the contract from its
          product, which is what lets one investor identity hold a KES and a USD position without onboarding twice.
        </p>
        <Card className="p-1">
          <DataTable
            columns={[
              { key: "id", header: "Contract", render: (r) => <span className="tabular text-text">{r.id}</span> },
              { key: "product", header: "Product", render: (r) => (
                <div>
                  <div className="text-text-soft">{r.productName}</div>
                  <div className="text-xs text-text-faint">{r.distributionClass}</div>
                </div>
              ) },
              { key: "client", header: "Client", render: (r) => <span className="tabular text-xs">{r.clientId}</span>, hideOnMobile: true },
              { key: "units", header: "Units", render: (r) => <span className="tabular">{formatUnits(r.units)}</span> },
              { key: "available", header: "Available balance", render: (r) => <Money amount={r.availableBalance} currency={r.currency} />, hideOnMobile: true },
              { key: "address", header: "On-chain address", render: (r) => r.address
                ? <span className="tabular text-xs">{r.address}</span>
                : <span className="text-text-faint text-xs">dormant hook</span>, hideOnMobile: true, defaultHidden: true },
              { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "active" ? "success" : "neutral"}>{r.statusLabel}</Badge> },
            ]}
            rows={contracts ?? []}
            columnPicker
          />
        </Card>
      </div>
    </div>
  );
}

// ---- Unit ledger ----

function UnitsTab() {
  const { data: entries, loading } = useAsyncData(() => getUnitLedger());

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4 text-[13px] text-text-soft leading-relaxed">
        Append-only record of every unit issuance, cancellation and distribution, priced at the NAV on the day.
        The unit balance shown anywhere in the platform is a cache — always re-derivable by summing these rows,
        never edited directly.
      </Card>
      <Card className="p-1">
        <DataTable
          columns={[
            { key: "id", header: "Entry", render: (r) => <span className="tabular text-text">{r.id}</span> },
            { key: "kind", header: "Kind", render: (r) => <Badge tone={r.unitsDelta >= 0 ? "success" : "warning"}>{r.kind}</Badge> },
            { key: "contract", header: "Contract", render: (r) => <span className="tabular text-xs">{r.contractId}</span>, hideOnMobile: true },
            { key: "product", header: "Product", render: (r) => <span className="tabular text-xs text-text-soft">{r.productId}</span>, hideOnMobile: true },
            { key: "units", header: "Units", render: (r) => (
              <span className={`tabular ${r.unitsDelta >= 0 ? "text-success" : "text-warning"}`}>
                {r.unitsDelta >= 0 ? "+" : "−"}{formatUnits(Math.abs(r.unitsDelta))}
              </span>
            ) },
            { key: "nav", header: "NAV at entry", render: (r) => <span className="tabular">{r.navAtEntry.toFixed(4)}</span>, hideOnMobile: true },
            { key: "ref", header: "Reference", render: (r) => <span className="tabular text-xs">{r.referenceTxId}</span>, hideOnMobile: true },
            { key: "hash", header: "On-chain hash", render: (r) => r.onchainTxHash
              ? <span className="tabular text-xs">{r.onchainTxHash}</span>
              : <span className="text-text-faint text-xs">dormant hook</span>, hideOnMobile: true, defaultHidden: true },
            { key: "at", header: "Occurred", render: (r) => <span className="tabular text-xs">{formatDateTime(r.occurredAt)}</span>, hideOnMobile: true },
          ]}
          rows={entries ?? []}
          newest={(r) => r.occurredAt}
          columnPicker
        />
      </Card>
    </div>
  );
}

// ---- Accrual ----

function AccrualTab() {
  const { role } = useAuth();
  const toast = useToast();
  const { data: runs, loading, reload } = useAsyncData(getAccrualRuns);
  const { data: accruals } = useAsyncData(() => getContractAccruals());
  const [busy, setBusy] = useState(false);
  const me = role ? ADMIN_USERS[role].name : "";
  const canRun = role === "head_of_finance" || role === "operations" || role === "system_admin";

  const run = async () => {
    setBusy(true);
    try {
      const result = await triggerAccrualRun(new Date().toISOString().slice(0, 10), me);
      toast.push(
        `${result.status} — ${result.contractsProcessed} contracts accrued, ${result.contractsSkipped} skipped.`,
        result.status === "success" ? "success" : "error",
      );
      reload();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not run the batch", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Skeleton className="h-64" />;

  const lastRun = runs?.[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Last run"
          value={lastRun ? formatDate(lastRun.runDate) : "—"}
          hint={lastRun ? `${lastRun.contractsProcessed} processed · ${lastRun.contractsSkipped} skipped` : undefined}
        />
        <StatCard
          label="Accrued that night"
          value={lastRun?.totalAccrued.length
            ? (
              /* Both currencies, not just the first — a fund that accrues in
                 two currencies and reports one is reporting a wrong number,
                 not a rounded one. */
              <span className="flex flex-col gap-0.5 text-lg">
                {lastRun.totalAccrued.map((t) => (
                  <Money key={t.currency} amount={t.amount} currency={t.currency} />
                ))}
              </span>
            )
            : "—"}
          hint="Posted to the institution's expense side — an investor's own balance never moves day to day."
        />
        <StatCard label="Runs on record" value={runs?.length ?? 0} hint="A failed or partial run is its own row, never a silent gap." />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-sm font-semibold text-text mb-2">The day-weighted formula</div>
            <p className="text-[13px] text-text-soft leading-relaxed">
              A naive implementation snapshots one balance and multiplies by days — wrong the moment a subscription or
              redemption lands mid-period. This integrates the real daily balance from the unit ledger's own history:
            </p>
            <pre className="mt-3 text-xs tabular text-text-soft bg-surface-sunken border border-border rounded-lg p-3 overflow-x-auto">
{`accrued = (days × balance_at_period_end − Σ IntFactor) × daily_rate
IntFactor_i = delta_i × days_from_period_start_to_entry_i`}
            </pre>
            <p className="text-xs text-text-faint mt-2">
              The day-count convention sets the daily-rate divisor and is recorded on the tariff, not defaulted in code.
            </p>
          </div>
          {canRun && <Button onClick={run} disabled={busy}>{busy ? "Running…" : "Run tonight's batch"}</Button>}
        </div>
      </Card>

      <Card className="p-1">
        <DataTable
          columns={[
            { key: "id", header: "Run", render: (r) => <span className="tabular text-text">{r.id}</span> },
            { key: "date", header: "Value date", render: (r) => <span className="tabular">{formatDate(r.runDate)}</span> },
            { key: "status", header: "Status", render: (r) => (
              <Badge tone={r.status === "success" ? "success" : r.status === "partial" ? "warning" : "danger"}>{r.status}</Badge>
            ) },
            { key: "processed", header: "Processed", render: (r) => <span className="tabular">{r.contractsProcessed}</span>, hideOnMobile: true },
            { key: "skipped", header: "Skipped", render: (r) => <span className="tabular">{r.contractsSkipped}</span>, hideOnMobile: true },
            { key: "total", header: "Accrued", render: (r) => r.totalAccrued.length
              ? <div className="flex flex-col">{r.totalAccrued.map((t) => <Money key={t.currency} amount={t.amount} currency={t.currency} />)}</div>
              : <span className="text-text-faint">nothing</span> },
            { key: "note", header: "Note", render: (r) => r.note
              ? <span className="text-xs text-warning max-w-sm block">{r.note}</span>
              : <span className="text-text-faint">—</span>, hideOnMobile: true },
          ]}
          rows={runs ?? []}
          newest={(r) => r.runDate}
          columnPicker
        />
      </Card>

      <div>
        <div className="text-sm font-semibold text-text mb-3">Per-contract accrual</div>
        <Card className="p-1">
          <DataTable
            columns={[
              { key: "contract", header: "Contract", render: (r) => <span className="tabular text-text">{r.contractId}</span> },
              { key: "run", header: "Run", render: (r) => <span className="tabular text-xs text-text-soft">{r.runId}</span>, hideOnMobile: true },
              { key: "date", header: "Value date", render: (r) => <span className="tabular">{formatDate(r.valueDated)}</span> },
              { key: "amount", header: "Accrued", render: (r) => <span className="tabular text-text">{r.amount.toFixed(2)}</span> },
              { key: "rate", header: "Daily rate", render: (r) => <span className="tabular text-xs">{(r.dailyRate * 100).toFixed(6)}%</span>, hideOnMobile: true },
              { key: "dayCount", header: "Day count", render: (r) => <span className="text-text-soft text-xs">{DAY_COUNT_LABELS[r.dayCount]}</span>, hideOnMobile: true },
            ]}
            rows={(accruals ?? []).map((a, i) => ({ ...a, id: `${a.runId}-${a.contractId}-${i}` }))}
            newest={(r) => r.valueDated}
            emptyLabel="No accrual has been computed yet"
          />
        </Card>
      </div>
    </div>
  );
}

// ---- Business rules ----

function RulesTab() {
  const { data: rules, loading } = useAsyncData(getBusinessRules);
  if (loading) return <Skeleton className="h-64" />;

  const enforced = (rules ?? []).filter((r) => r.status === "enforced").length;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4 text-[13px] text-text-soft leading-relaxed">
        Every rule carries a stable ID and an honest status: actually enforced by this layer, or policy still awaiting
        implementation. <strong className="text-text">{enforced} of {rules?.length}</strong> are enforced —
        the rest are documented, and saying so is the point. A rule listed as enforced has a function that enforces it.
      </Card>
      <Card className="p-1">
        <DataTable
          columns={[
            { key: "id", header: "ID", render: (r) => <span className="tabular text-text font-medium">{r.id}</span> },
            { key: "rule", header: "Rule", render: (r) => <span className="text-text-soft">{r.rule}</span> },
            { key: "status", header: "Status", render: (r) => (
              <Badge tone={r.status === "enforced" ? "success" : "warning"}>{r.status}</Badge>
            ) },
            { key: "where", header: "Where", render: (r) => <span className="text-xs text-text-faint">{r.where ?? "—"}</span>, hideOnMobile: true },
          ]}
          rows={(rules ?? []).map((r) => ({ ...r, id: r.id }))}
        />
      </Card>
    </div>
  );
}
