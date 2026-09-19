import { useState } from "react";
import { KYC_STATUS_LABELS, type RiskRating } from "../mock";
import { getClients, getComplianceProfiles } from "../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, FilterBar, SearchInput, SelectFilter, formatDateTime, type Column } from "../ui";
import { useNavigate } from "react-router-dom";
import { useAsyncData } from "../lib/useAsyncData";

const RISK_TONE: Record<RiskRating, "success" | "warning" | "danger"> = { low: "success", medium: "warning", high: "danger" };

type Row = {
  id: string;
  name: string;
  email: string;
  kycStatus: string;
  riskRating: RiskRating | null;
  lastKycRefreshAt?: string;
  nextKycRefreshDue?: string;
  overdue: boolean;
};

export default function KycPeriodic() {
  const { data, loading } = useAsyncData(() => Promise.all([getClients(), getComplianceProfiles()]));
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("all");
  const navigate = useNavigate();

  const [clients, profiles] = data ?? [[], []];
  const today = new Date().toISOString().slice(0, 10);

  const all: Row[] = clients.map((c) => {
    const p = profiles.find((x) => x.clientId === c.id);
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      kycStatus: c.kycStatus,
      riskRating: p?.riskRating ?? null,
      lastKycRefreshAt: p?.lastKycRefreshAt,
      nextKycRefreshDue: p?.nextKycRefreshDue,
      overdue: !!p?.nextKycRefreshDue && p.nextKycRefreshDue < today,
    };
  });

  const q = query.trim().toLowerCase();
  const rows = all.filter((r) => {
    if (risk !== "all" && r.riskRating !== risk) return false;
    return !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
  });

  const columns: Column<Row>[] = [
    { key: "name", header: "Client", render: (r) => <span className="text-text font-medium">{r.name}</span> },
    { key: "id", header: "Investor ID", render: (r) => <span className="tabular text-text-faint text-xs">{r.id}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "email", header: "Email", render: (r) => r.email, hideOnMobile: true },
    { key: "kycStatus", header: "KYC status", render: (r) => <Badge tone={r.kycStatus === "verified" ? "success" : "info"}>{KYC_STATUS_LABELS[r.kycStatus] ?? r.kycStatus}</Badge> },
    { key: "riskRating", header: "Risk", render: (r) => (r.riskRating ? <Badge tone={RISK_TONE[r.riskRating]}>{r.riskRating}</Badge> : <span className="text-text-faint">unrated</span>) },
    { key: "lastKycRefreshAt", header: "Last refresh", render: (r) => (r.lastKycRefreshAt ? formatDateTime(r.lastKycRefreshAt) : <span className="text-text-faint">Never</span>), hideOnMobile: true },
    { key: "nextKycRefreshDue", header: "Next due", render: (r) => (r.nextKycRefreshDue ? <span className={r.overdue ? "text-danger font-medium" : undefined}>{r.nextKycRefreshDue}</span> : <Badge tone="warning">Not scheduled</Badge>) },
    { key: "status", header: "Review status", render: (r) => (r.overdue ? <Badge tone="danger">overdue</Badge> : <Badge tone="neutral">scheduled</Badge>), hideOnMobile: true },
  ];

  return (
    <div>
      <PageHeader
        title="KYC Periodic Review"
        tooltip="Every client's KYC and tax information is re-verified on the configured cadence (Platform Settings → compliance thresholds). Open a client to run the refresh from their file."
        subtitle="Scheduled re-verification of client KYC across the register — cadence-driven, risk-band aware."
      />

      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search client, email, ID…" />
        <SelectFilter value={risk} onChange={setRisk} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} allLabel="All risk bands" />
        <span className="text-xs text-text-faint ml-auto">{rows.length} of {all.length} clients</span>
      </FilterBar>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} columnPicker onRowClick={(r) => navigate(`/kyc-periodic/${r.id}`)} emptyLabel="No clients match" />
      )}
    </div>
  );
}
