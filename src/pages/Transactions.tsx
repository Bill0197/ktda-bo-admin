import { useState } from "react";
import { type Transaction } from "../mock";
import { getTransactions, getSubFunds } from "../lib/api";
import {
  PageHeader, Badge, DataTable, type Column, Money, formatDateTime, Skeleton,
  FilterBar, SearchInput, SelectFilter, DateRangeFilter, inDateRange,
} from "../ui";
import { useAsyncData } from "../lib/useAsyncData";

const STATUS_TONE: Record<string, "success" | "warning" | "info" | "danger"> = {
  settled: "success",
  processing: "info",
  pending: "info",
  gated: "warning",
  failed: "danger",
};

const TYPE_OPTIONS = ["subscription", "redemption", "distribution", "fee"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
const STATUS_OPTIONS = ["settled", "processing", "pending", "gated", "failed"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));

export default function Transactions() {
  // getTransactions() is Ledger/Finance-domain (api.ledger.ts); its return
  // type doesn't literal-match every field of Transaction (e.g. status/type
  // are typed as plain strings there, not the narrower TxStatus/TxType
  // unions), so the result is cast the same way Screening.tsx already does
  // for the same function.
  const { data: txs, loading } = useAsyncData(() => getTransactions() as Promise<Transaction[]>);
  const { data: funds } = useAsyncData(getSubFunds);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState({ from: "", to: "" });

  const currencyFor = (r: Transaction) => funds?.find((f) => f.code === r.subFund)?.currency ?? "KES";
  const fundNameFor = (r: Transaction) => funds?.find((f) => f.code === r.subFund)?.name ?? r.subFund;

  const rows = (txs ?? []).filter((r) => {
    if (type !== "all" && r.type !== type) return false;
    if (status !== "all" && r.status !== status) return false;
    if (!inDateRange(r.createdAt, range.from, range.to)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return r.reference.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || fundNameFor(r).toLowerCase().includes(q);
  });

  const columns: Column<Transaction>[] = [
    { key: "reference", header: "Reference", render: (r) => <span className="tabular text-text">{r.reference}</span> },
    { key: "id", header: "Ledger ID", render: (r) => <span className="tabular text-text-faint text-xs">{r.id}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "type", header: "Type", render: (r) => <span className="capitalize">{r.type}</span> },
    { key: "subFund", header: "Sub-fund", render: (r) => <span className="text-text-soft text-xs">{fundNameFor(r)}</span>, hideOnMobile: true },
    { key: "amount", header: "Amount", render: (r) => <Money amount={r.amount} currency={currencyFor(r)} /> },
    { key: "units", header: "Units", render: (r) => <span className="tabular text-text-soft">{r.units ? r.units.toLocaleString() : "—"}</span>, hideOnMobile: true },
    { key: "channel", header: "Channel", render: (r) => r.channel.replace("_", " "), hideOnMobile: true },
    { key: "status", header: "Status", render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
    { key: "createdAt", header: "Created", render: (r) => formatDateTime(r.createdAt), hideOnMobile: true },
    { key: "settledAt", header: "Settled", render: (r) => (r.settledAt ? formatDateTime(r.settledAt) : <span className="text-text-faint">—</span>), hideOnMobile: true, defaultHidden: true },
  ];

  return (
    <div>
      <PageHeader title="Transactions" subtitle="Live feed of subscriptions, redemptions, and distributions posting to the ledger." />

      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search reference, ID, fund…" />
        <SelectFilter value={type} onChange={setType} options={TYPE_OPTIONS} allLabel="All types" />
        <SelectFilter value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="All statuses" />
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        <span className="text-xs text-text-faint ml-auto">{rows.length} of {(txs ?? []).length} entries</span>
      </FilterBar>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No transactions match" />
      )}
    </div>
  );
}
