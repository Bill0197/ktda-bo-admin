import { useState } from "react";
import { getApprovalQueue, getLeads, useContentField, type ApprovalItem, type Lead } from "../mock";
import { PageHeader, Card, Badge, DataTable, Skeleton, FilterBar, SearchInput, formatDateTime, type Column } from "../ui";
import { useNavigate } from "react-router-dom";
import { useAsyncData } from "../lib/useAsyncData";

export default function Suitability() {
  const { data: queue, loading } = useAsyncData(getApprovalQueue);
  const { data: allLeads } = useAsyncData(getLeads);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const banner = useContentField(
    "suitability_banner",
    "text",
    "The product's self-service, KES-100 onboarding runs against the standard suitability SOP. Below-threshold scores route here rather than auto-activating — this queue is the manual bridge until Compliance approves a simplified pathway for this packaged product.",
  );

  const exceptions = (queue ?? []).filter((i) => i.kind === "kyc_exception");
  const leads = (allLeads ?? []).filter((l) => l.stage === "discovery_scheduled");
  const leadFor = (e: ApprovalItem): Lead | undefined => leads.find((l) => e.title.includes(l.name));

  const q = query.trim().toLowerCase();
  const rows = exceptions.filter((e) => {
    if (!q) return true;
    const lead = leadFor(e);
    return e.title.toLowerCase().includes(q) || e.detail.toLowerCase().includes(q) || !!lead?.name.toLowerCase().includes(q);
  });

  const RISK_TONE: Record<string, "success" | "warning" | "danger"> = { low: "success", medium: "warning", high: "danger" };

  const columns: Column<ApprovalItem>[] = [
    { key: "title", header: "Applicant", render: (r) => <span className="text-text font-medium">{r.title.replace("Suitability exception — ", "")}</span> },
    { key: "score", header: "Score", render: (r) => { const lead = leadFor(r); return lead?.suitabilityScore != null ? <span className="tabular">{lead.suitabilityScore}/100</span> : <span className="text-text-faint">—</span>; }, hideOnMobile: true },
    { key: "geography", header: "Geography", render: (r) => leadFor(r)?.geography ?? <span className="text-text-faint">—</span>, hideOnMobile: true },
    { key: "product", header: "Product", render: (r) => leadFor(r)?.product ?? <span className="text-text-faint">—</span>, hideOnMobile: true },
    { key: "deliveryChannel", header: "Delivery channel", render: (r) => leadFor(r)?.deliveryChannel ?? <span className="text-text-faint">—</span>, hideOnMobile: true },
    { key: "customerRisk", header: "Customer risk", render: (r) => { const risk = leadFor(r)?.customerRisk; return risk ? <Badge tone={RISK_TONE[risk]}>{risk}</Badge> : <span className="text-text-faint">unrated</span>; } },
    { key: "phone", header: "Phone", render: (r) => { const lead = leadFor(r); return lead ? <span className="tabular">{lead.phone}</span> : <span className="text-text-faint">—</span>; }, hideOnMobile: true, defaultHidden: true },
    { key: "proposedAt", header: "Flagged", render: (r) => formatDateTime(r.proposedAt), hideOnMobile: true, defaultHidden: true },
    { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "pending" ? "warning" : r.status === "approved" ? "success" : "danger"}>{r.status === "pending" ? "awaiting call" : r.status}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Suitability queue"
        tooltip="A short questionnaire scores whether this product fits an applicant's experience, income, and risk tolerance. Low scorers need a human call before their account can activate — a regulatory safeguard, not a rejection. BD Officer = Business Development Officer."
        subtitle="Self-service applicants scoring below the configured pass score are held for a BD Officer discovery call. Open a row to review and act."
      />

      <Card className="p-4 bg-warning-bg border-warning/30 mb-6">
        <p className="text-sm text-text">{banner}</p>
      </Card>

      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search applicant…" />
        <span className="text-xs text-text-faint ml-auto">{rows.length} of {exceptions.length} waiting</span>
      </FilterBar>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <DataTable newest={(r) => r.proposedAt}
          columns={columns}
          rows={rows}
          columnPicker
          onRowClick={(r) => navigate(`/suitability/${r.id}`)}
          emptyLabel={exceptions.length === 0 ? "Nothing waiting on a discovery call." : "No applicants match your search."}
        />
      )}
    </div>
  );
}
