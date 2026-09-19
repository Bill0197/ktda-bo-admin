import { useState } from "react";
import { getApprovalQueue, decideApproval } from "../lib/api";
import { approverRolesFor, APPROVAL_KIND_LABELS, type ApprovalItem, type ApprovalKind } from "../mock";
import {
  PageHeader, Card, Badge, Button, Modal, Tabs, useToast, DataTable, type Column, Money, formatDateTime, Skeleton,
  FilterBar, SearchInput, SelectFilter, DateRangeFilter, inDateRange,
} from "../ui";
import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth, ADMIN_USERS, ROLE_LABELS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";

const KIND_TONE: Record<string, "info" | "accent" | "warning" | "danger"> = {
  payment_release: "danger",
  nav_publication: "info",
  static_data_change: "accent",
  distribution_batch: "info",
  liquidity_gate_extension: "warning",
  kyc_exception: "warning",
  account_activation: "info",
  account_closure: "warning",
  edd_signoff: "warning",
  str_filing: "danger",
  case_closure: "accent",
};

const KIND_OPTIONS = (Object.keys(APPROVAL_KIND_LABELS) as ApprovalKind[]).map((v) => ({ value: v, label: APPROVAL_KIND_LABELS[v] }));

export default function Approvals() {
  const { data, loading, error, reload, setData } = useAsyncData(getApprovalQueue);
  const [active, setActive] = useState<ApprovalItem | null>(null);
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [range, setRange] = useState({ from: "", to: "" });
  const { role } = useAuth();
  const toast = useToast();

  const items = data ?? [];

  const me = role ? ADMIN_USERS[role].name : "";
  const selfProposed = active ? active.proposedBy.includes(me) : false;
  // Delegation of Authority: the routing rules (Platform Settings → Approval
  // routing) decide which roles may act as checker for this kind and amount.
  const requiredRoles = active ? approverRolesFor(active) : null;
  const outsideDoA = !!requiredRoles && !!role && !requiredRoles.includes(role);
  const canDecide = !selfProposed && !outsideDoA;

  const decide = async (status: "approved" | "rejected") => {
    if (!active) return;
    const updated = await decideApproval(active.id, status, me);
    setData((prev) => (prev ? prev.map((i) => (i.id === updated.id ? updated : i)) : prev));
    toast.push(`${APPROVAL_KIND_LABELS[updated.kind]} ${status}`, status === "approved" ? "success" : "warning");
    setActive(null);
  };

  const tabRows = items.filter((i) => (tab === "pending" ? i.status === "pending" : i.status !== "pending"));
  const rows = tabRows.filter((r) => {
    if (kind !== "all" && r.kind !== kind) return false;
    if (!inDateRange(r.proposedAt, range.from, range.to)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return r.title.toLowerCase().includes(q) || r.proposedBy.toLowerCase().includes(q);
  });

  const columns: Column<ApprovalItem>[] = [
    { key: "kind", header: "Type", render: (r) => <Badge tone={KIND_TONE[r.kind]}>{APPROVAL_KIND_LABELS[r.kind]}</Badge> },
    { key: "title", header: "Item", render: (r) => <span className="text-text font-medium">{r.title}</span> },
    { key: "amount", header: "Amount", render: (r) => (r.amount != null ? <Money amount={r.amount} currency={r.currency ?? "KES"} /> : <span className="text-text-faint">—</span>), hideOnMobile: true },
    { key: "proposedBy", header: "Proposed by", render: (r) => r.proposedBy, hideOnMobile: true },
    { key: "proposedAt", header: "Submitted", render: (r) => formatDateTime(r.proposedAt), hideOnMobile: true },
    { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warning"}>{r.status}</Badge> },
    { key: "decidedBy", header: "Decided by", render: (r) => r.decidedBy ?? <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
    { key: "decidedAt", header: "Decided", render: (r) => (r.decidedAt ? formatDateTime(r.decidedAt) : <span className="text-text-faint">—</span>), hideOnMobile: true, defaultHidden: true },
  ];

  return (
    <div>
      <PageHeader
        title="Approvals"
        tooltip="Maker-checker: the person who proposes an action (the 'maker') can never also approve it — a different person (the 'checker') must sign off, so no single person can move money alone."
        subtitle="Maker-checker: every payment release, NAV publication, and static-data change needs a second, distinct approver."
      />

      {error && (
        <Card className="p-5 mb-6 flex items-center justify-between">
          <span className="text-sm text-danger">{error}</span>
          <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
        </Card>
      )}

      <Tabs
        tabs={[
          { key: "pending", label: "Pending", count: items.filter((i) => i.status === "pending").length },
          { key: "history", label: "History" },
        ]}
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
        className="mb-4"
      />

      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search item, proposer…" />
        <SelectFilter value={kind} onChange={setKind} options={KIND_OPTIONS} allLabel="All types" />
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        <span className="text-xs text-text-faint ml-auto">{rows.length} of {tabRows.length} items</span>
      </FilterBar>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} onRowClick={setActive} columnPicker emptyLabel="Nothing here" />
      )}

      <Modal open={!!active} onClose={() => setActive(null)} title={active ? APPROVAL_KIND_LABELS[active.kind] : ""} size="lg">
        {active && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm font-semibold text-text mb-1">{active.title}</div>
              <p className="text-sm text-text-soft leading-relaxed">{active.detail}</p>
            </div>
            <Card className="p-3.5 bg-surface-sunken border-none text-xs text-text-soft flex justify-between items-center gap-3">
              <span>Proposed by {active.proposedBy}</span>
              <span className="flex items-center gap-3">
                {active.entityRef && (active.entityRef.entityType === "client" || active.entityRef.entityType === "case") && (
                  <Link
                    to={`/${active.entityRef.entityType === "client" ? "clients" : "cases"}/${active.entityRef.entityId}`}
                    className="text-primary-600 font-medium"
                  >
                    Open record
                  </Link>
                )}
                {formatDateTime(active.proposedAt)}
              </span>
            </Card>
            {active.status === "pending" && selfProposed && (
              <Card className="p-3.5 bg-danger-bg border-none flex gap-2.5">
                <ShieldAlert size={16} className="text-danger shrink-0 mt-0.5" />
                <div className="text-xs text-text">
                  You proposed this item. Maker-checker separation of duties means you can't also be the approver —
                  ask another {role && ROLE_LABELS[role]} teammate to review it.
                </div>
              </Card>
            )}
            {active.status === "pending" && !selfProposed && outsideDoA && requiredRoles && (
              <Card className="p-3.5 bg-warning-bg border-none flex gap-2.5">
                <ShieldAlert size={16} className="text-warning shrink-0 mt-0.5" />
                <div className="text-xs text-text">
                  Outside your delegation of authority — this {APPROVAL_KIND_LABELS[active.kind].toLowerCase()}
                  {active.amount ? ` of this size` : ""} needs sign-off from: {requiredRoles.map((r) => ROLE_LABELS[r]).join(", ")}.
                  Routing is configured in Platform Settings → Approval routing.
                </div>
              </Card>
            )}
            {active.status === "pending" ? (
              <div className="flex gap-2 justify-end">
                <Button variant="outline" disabled={!canDecide} onClick={() => decide("rejected")}>Reject</Button>
                <Button disabled={!canDecide} onClick={() => decide("approved")}>Approve</Button>
              </div>
            ) : (
              <div className="text-xs text-text-faint">
                {active.status === "approved" ? "Approved" : "Rejected"} by {active.decidedBy} · {active.decidedAt && formatDateTime(active.decidedAt)}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
