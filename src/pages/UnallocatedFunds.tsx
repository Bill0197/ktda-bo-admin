import { useState } from "react";
import { type UnallocatedFund } from "../mock";
import { getUnallocatedFunds, matchUnallocatedFund } from "../lib/api";
import {
  PageHeader, Card, Badge, DataTable, type Column, Money, formatDateTime, Button, useToast, Skeleton,
  FilterBar, SearchInput, SelectFilter, DateRangeFilter, inDateRange,
} from "../ui";
import { useAsyncData } from "../lib/useAsyncData";

const STATUS_TONE: Record<UnallocatedFund["status"], "warning" | "success" | "info"> = { unmatched: "warning", matched: "success", returned: "info" };

const STATUS_OPTIONS = (Object.keys(STATUS_TONE) as UnallocatedFund["status"][]).map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));

export default function UnallocatedFunds() {
  const { data, loading, error, reload, setData } = useAsyncData(getUnallocatedFunds);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState({ from: "", to: "" });
  const toast = useToast();

  const match = async (id: string, reference: string) => {
    const updated = await matchUnallocatedFund(id);
    setData((prev) => (prev ? prev.map((f) => (f.id === updated.id ? updated : f)) : prev));
    toast.push(`${reference} matched to investor and credited`, "success");
  };

  const all = data ?? [];
  const rows = all.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (!inDateRange(r.receivedAt, range.from, range.to)) return false;
    const q = query.trim().toLowerCase();
    return !q || r.reference.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q);
  });

  const columns: Column<UnallocatedFund>[] = [
    { key: "reference", header: "Wire reference", render: (r) => <span className="tabular text-text">{r.reference}</span> },
    { key: "id", header: "Register ID", render: (r) => <span className="tabular text-text-faint text-xs">{r.id}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "amount", header: "Amount", render: (r) => <Money amount={r.amount} currency={r.currency} /> },
    { key: "currency", header: "Currency", render: (r) => r.currency, hideOnMobile: true, defaultHidden: true },
    { key: "reason", header: "Reason unmatched", render: (r) => r.reason },
    { key: "status", header: "Status", render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
    { key: "receivedAt", header: "Received", render: (r) => formatDateTime(r.receivedAt), hideOnMobile: true },
    {
      key: "actions",
      header: "",
      render: (r) =>
        r.status === "unmatched" && (
          <Button size="sm" onClick={() => match(r.id, r.reference)}>
            Match manually
          </Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Unallocated Funds Register" subtitle="USD wire receipts that couldn't be auto-matched to an investor land here — held, never lost or bounced." />
      <Card className="p-3.5 bg-surface-sunken border-none mb-4 text-xs text-text-soft">
        Mirrors Investcent Operations' existing pattern for unidentified receipts, extended to this fund's USD subscription rail.
      </Card>

      {error && (
        <Card className="p-5 mb-6 flex items-center justify-between">
          <span className="text-sm text-danger">{error}</span>
          <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
        </Card>
      )}

      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search reference, reason…" />
        <SelectFilter value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="All statuses" />
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        <span className="text-xs text-text-faint ml-auto">{rows.length} of {all.length} receipts</span>
      </FilterBar>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <DataTable newest={(r) => r.receivedAt} columns={columns} rows={rows} columnPicker emptyLabel="No receipts match" />
      )}
    </div>
  );
}
