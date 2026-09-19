import { useMemo, useState } from "react";
import { getReports, generateReport } from "../lib/api";
import { REPORT_CATEGORY_LABELS, ROLE_LABELS as MOCK_ROLE_LABELS, type ReportDef, type ReportCategory } from "../mock";
import {
  PageHeader, Card, Badge, Button, DataTable, Tabs, Skeleton, EmptyState, Modal,
  FilterBar, SearchInput, useToast, formatDateTime, type Column,
} from "../ui";
import { FileBarChart2, Download, RefreshCw } from "lucide-react";
import { useAuth, ADMIN_USERS, ROLE_LABELS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";

const CATEGORY_TONE: Record<ReportCategory, "info" | "accent" | "warning" | "success" | "neutral" | "danger"> = {
  regulatory: "accent",
  finance: "info",
  operations: "neutral",
  compliance: "warning",
  distributions: "success",
  processes: "info",
  audit_mis: "danger",
  miscellaneous: "neutral",
};

const FREQUENCY_LABEL: Record<ReportDef["frequency"], string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  on_demand: "On demand",
};

export default function Reports() {
  const { role } = useAuth();
  const toast = useToast();
  const { data: reports, loading, error, reload, setData } = useAsyncData(
    () => (role ? getReports(role) : Promise.resolve([])),
  );
  const [category, setCategory] = useState<"all" | ReportCategory>("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [active, setActive] = useState<ReportDef | null>(null);
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set());

  const me = role ? ADMIN_USERS[role].name : "";

  const tabs = useMemo(() => {
    const present = new Set((reports ?? []).map((r) => r.category));
    return [
      { key: "all", label: "All", count: reports?.length ?? 0 },
      ...(Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[])
        .filter((c) => present.has(c))
        .map((c) => ({ key: c, label: REPORT_CATEGORY_LABELS[c], count: (reports ?? []).filter((r) => r.category === c).length })),
    ];
  }, [reports]);

  const rows = (reports ?? []).filter((r) => {
    if (category !== "all" && r.category !== category) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.columns.some((c) => c.label.toLowerCase().includes(q))
    );
  });

  const openDetail = (r: ReportDef) => {
    setActive(r);
    setSelectedCols(new Set(r.columns.map((c) => c.key)));
  };

  const toggleCol = (key: string) => {
    setSelectedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const run = async (report: ReportDef, columnKeys?: string[]) => {
    setBusyId(report.id);
    try {
      const updated = await generateReport(report.id, me, columnKeys);
      setData((prev) => (prev ? prev.map((r) => (r.id === updated.id ? { ...updated } : r)) : prev));
      setActive((prev) => (prev && prev.id === updated.id ? { ...updated } : prev));
      toast.push(`${report.name} generated${columnKeys ? ` with ${columnKeys.length} columns` : ""}`, "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not generate the report", "error");
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<ReportDef>[] = [
    {
      key: "name",
      header: "Report",
      render: (r) => (
        <div>
          <div className="text-text font-medium">{r.name}</div>
          <div className="text-xs text-text-soft mt-0.5 max-w-md">{r.description}</div>
        </div>
      ),
    },
    { key: "category", header: "Category", render: (r) => <Badge tone={CATEGORY_TONE[r.category]}>{REPORT_CATEGORY_LABELS[r.category]}</Badge> },
    { key: "columns", header: "Columns", render: (r) => <span className="text-sm tabular text-text-soft">{r.columns.length}</span>, hideOnMobile: true },
    { key: "frequency", header: "Cadence", render: (r) => FREQUENCY_LABEL[r.frequency], hideOnMobile: true },
    { key: "format", header: "Format", render: (r) => <span className="tabular text-text-soft">{r.format}</span>, hideOnMobile: true },
    {
      key: "lastRun",
      header: "Last generated",
      render: (r) =>
        r.lastRun ? (
          <div className="text-xs">
            <div className="text-text">{formatDateTime(r.lastRun.at)}</div>
            <div className="text-text-faint mt-0.5">
              by {r.lastRun.by} · {r.lastRun.sizeKb} KB{r.lastRun.columnCount ? ` · ${r.lastRun.columnCount} cols` : ""}
            </div>
          </div>
        ) : (
          <span className="text-xs text-text-faint">Never run</span>
        ),
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            disabled={!r.lastRun}
            onClick={(e) => {
              e.stopPropagation();
              toast.push(`${r.name} (${r.format}) download started`, "info");
            }}
          >
            <Download size={13} />
            Download
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reports"
        tooltip="Each report is scoped by role — you only see the packs your SOP responsibilities cover. Click a report to see every available column and generate with the subset you need."
        subtitle={`Regulatory, finance and operational reporting packs available to ${role ? ROLE_LABELS[role] : "your role"}.`}
      />

      {error && (
        <Card className="p-5 mb-6 flex items-center justify-between">
          <span className="text-sm text-danger">{error}</span>
          <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
        </Card>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {!loading && reports && reports.length === 0 && (
        <Card>
          <EmptyState
            icon={<FileBarChart2 size={20} />}
            title="No reports for your role"
            body="Report packs are scoped to SOP responsibilities. If you're missing one you need, ask a System Admin to review the report's access list."
          />
        </Card>
      )}

      {!loading && reports && reports.length > 0 && (
        <>
          <FilterBar>
            <Tabs tabs={tabs} active={category} onChange={(k) => setCategory(k as typeof category)} />
            <SearchInput value={query} onChange={setQuery} placeholder="Search reports and columns…" className="w-64 sm:ml-auto" />
          </FilterBar>
          <DataTable columns={columns} rows={rows} onRowClick={openDetail} emptyLabel="No reports match" />
        </>
      )}

      <Modal open={!!active} onClose={() => busyId === null && setActive(null)} title={active?.name ?? ""} size="lg">
        {active && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-soft">{active.description}</p>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <Badge tone={CATEGORY_TONE[active.category]}>{REPORT_CATEGORY_LABELS[active.category]}</Badge>
              <Badge tone="neutral">{FREQUENCY_LABEL[active.frequency]}</Badge>
              <Badge tone="neutral">{active.format}</Badge>
              <span className="text-text-faint">
                Visible to: {active.restrictedTo.map((r) => MOCK_ROLE_LABELS[r]).join(", ")}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[13px] font-semibold text-text">
                  Available columns ({selectedCols.size}/{active.columns.length} selected)
                </h3>
                <div className="flex gap-3 text-xs">
                  <button type="button" className="text-primary-600 font-medium" onClick={() => setSelectedCols(new Set(active.columns.map((c) => c.key)))}>
                    Select all
                  </button>
                  <button type="button" className="text-text-faint hover:text-text" onClick={() => setSelectedCols(new Set())}>
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface-sunken p-3">
                {active.columns.map((c) => (
                  <label key={c.key} className="flex items-start gap-2.5 py-1 text-sm text-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCols.has(c.key)}
                      onChange={() => toggleCol(c.key)}
                      className="h-4 w-4 mt-0.5 accent-[var(--primary-600)]"
                    />
                    <span>
                      {c.label}
                      {c.description && <span className="block text-[11px] text-text-faint">{c.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {active.lastRun && (
              <p className="text-xs text-text-faint">
                Last generated {formatDateTime(active.lastRun.at)} by {active.lastRun.by}
                {active.lastRun.columnCount ? ` · ${active.lastRun.columnCount} columns` : ""} · {active.lastRun.sizeKb} KB
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" disabled={busyId === active.id} onClick={() => setActive(null)}>Close</Button>
              <Button
                disabled={busyId === active.id || selectedCols.size === 0}
                onClick={() => run(active, [...selectedCols])}
              >
                <RefreshCw size={13} className={busyId === active.id ? "animate-spin" : ""} />
                {busyId === active.id ? "Generating…" : `Generate (${selectedCols.size} columns)`}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
