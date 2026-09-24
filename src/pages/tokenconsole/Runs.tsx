import { useState } from "react";
import { Play } from "lucide-react";
import { Button, DataTable, Field, Input, Modal, NotePanel, PageHeader, Tabs, useToast, type Column } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { calendarDate, dateTime, money, percent, shortId, units } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { ActionModal, todayIso } from "../../components/tokenconsole/ActionModal";

type TabKey = "accrual" | "distribution" | "fees" | "tax";

/** The four run types share a shape except for their total and period, so
 * each is reduced to one row type. (The console this page came from read
 * `asOf`, `productId` and `totalAmount`, which no run carries, so most of its
 * columns were always blank.) */
type RunRow = {
  runId?: string;
  period: string;
  valueDate?: string;
  contracts?: number;
  failures?: number;
  total?: number;
  totalLabel: string;
  startedAt?: string;
  completedAt?: string;
  status?: string;
  message?: string;
};

const period = (from?: string, to?: string) =>
  from && to ? `${calendarDate(from)} – ${calendarDate(to)}` : to ? `to ${calendarDate(to)}` : "—";

const num = "tabular text-right whitespace-nowrap";

export default function TokenConsoleRuns() {
  const [tab, setTab] = useState<TabKey>("accrual");
  const [starting, setStarting] = useState(false);
  const [openRun, setOpenRun] = useState<{ kind: TabKey; runId: string } | null>(null);
  const accrual = useAsyncData(tokenConsole.accrualRuns);
  const distribution = useAsyncData(tokenConsole.distributionRuns);
  const fees = useAsyncData(tokenConsole.feeRuns);
  const tax = useAsyncData(tokenConsole.taxRuns);

  const views: Record<TabKey, { what: string; rows: RunRow[] | null }> = {
    accrual: {
      what: "accrual runs",
      rows: accrual.data?.map((r) => ({ ...r, contracts: r.contractCount, failures: r.failureCount, period: period(r.periodStart, r.periodEnd), total: r.totalAccrued, totalLabel: "accrued" })) ?? null,
    },
    distribution: {
      what: "distribution runs",
      rows: distribution.data?.map((r) => ({ ...r, contracts: r.contractCount, failures: r.failureCount, period: period(undefined, r.periodEnd), total: r.totalDistributed, totalLabel: `distributed, tax ${money(r.totalTax)}` })) ?? null,
    },
    fees: {
      what: "fee runs",
      rows: fees.data?.map((r) => ({ ...r, contracts: r.contractCount, failures: r.failureCount, period: period(r.periodStart, r.periodEnd), total: r.totalFee, totalLabel: "charged" })) ?? null,
    },
    tax: {
      what: "tax remittance runs",
      rows: tax.data?.map((r) => ({ ...r, contracts: r.contractCount, failures: r.failureCount, period: "—", total: r.totalRemitted, totalLabel: "remitted" })) ?? null,
    },
  };
  const states = { accrual, distribution, fees, tax };
  const active = views[tab];
  const state = states[tab];

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="Batch runs"
        subtitle="Jobs against the books: interest accrual, distributions, fees and tax remittance. A partial run skipped contracts it could not price. Select a run for what it posted per contract."
        actions={<Button size="sm" onClick={() => setStarting(true)}><Play size={14} /> Start {RUN_NOUN[tab]} run</Button>}
      />
      <Tabs
        className="mb-4"
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
        tabs={[
          { key: "accrual", label: "Accrual", count: accrual.data?.length },
          { key: "distribution", label: "Distribution", count: distribution.data?.length },
          { key: "fees", label: "Fees", count: fees.data?.length },
          { key: "tax", label: "Tax remittance", count: tax.data?.length },
        ]}
      />
      <ConsoleTable<RunRow>
        key={tab}
        what={active.what}
        source={{ data: active.rows, loading: state.loading, error: state.error, reload: state.reload }}
        rowId={(r) => r.runId}
        onRowClick={(r) => r.runId && setOpenRun({ kind: tab, runId: r.runId })}
        emptyLabel="No runs yet"
        columns={[
          { key: "run", header: "Run", render: (r) => <Code>{shortId(r.runId)}</Code> },
          { key: "period", header: "Period", render: (r) => (
            <div className="text-xs">
              <div className="text-text-soft">{r.period}</div>
              <div className="text-text-faint">value {calendarDate(r.valueDate)}</div>
            </div>
          ) },
          { key: "contracts", header: "Contracts", className: num, render: (r) => (
            <div>
              <div>{units(r.contracts)}</div>
              {!!r.failures && <div className="text-[11px] text-danger">{units(r.failures)} failed</div>}
            </div>
          ), hideOnMobile: true },
          { key: "total", header: "Total", className: num, render: (r) => (
            <div>
              <div className="text-text">{money(r.total)}</div>
              <div className="text-[11px] text-text-faint">{r.totalLabel}</div>
            </div>
          ) },
          { key: "timing", header: "Ran", render: (r) => (
            <div className="text-xs tabular text-text-soft">
              <div>{dateTime(r.startedAt)}</div>
              {r.completedAt && <div className="text-text-faint">done {dateTime(r.completedAt)}</div>}
            </div>
          ), hideOnMobile: true },
          { key: "status", header: "Status", render: (r) => (
            <div>
              <StatusBadge status={r.status} />
              {r.message && <div className="text-[11px] text-text-faint mt-1 max-w-xs">{r.message}</div>}
            </div>
          ) },
        ]}
      />
      {starting && (
        <StartRunModal
          kind={tab}
          onClose={() => setStarting(false)}
          onStarted={() => {
            setStarting(false);
            void state.reload();
          }}
        />
      )}
      <Modal open={!!openRun} onClose={() => setOpenRun(null)} title={openRun ? `${RUN_TITLE[openRun.kind]} run ${shortId(openRun.runId)}` : ""} size="lg">
        {openRun && <RunEntries key={`${openRun.kind}-${openRun.runId}`} kind={openRun.kind} runId={openRun.runId} />}
      </Modal>
    </div>
  );
}

const RUN_NOUN: Record<TabKey, string> = { accrual: "accrual", distribution: "distribution", fees: "fee", tax: "tax remittance" };
const RUN_TITLE: Record<TabKey, string> = { accrual: "Accrual", distribution: "Distribution", fees: "Fee", tax: "Tax remittance" };

/** What each run needs: accrual and fees cover a period, a distribution pays
 *  out to a period end, and tax remittance sweeps what was withheld. */
function StartRunModal({ kind, onClose, onStarted }: { kind: TabKey; onClose: () => void; onStarted: () => void }) {
  const toast = useToast();
  const today = todayIso();
  const [periodStart, setPeriodStart] = useState(today.slice(0, 8) + "01");
  const [periodEnd, setPeriodEnd] = useState(today);
  const [valueDate, setValueDate] = useState(today);
  const start = useAction(async () => {
    const vd = valueDate || undefined;
    if (kind === "accrual") return tokenConsole.runAccrual({ periodStart, periodEnd, valueDate: vd });
    if (kind === "fees") return tokenConsole.runFees({ periodStart, periodEnd, valueDate: vd });
    if (kind === "distribution") return tokenConsole.runDistribution({ periodEnd, valueDate: vd });
    return tokenConsole.runTaxRemittance({ valueDate: vd });
  });
  const needsPeriod = kind === "accrual" || kind === "fees";
  const problem = needsPeriod && (!periodStart || !periodEnd) ? "Both period dates are required."
    : needsPeriod && periodEnd < periodStart ? "The period ends before it starts."
    : kind === "distribution" && !periodEnd ? "A period end is required." : undefined;

  const submit = async () => {
    const r = await start.run();
    if (!r) return;
    toast.push(`${RUN_TITLE[kind]} run ${r.status === "COMPLETED" ? "completed" : `finished ${r.status?.toLowerCase() ?? ""}`}${r.message ? ` — ${r.message}` : "."}`,
      r.status === "COMPLETED" ? "success" : "warning");
    onStarted();
  };

  return (
    <ActionModal
      title={`Start a ${RUN_NOUN[kind]} run`}
      description={
        kind === "accrual" ? "Accrues interest for every active contract over the period and posts it. Contracts whose rate won't resolve are skipped, and the run is marked partial."
        : kind === "fees" ? "Charges the management fee over the period on each contract's balance."
        : kind === "distribution" ? "Pays out what has accrued up to the period end: to cash for income products, into new units for growth, withholding tax first."
        : "Remits the tax withheld so far to the authority's account."
      }
      submitLabel="Start run"
      pendingLabel="Running…"
      problem={problem}
      pending={start.pending}
      error={start.error}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {needsPeriod && (
          <Field label="Period start" required>
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </Field>
        )}
        {kind !== "tax" && (
          <Field label="Period end" required>
            <Input type="date" value={periodEnd} min={needsPeriod ? periodStart : undefined} onChange={(e) => setPeriodEnd(e.target.value)} />
          </Field>
        )}
        <Field label="Value date" hint="When the postings take effect. Blank uses the service's default.">
          <Input type="date" value={valueDate} onChange={(e) => setValueDate(e.target.value)} />
        </Field>
      </div>
    </ActionModal>
  );
}

type EntryRow = { id: string; contractId?: string; figures: { label: string; value: string }[]; valueDated?: string; journalId?: string };

/** What a run posted, contract by contract. */
function RunEntries({ kind, runId }: { kind: TabKey; runId: string }) {
  const entries = useAsyncData<EntryRow[]>(async () => {
    if (kind === "accrual") {
      return (await tokenConsole.accrualEntries(runId)).map((e, i) => ({
        id: e.entryId ?? `e${i}`, contractId: e.contractId, valueDated: e.valueDated, journalId: e.journalId,
        figures: [
          { label: "Average balance", value: money(e.averageBalance, e.currency) },
          { label: "Rate", value: `${percent(e.annualRate)} · ${e.dayCount ?? ""}` },
          { label: "Accrued", value: money(e.accruedAmount, e.currency) },
        ],
      }));
    }
    if (kind === "distribution") {
      return (await tokenConsole.distributionEntries(runId)).map((e, i) => ({
        id: e.entryId ?? `e${i}`, contractId: e.contractId, valueDated: e.valueDated, journalId: e.distributionJournalId,
        figures: [
          { label: "Gross", value: money(e.grossAccrued) },
          { label: "Tax withheld", value: money(e.taxWithheld) },
          { label: `Net (${e.distributionType ?? "—"})`, value: money(e.netDistributed) },
        ],
      }));
    }
    if (kind === "fees") {
      return (await tokenConsole.feeEntries(runId)).map((e, i) => ({
        id: e.entryId ?? `e${i}`, contractId: e.contractId, valueDated: e.valueDated, journalId: e.journalId,
        figures: [
          { label: "Basis", value: money(e.basisBalance) },
          { label: "Rate", value: percent(e.annualRate) },
          { label: "Fee", value: money(e.feeAmount) },
        ],
      }));
    }
    return (await tokenConsole.taxEntries(runId)).map((e, i) => ({
      id: e.entryId ?? `e${i}`, contractId: e.contractId, valueDated: e.valueDated, journalId: e.journalId,
      figures: [{ label: "Remitted", value: money(e.amountRemitted) }],
    }));
  });
  const figureCount = entries.data?.[0]?.figures.length ?? 0;
  const columns: Column<EntryRow>[] = [
    { key: "contract", header: "Contract", render: (r) => <Code>{r.contractId}</Code> },
    ...Array.from({ length: figureCount }, (_, i) => ({
      key: `f${i}`,
      header: entries.data?.[0]?.figures[i]?.label ?? "",
      className: "tabular text-right whitespace-nowrap",
      render: (r: EntryRow) => r.figures[i]?.value ?? "—",
    })),
    { key: "value", header: "Value date", render: (r) => <span className="tabular text-xs text-text-soft">{calendarDate(r.valueDated)}</span>, hideOnMobile: true },
    { key: "journal", header: "Journal", render: (r) => <Code>{shortId(r.journalId)}</Code>, hideOnMobile: true },
  ];
  if (entries.error) return <NotePanel tone="danger">{entries.error}</NotePanel>;
  return <DataTable rows={entries.data ?? []} emptyLabel={entries.loading ? "Loading…" : "This run posted nothing"} columns={columns} />;
}
