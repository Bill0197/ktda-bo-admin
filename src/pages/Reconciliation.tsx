import { useState } from "react";
import { type ReconciliationBreak } from "../mock";
import { getReconciliationBreaks, resolveReconciliationBreak } from "../lib/api";
import {
  PageHeader, Badge, DataTable, type Column, Money, formatDateTime, Button, useToast, Skeleton, Card,
  FilterBar, SearchInput, SelectFilter, DateRangeFilter, inDateRange,
} from "../ui";
import { useAsyncData } from "../lib/useAsyncData";

const TYPE_LABEL: Record<ReconciliationBreak["type"], string> = {
  cash: "Cash",
  unit_holding: "Unit holding",
  nav: "NAV",
  custodian_statement: "Custodian statement",
};

const TYPE_OPTIONS = (Object.keys(TYPE_LABEL) as ReconciliationBreak["type"][]).map((v) => ({ value: v, label: TYPE_LABEL[v] }));
const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
];

export default function Reconciliation() {
  const { data: breaks, loading, error, reload, setData } = useAsyncData(getReconciliationBreaks);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState({ from: "", to: "" });
  const toast = useToast();

  const resolve = async (id: string) => {
    const updated = await resolveReconciliationBreak(id);
    setData((prev) => (prev ? prev.map((b) => (b.id === updated.id ? updated : b)) : prev));
    toast.push(`Break ${id} marked resolved`, "success");
  };

  const all = breaks ?? [];
  const rows = all.filter((r) => {
    if (type !== "all" && r.type !== type) return false;
    if (status !== "all" && r.status !== status) return false;
    if (!inDateRange(r.detectedAt, range.from, range.to)) return false;
    const q = query.trim().toLowerCase();
    return !q || r.description.toLowerCase().includes(q);
  });

  const columns: Column<ReconciliationBreak>[] = [
    { key: "type", header: "Type", render: (r) => <Badge tone="info">{TYPE_LABEL[r.type]}</Badge> },
    { key: "id", header: "Break ID", render: (r) => <span className="tabular text-text-faint text-xs">{r.id}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "description", header: "Description", render: (r) => r.description },
    { key: "variance", header: "Variance", render: (r) => (r.variance === 0 ? "—" : <Money amount={r.variance} currency={r.currency} signed />) },
    { key: "currency", header: "Currency", render: (r) => r.currency, hideOnMobile: true, defaultHidden: true },
    { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "open" ? "warning" : "success"}>{r.status}</Badge> },
    { key: "detectedAt", header: "Detected", render: (r) => formatDateTime(r.detectedAt), hideOnMobile: true },
    {
      key: "actions",
      header: "",
      render: (r) =>
        r.status === "open" && (
          <Button size="sm" variant="outline" onClick={() => resolve(r.id)}>
            Mark resolved
          </Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reconciliation"
        tooltip="Custodian: the bank that physically holds the fund's bond assets. A 'break' is a mismatch between the fund's own records and the custodian's statement — it must be investigated and cleared before NAV can be published."
        subtitle="Cash, unit-holding, NAV, and custodian-statement breaks — daily reconciliation against the custodian is the trust anchor for NAV publication."
      />

      {error && (
        <Card className="p-5 mb-6 flex items-center justify-between">
          <span className="text-sm text-danger">{error}</span>
          <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
        </Card>
      )}

      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search description…" />
        <SelectFilter value={type} onChange={setType} options={TYPE_OPTIONS} allLabel="All types" />
        <SelectFilter value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="All statuses" />
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        <span className="text-xs text-text-faint ml-auto">{rows.length} of {all.length} breaks</span>
      </FilterBar>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <DataTable newest={(r) => r.detectedAt} columns={columns} rows={rows} columnPicker emptyLabel="No breaks match" />
      )}
    </div>
  );
}
