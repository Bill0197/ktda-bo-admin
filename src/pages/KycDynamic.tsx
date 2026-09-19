import { useState } from "react";
import { LIFECYCLE_LABELS, type RiskRating } from "../mock";
import { getClients, getComplianceProfiles, getAmlAlerts, getComplianceCases } from "../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, FilterBar, SearchInput, formatDate, type Column } from "../ui";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";

const RISK_TONE: Record<RiskRating, "success" | "warning" | "danger"> = { low: "success", medium: "warning", high: "danger" };

type Row = {
  id: string;
  name: string;
  riskRating: RiskRating | null;
  lifecycle: string;
  triggers: string[];
  lastScreenedAt?: string;
};

export default function KycDynamic() {
  const { role } = useAuth();
  const { data, loading } = useAsyncData(() =>
    Promise.all([getClients(), getComplianceProfiles(), getAmlAlerts(), getComplianceCases(role ?? "compliance")]),
  );
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const [clients, profiles, alerts, cases] = data ?? [[], [], [], []];

  // Event-driven review: a client lands here when something changed —
  // an open alert, an active case, an EDD requirement or a suspension —
  // rather than because a calendar date arrived.
  const all: Row[] = clients.flatMap((c) => {
    const p = profiles.find((x) => x.clientId === c.id);
    if (!p) return [];
    const triggers: string[] = [];
    const openAlerts = alerts.filter((a) => a.clientId === c.id && (a.status === "open" || a.status === "under_review"));
    if (openAlerts.length) triggers.push(`${openAlerts.length} open monitoring alert${openAlerts.length === 1 ? "" : "s"}`);
    const activeCases = cases.filter((x) => x.clientId === c.id && x.status !== "closed_cleared" && x.status !== "closed_reported");
    if (activeCases.length) triggers.push(`${activeCases.length} active case${activeCases.length === 1 ? "" : "s"}`);
    if (p.eddRequired && !p.eddCompletedAt) triggers.push("EDD outstanding");
    if (p.lifecycleStatus === "suspended") triggers.push("Account suspended");
    if (p.riskRating === "high") triggers.push("High risk band");
    if (triggers.length === 0) return [];
    return [{ id: c.id, name: c.name, riskRating: p.riskRating, lifecycle: LIFECYCLE_LABELS[p.lifecycleStatus], triggers, lastScreenedAt: p.lastScreenedAt }];
  });

  const q = query.trim().toLowerCase();
  const rows = all.filter((r) => !q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.triggers.some((t) => t.toLowerCase().includes(q)));

  const columns: Column<Row>[] = [
    { key: "name", header: "Client", render: (r) => <span className="text-text font-medium">{r.name}</span> },
    { key: "id", header: "Investor ID", render: (r) => <span className="tabular text-text-faint text-xs">{r.id}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "riskRating", header: "Risk", render: (r) => (r.riskRating ? <Badge tone={RISK_TONE[r.riskRating]}>{r.riskRating}</Badge> : <span className="text-text-faint">unrated</span>) },
    { key: "lifecycle", header: "Lifecycle", render: (r) => <Badge tone="neutral">{r.lifecycle}</Badge>, hideOnMobile: true },
    {
      key: "triggers",
      header: "Review triggers",
      render: (r) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {r.triggers.map((t) => <Badge key={t} tone="warning">{t}</Badge>)}
        </div>
      ),
    },
    { key: "lastScreenedAt", header: "Last screened", render: (r) => (r.lastScreenedAt ? formatDate(r.lastScreenedAt) : <span className="text-text-faint">Never</span>), hideOnMobile: true },
  ];

  return (
    <div>
      <PageHeader
        title="Dynamic Review"
        tooltip="Event-driven KYC review — clients surface here when their risk picture changes (monitoring alerts, cases, EDD, suspension, high-risk band), independent of the periodic calendar."
        subtitle="Clients whose risk profile changed and need a review now, not at the next scheduled refresh."
      />

      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search client or trigger…" />
        <span className="text-xs text-text-faint ml-auto">{rows.length} of {all.length} flagged</span>
      </FilterBar>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} columnPicker onRowClick={(r) => navigate(`/kyc-dynamic/${r.id}`)} emptyLabel="No clients currently flagged for dynamic review" />
      )}
    </div>
  );
}
