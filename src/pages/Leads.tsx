import { useState } from "react";
import { type Lead } from "../mock";
import { getLeads } from "../lib/api";
import {
  PageHeader, Badge, DataTable, type Column, formatDateTime, Skeleton, Card, Button,
  FilterBar, SearchInput, SelectFilter, DateRangeFilter, inDateRange,
} from "../ui";
import { useAsyncData } from "../lib/useAsyncData";

const STAGE_TONE: Record<Lead["stage"], "info" | "warning" | "success" | "danger" | "neutral"> = {
  new: "info",
  contacted: "info",
  discovery_scheduled: "warning",
  converted: "success",
  lost: "danger",
};

const STAGE_OPTIONS = (Object.keys(STAGE_TONE) as Lead["stage"][]).map((v) => ({ value: v, label: v.replace(/_/g, " ")[0].toUpperCase() + v.replace(/_/g, " ").slice(1) }));

export default function Leads() {
  const { data: leads, loading, error, reload } = useAsyncData(getLeads);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [range, setRange] = useState({ from: "", to: "" });

  const all = leads ?? [];
  const rows = all.filter((r) => {
    if (stage !== "all" && r.stage !== stage) return false;
    if (!inDateRange(r.createdAt, range.from, range.to)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q) || r.source.toLowerCase().includes(q);
  });

  const columns: Column<Lead>[] = [
    { key: "name", header: "Name", render: (r) => <span className="text-text font-medium">{r.name}</span> },
    { key: "id", header: "Lead ID", render: (r) => <span className="tabular text-text-faint text-xs">{r.id}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "phone", header: "Phone", render: (r) => <span className="tabular text-text-soft">{r.phone}</span>, hideOnMobile: true },
    { key: "source", header: "Source", render: (r) => r.source, hideOnMobile: true },
    { key: "stage", header: "Stage", render: (r) => <Badge tone={STAGE_TONE[r.stage]}>{r.stage.replace(/_/g, " ")}</Badge> },
    { key: "score", header: "Suitability", render: (r) => (r.suitabilityScore != null ? `${r.suitabilityScore}/100` : <span className="text-text-faint">—</span>) },
    { key: "createdAt", header: "Created", render: (r) => formatDateTime(r.createdAt), hideOnMobile: true },
  ];

  return (
    <div>
      <PageHeader title="Leads" subtitle="Manual lead register — no CRM yet, so every discovery call starts here." />

      {error && (
        <Card className="p-5 mb-6 flex items-center justify-between">
          <span className="text-sm text-danger">{error}</span>
          <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
        </Card>
      )}

      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, phone, source…" />
        <SelectFilter value={stage} onChange={setStage} options={STAGE_OPTIONS} allLabel="All stages" />
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        <span className="text-xs text-text-faint ml-auto">{rows.length} of {all.length} leads</span>
      </FilterBar>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No leads match" />
      )}
    </div>
  );
}
