import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, CircleAlert, Hourglass, RefreshCw } from "lucide-react";
import {
  Badge, Button, DataTable, DateRangeFilter, FilterBar, GlassPanel, NotePanel, PageHeader, SearchInput,
  SelectFilter, Skeleton, StatCard, inDateRange,
} from "../../ui";
import { dateTime, label, money, shortId } from "../../lib/tokenConsole/format";
import {
  PER_CUSTOMER, loadCustomerTransactions, totalsByCurrency,
  type CustomerTransaction, type TransactionsLoad, type TransactionsProgress,
} from "../../lib/tokenConsole/customerTransactions";
import { Code, SourceError } from "../../components/tokenconsole/ConsoleTable";

/* Customer transactions across everyone, from omnichannel: M-Pesa payments
   and payouts beside the product's own movements (investments, redemptions),
   newest first. One customer's own list is on the Customer desk; this is the
   same data for all of them at once, to answer "what failed today" or "who
   paid for this" without knowing whose it was. Read only. */

type Tone = "success" | "warning" | "danger" | "neutral";
const STATUS_TONE: Record<string, Tone> = { PAID: "success", SENT: "success", POSTED: "success", PENDING: "warning", FAILED: "danger" };
const PAGE = 100;

const sourceLabel = (source: string) => (source === "MPESA" ? "M-Pesa" : source === "PRODUCT" ? "Product" : label(source));

function sumText(rows: CustomerTransaction[]): string {
  const totals = totalsByCurrency(rows);
  return totals.length === 0 ? money(0, "KES") : totals.map((t) => money(t.amount, t.currency)).join(" · ");
}

export default function TokenConsoleTransactions() {
  const [load, setLoad] = useState<TransactionsLoad | null>(null);
  const [progress, setProgress] = useState<TransactionsProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++run.current;
    const stale = () => run.current !== mine;
    setLoading(true);
    setError(null);
    setProgress(null);
    try {
      const result = await loadCustomerTransactions((p) => { if (!stale()) setProgress(p); }, stale);
      if (!stale()) setLoad(result);
    } catch (e) {
      if (!stale()) setError(e instanceof Error ? e.message : "The transactions could not be loaded.");
    } finally {
      if (!stale()) setLoading(false);
    }
  }, []);

  // Leaving the page stops the remaining customer reads.
  const cancel = useCallback(() => { run.current++; }, []);
  useEffect(() => {
    void reload();
    return cancel;
  }, [reload, cancel]);

  const [q, setQ] = useState("");
  const [source, setSource] = useState("all");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState({ from: "", to: "" });
  const [shown, setShown] = useState(PAGE);

  const all = useMemo(() => load?.rows ?? [], [load]);
  const options = useMemo(() => {
    const distinct = (pick: (r: CustomerTransaction) => string | null) =>
      [...new Set(all.map(pick).filter((v): v is string => !!v))].sort();
    return {
      sources: distinct((r) => r.source).map((v) => ({ value: v, label: sourceLabel(v) })),
      kinds: distinct((r) => r.kind).map((v) => ({ value: v, label: label(v) })),
      statuses: distinct((r) => r.status).map((v) => ({ value: v, label: label(v) })),
    };
  }, [all]);

  const term = q.trim().toLowerCase();
  const rows = useMemo(
    () => all.filter((r) =>
      (source === "all" || r.source === source)
      && (kind === "all" || r.kind === kind)
      && (status === "all" || r.status === status)
      && inDateRange(r.occurredAt, range.from, range.to)
      && (!term || [r.customer, r.reference, r.detail, r.label, r.profileId].some((v) => (v ?? "").toLowerCase().includes(term)))),
    [all, source, kind, status, range, term],
  );
  // A changed filter starts again from the first page of results.
  useEffect(() => setShown(PAGE), [source, kind, status, range, term]);

  const stats = useMemo(() => {
    const mpesa = rows.filter((r) => r.source === "MPESA");
    return {
      collected: mpesa.filter((r) => r.kind !== "PAYOUT" && r.status === "PAID"),
      paidOut: mpesa.filter((r) => r.kind === "PAYOUT" && r.status === "SENT"),
      failed: rows.filter((r) => r.status === "FAILED"),
      pending: rows.filter((r) => r.status === "PENDING"),
    };
  }, [rows]);

  const filtered = rows.length !== all.length;
  const first = loading && !load;

  return (
    <div>
      <PageHeader
        eyebrow="Baracel Unyt"
        title="Transactions"
        subtitle="Every customer's M-Pesa payments and payouts, and the investments and redemptions they made, newest first. Open a customer for their full history on the Customer desk."
        actions={
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void reload()}>
            <RefreshCw size={14} className={loading ? "animate-spin" : undefined} /> {loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />

      {error && <SourceError what="transactions" error={error} onRetry={reload} />}

      {first && !error && (
        <>
          <p className="mb-3 text-sm text-text-soft" role="status">
            {progress && progress.customers > 0
              ? `Reading ${progress.done} of ${progress.customers} customers…`
              : "Finding customers…"}
          </p>
          <Skeleton className="h-64" />
        </>
      )}

      {load && (
        <>
          {load.failed > 0 && (
            <NotePanel tone="warning" className="mb-4" title="Some customers are missing">
              {load.failed} of {load.customers} customers could not be read, so their transactions are not in this list. Refresh to try again.
            </NotePanel>
          )}

          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Collected" value={sumText(stats.collected)} hint={`${stats.collected.length} M-Pesa payments paid`} icon={<ArrowDownLeft size={16} />} />
            <StatCard label="Paid out" value={sumText(stats.paidOut)} hint={`${stats.paidOut.length} payouts sent`} icon={<ArrowUpRight size={16} />} />
            <StatCard label="Failed" value={stats.failed.length} hint={sumText(stats.failed)} icon={<CircleAlert size={16} />} />
            <StatCard label="Pending" value={stats.pending.length} hint={sumText(stats.pending)} icon={<Hourglass size={16} />} />
          </div>

          <FilterBar>
            <SearchInput value={q} onChange={setQ} placeholder="Customer, reference or receipt…" className="w-full sm:w-72" />
            <SelectFilter value={source} onChange={setSource} options={options.sources} allLabel="All sources" />
            <SelectFilter value={kind} onChange={setKind} options={options.kinds} allLabel="All types" />
            <SelectFilter value={status} onChange={setStatus} options={options.statuses} allLabel="All statuses" />
            <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
          </FilterBar>

          <p className="mb-2 text-[12.5px] text-text-faint">
            {filtered ? `${rows.length} of ${all.length} transactions` : `${all.length} transactions`} across {load.customers} customers
            {filtered && " · the figures above follow the filters"}
          </p>

          <GlassPanel className="p-1" sheen={false}>
            <DataTable<CustomerTransaction>
              rows={rows.slice(0, shown)}
              emptyLabel={all.length === 0 ? "No customer has paid or invested yet" : "No transaction matches those filters"}
              columns={[
                { key: "when", header: "When", className: "whitespace-nowrap", render: (t) => <span className="tabular text-xs text-text-soft">{dateTime(t.occurredAt)}</span> },
                { key: "customer", header: "Customer", render: (t) => (
                  <Link
                    to={`/token-console/customers?id=${encodeURIComponent(t.profileId)}`}
                    className="font-medium text-text hover:text-primary-600"
                    title="Open on the Customer desk"
                  >
                    {t.customer}
                  </Link>
                ) },
                { key: "what", header: "What", render: (t) => (
                  <div>
                    <div className="text-text">{t.label}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-faint">
                      <span className="rounded border border-border px-1.5 py-px text-[10.5px] font-medium uppercase tracking-wide">{sourceLabel(t.source)}</span>
                      {t.detail}
                    </div>
                  </div>
                ) },
                { key: "amount", header: "Amount", className: "tabular text-right whitespace-nowrap", render: (t) => t.amount === null || t.amount === undefined ? "—"
                  : <span className={t.direction === "IN" ? "text-success" : "text-text"}>{t.direction === "OUT" ? "−" : "+"}{money(t.amount, t.currency)}</span> },
                { key: "status", header: "Status", className: "whitespace-nowrap", render: (t) => t.status ? <Badge tone={STATUS_TONE[t.status] ?? "neutral"}>{label(t.status)}</Badge> : "—" },
                { key: "ref", header: "Reference", className: "whitespace-nowrap", hideOnMobile: true, render: (t) => t.reference
                  ? <span title={t.reference}><Code>{t.reference.length > 20 ? shortId(t.reference) : t.reference}</Code></span> : "—" },
              ]}
            />
          </GlassPanel>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px] text-text-faint">
            {rows.length > 0 && <span>Showing {Math.min(shown, rows.length)} of {rows.length}</span>}
            {rows.length > shown && <Button size="sm" variant="outline" onClick={() => setShown((n) => n + PAGE)}>Show more</Button>}
          </div>

          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-text-faint">
            Amounts are signed from the customer's side: − is money leaving them, + is money reaching them. The list covers
            customers who applied in the app; someone staff onboarded and linked by code is on the Customer desk only.
            {load.truncated > 0 && ` ${load.truncated} ${load.truncated === 1 ? "customer has" : "customers have"} more than ${PER_CUSTOMER} entries; only their latest ${PER_CUSTOMER} are here.`}
            {" "}Each load reads every customer's history, and omnichannel records each read against you.
          </p>
        </>
      )}
    </div>
  );
}
