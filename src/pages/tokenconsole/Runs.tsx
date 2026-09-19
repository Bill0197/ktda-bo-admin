import { useState } from "react";
import { PageHeader, Tabs } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { calendarDate, dateTime, money, shortId, units } from "../../lib/tokenConsole/format";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";

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
        subtitle="Jobs against the books: interest accrual, distributions, fees and tax remittance. A partial run skipped contracts it could not price."
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
    </div>
  );
}
