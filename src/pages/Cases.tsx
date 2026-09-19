import { useState } from "react";
import {
  CASE_TYPE_LABELS, CASE_STATUS_LABELS,
  type ComplianceCase, type CaseType, type CaseStatus,
} from "../mock";
import { getComplianceCases, createCase } from "../lib/api";
import {
  PageHeader, Badge, DataTable, type Column, Button, Card, Modal, Field, Input, Textarea, Dropdown, Skeleton,
  FilterBar, SearchInput, SelectFilter, DateRangeFilter, inDateRange, useToast, formatDateTime,
} from "../ui";
import { useNavigate } from "react-router-dom";
import { FolderPlus, Download } from "lucide-react";
import { useAuth, ADMIN_USERS, ROLE_LABELS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";

const TYPE_TONE: Record<CaseType, "info" | "warning" | "accent" | "danger"> = { aml: "info", fraud: "warning", abc: "accent", sar: "danger" };
const STATUS_TONE: Record<CaseStatus, "warning" | "info" | "accent" | "danger" | "success" | "neutral"> = {
  open: "warning", investigating: "info", pending_approval: "accent", escalated_mlro: "danger", closed_cleared: "success", closed_reported: "neutral",
};

const TYPE_OPTIONS = (Object.keys(CASE_TYPE_LABELS) as CaseType[]).map((v) => ({ value: v, label: CASE_TYPE_LABELS[v] }));
const STATUS_OPTIONS = (Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((v) => ({ value: v, label: CASE_STATUS_LABELS[v] }));

/** The case workspace, used by both desks.
 *
 * `scope` narrows it to one case type: Fraud Reporting reads the same store —
 * cases are one register, not two — but shows only its own matters, so the type
 * filter and the new-case default follow the desk you came from. Without the
 * prop this is the full Transaction Monitoring listing, unchanged. */
export default function Cases({ scope }: { scope?: CaseType } = {}) {
  const { role } = useAuth();
  const { data: cases, loading, error, reload, setData } = useAsyncData(() => getComplianceCases(role ?? "compliance"));
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState({ from: "", to: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  // CSV export of the FILTERED view — respects the SAR seam-side filtering,
  // since it only ever exports rows the current role was served.
  const exportCsv = () => {
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const header = ["Case ID", "Type", "Title", "Client", "Severity", "Status", "Assignee", "Opened", "Opened by", "Due", "Closed", "STR reference", "Summary"];
    const lines = rows.map((c) =>
      [c.id, CASE_TYPE_LABELS[c.type], c.title, c.clientName, c.severity, CASE_STATUS_LABELS[c.status], c.assignee ?? "", c.openedAt, c.openedBy, c.dueAt ?? "", c.closedAt ?? "", c.sar?.strReference ?? "", c.summary]
        .map(esc).join(","),
    );
    const blob = new Blob([[header.map(esc).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `case-listing-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.push(`Exported ${rows.length} case${rows.length === 1 ? "" : "s"} to CSV`, "success");
  };

  const all = (cases ?? []).filter((c) => !scope || c.type === scope);
  const rows = all.filter((c) => {
    if (type !== "all" && c.type !== type) return false;
    if (status !== "all" && c.status !== status) return false;
    if (!inDateRange(c.openedAt, range.from, range.to)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return c.title.toLowerCase().includes(q) || c.clientName.toLowerCase().includes(q) || (c.assignee ?? "").toLowerCase().includes(q);
  });

  const columns: Column<ComplianceCase>[] = [
    { key: "type", header: "Type", render: (r) => <Badge tone={TYPE_TONE[r.type]}>{CASE_TYPE_LABELS[r.type]}</Badge> },
    {
      key: "title",
      header: "Case",
      render: (r) => (
        <div>
          <div className="text-text font-medium">{r.title}</div>
          <div className="text-xs text-text-soft mt-0.5 max-w-md truncate">{r.summary}</div>
        </div>
      ),
    },
    { key: "id", header: "Case ID", render: (r) => <span className="tabular text-text-faint text-xs">{r.id}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "clientName", header: "Client", render: (r) => r.clientName, hideOnMobile: true },
    { key: "severity", header: "Severity", render: (r) => <Badge tone={r.severity === "high" ? "danger" : r.severity === "medium" ? "warning" : "info"}>{r.severity}</Badge>, hideOnMobile: true },
    { key: "status", header: "Status", render: (r) => <Badge tone={STATUS_TONE[r.status]}>{CASE_STATUS_LABELS[r.status]}</Badge> },
    { key: "assignee", header: "Assignee", render: (r) => r.assignee ?? <span className="text-text-faint">—</span>, hideOnMobile: true },
    { key: "openedAt", header: "Opened", render: (r) => formatDateTime(r.openedAt), hideOnMobile: true },
    { key: "dueAt", header: "Due", render: (r) => r.dueAt ?? <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
  ];

  return (
    <div>
      <PageHeader
        title={scope === "fraud" ? "Fraud cases" : "Case management"}
        eyebrow={scope === "fraud" ? "Fraud Reporting" : "Transaction Monitoring"}
        tooltip={
          scope === "fraud"
            ? "One investigation file per fraud matter — account takeover, third-party payment, mule accounts and payment-rail abuse — with notes, evidence and decisions all audit-linked."
            : "One investigation file per matter — AML, fraud, anti-bribery and SARs — with notes, evidence and decisions all audit-linked. SAR cases are visible only to Compliance and the MLRO."
        }
        subtitle={
          scope === "fraud"
            ? "Investigation workspace for fraud matters escalated from the fraud alert board. Every action lands in the tamper-evident audit trail."
            : "Investigation workspace for suspicious activity, fraud and ABC matters. Every action lands in the tamper-evident audit trail."
        }
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={loading || rows.length === 0} onClick={exportCsv}>
              <Download size={14} /> Export
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <FolderPlus size={14} /> New case
            </Button>
          </div>
        }
      />

      {error && (
        <Card className="p-5 mb-6 flex items-center justify-between">
          <span className="text-sm text-danger">{error}</span>
          <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
        </Card>
      )}

      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search case, client, assignee…" />
        {!scope && <SelectFilter value={type} onChange={setType} options={TYPE_OPTIONS} allLabel="All types" />}
        <SelectFilter value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="All statuses" />
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        <span className="text-xs text-text-faint ml-auto">{rows.length} of {all.length} cases</span>
      </FilterBar>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} onRowClick={(r) => navigate(`/cases/${r.id}`)} columnPicker emptyLabel="No cases match" />
      )}

      <CreateCaseModal
        open={createOpen}
        defaultType={scope}
        onClose={() => setCreateOpen(false)}
        onCreated={(c) => {
          setData((prev) => (prev ? [c, ...prev] : prev));
          navigate(`/cases/${c.id}`);
        }}
      />
    </div>
  );
}

function CreateCaseModal({ open, defaultType, onClose, onCreated }: { open: boolean; defaultType?: CaseType; onClose: () => void; onCreated: (c: ComplianceCase) => void }) {
  const { role } = useAuth();
  const toast = useToast();
  const [type, setType] = useState<CaseType>(defaultType ?? "aml");
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState<ComplianceCase["severity"]>("medium");
  const [saving, setSaving] = useState(false);

  const me = role ? ADMIN_USERS[role].name : "";

  const submit = async () => {
    if (!title.trim() || !summary.trim()) {
      toast.push("Title and summary are required", "warning");
      return;
    }
    setSaving(true);
    try {
      const created = await createCase(
        { type, title: title.trim(), clientName: clientName.trim() || "— (internal)", summary: summary.trim(), severity },
        me,
        role ? ROLE_LABELS[role] : "Compliance",
      );
      toast.push(`Case ${created.id} opened`, "success");
      setTitle(""); setClientName(""); setSummary("");
      onClose();
      onCreated(created);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not create the case", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title="Open a case" size="md">
      <div className="flex flex-col gap-4">
        <Field label="Type">
          <Dropdown value={type} onChange={(v) => setType(v as CaseType)} options={TYPE_OPTIONS} ariaLabel="Case type" />
        </Field>
        <Field label="Title" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unusual redemption pattern — J. Doe" autoFocus />
        </Field>
        <Field label="Client (optional)" hint="Leave blank for internal matters (e.g. ABC declarations).">
          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" />
        </Field>
        <Field label="Severity">
          <Dropdown
            value={severity}
            onChange={(v) => setSeverity(v as ComplianceCase["severity"])}
            options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]}
            ariaLabel="Severity"
          />
        </Field>
        <Field label="Summary" required>
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What happened, and why it warrants a case." />
        </Field>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button disabled={saving} onClick={submit}>{saving ? "Opening…" : "Open case"}</Button>
        </div>
      </div>
    </Modal>
  );
}
