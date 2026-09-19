import { useState } from "react";
import {
  employmentTypeLabel, genderLabel, incomeRangeLabel,
  KYC_STATUS_LABELS, LIFECYCLE_LABELS, type ClientRow, type RiskRating,
} from "../mock";
import { getClients, getComplianceProfiles } from "../lib/api";
import {
  PageHeader, Badge, DataTable, type Column, formatDate, Money, Skeleton, Card, Button,
  FilterBar, SearchInput, SelectFilter,
} from "../ui";
import { useNavigate } from "react-router-dom";
import { useAsyncData } from "../lib/useAsyncData";

const KYC_TONE: Record<string, "success" | "warning" | "info" | "danger"> = {
  verified: "success",
  suitability_exception: "warning",
  pending_review: "info",
  in_progress: "info",
  rejected: "danger",
};

const RISK_TONE: Record<RiskRating, "success" | "warning" | "danger"> = { low: "success", medium: "warning", high: "danger" };

const KYC_OPTIONS = ["verified", "suitability_exception", "pending_review", "in_progress", "rejected"].map((v) => ({ value: v, label: KYC_STATUS_LABELS[v] ?? v }));

export default function Clients() {
  const { data: clients, loading, error, reload } = useAsyncData(getClients);
  const { data: profiles } = useAsyncData(getComplianceProfiles);
  const [query, setQuery] = useState("");
  const [kyc, setKyc] = useState("all");
  const [channel, setChannel] = useState("all");
  const navigate = useNavigate();

  const all = clients ?? [];
  const channelOptions = [...new Set(all.map((c) => c.channel))].map((v) => ({ value: v, label: v }));
  const profileFor = (id: string) => profiles?.find((p) => p.clientId === id);

  const rows = all.filter((c) => {
    if (kyc !== "all" && c.kycStatus !== kyc) return false;
    if (channel !== "all" && c.channel !== channel) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.idNumber?.toLowerCase().includes(q) ?? false)
    );
  });

  const columns: Column<ClientRow>[] = [
    { key: "name", header: "Name", render: (r) => <span className="text-text font-medium">{r.name}</span> },
    { key: "id", header: "Investor ID", render: (r) => <span className="tabular text-text-faint text-xs">{r.id}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "email", header: "Email", render: (r) => r.email, hideOnMobile: true },
    { key: "phone", header: "Phone", render: (r) => <span className="tabular text-text-soft">{r.phone}</span>, hideOnMobile: true, defaultHidden: true },
    {
      key: "lifecycle",
      header: "Lifecycle",
      render: (r) => {
        const p = profileFor(r.id);
        return p ? <Badge tone={p.lifecycleStatus === "active" ? "success" : p.lifecycleStatus === "edd_required" ? "danger" : "info"}>{LIFECYCLE_LABELS[p.lifecycleStatus]}</Badge> : <span className="text-text-faint">—</span>;
      },
    },
    {
      key: "risk",
      header: "Risk",
      render: (r) => {
        const rating = profileFor(r.id)?.riskRating;
        return rating ? <Badge tone={RISK_TONE[rating]}>{rating}</Badge> : <span className="text-text-faint">unrated</span>;
      },
    },
    { key: "kycStatus", header: "KYC status", render: (r) => <Badge tone={KYC_TONE[r.kycStatus] ?? "info"}>{KYC_STATUS_LABELS[r.kycStatus] ?? r.kycStatus.replace(/_/g, " ")}</Badge>, hideOnMobile: true },
    { key: "city", header: "City", render: (r) => r.city ?? <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
    { key: "gender", header: "Gender", render: (r) => (r.gender ? genderLabel(r.gender) : <span className="text-text-faint">—</span>), hideOnMobile: true, defaultHidden: true },
    { key: "employmentType", header: "Occupation", render: (r) => (r.employmentType ? employmentTypeLabel(r.employmentType) : <span className="text-text-faint">—</span>), hideOnMobile: true, defaultHidden: true },
    { key: "industry", header: "Industry", render: (r) => r.industry ?? <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
    { key: "incomeRange", header: "Income range", render: (r) => (r.incomeRange ? incomeRangeLabel(r.incomeRange) : <span className="text-text-faint">—</span>), hideOnMobile: true, defaultHidden: true },
    /* Legacy — the questionnaire was retired from the investor apps, so this
       is empty for anyone who onboarded since. Kept, hidden by default, so the
       scores already on file stay reachable. */
    { key: "suitabilityScore", header: "Suitability", render: (r) => (r.suitabilityScore != null ? `${r.suitabilityScore}/100` : <span className="text-text-faint">—</span>), hideOnMobile: true, defaultHidden: true },
    { key: "aum", header: "AUM", render: (r) => <Money amount={r.aum} currency={r.currency} /> },
    { key: "channel", header: "Channel", render: (r) => r.channel, hideOnMobile: true },
    { key: "joinedAt", header: "Joined", render: (r) => formatDate(r.joinedAt), hideOnMobile: true, defaultHidden: true },
  ];

  return (
    <div>
      <PageHeader title="Clients" subtitle={`${all.length} onboarded investors — open a client for the full compliance file.`} />

      {error && (
        <Card className="p-5 mb-6 flex items-center justify-between">
          <span className="text-sm text-danger">{error}</span>
          <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
        </Card>
      )}

      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, email, phone, ID no.…" />
        <SelectFilter value={kyc} onChange={setKyc} options={KYC_OPTIONS} allLabel="All KYC statuses" />
        <SelectFilter value={channel} onChange={setChannel} options={channelOptions} allLabel="All channels" />
        <span className="text-xs text-text-faint ml-auto">{rows.length} of {all.length} clients</span>
      </FilterBar>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} onRowClick={(r) => navigate(`/clients/${r.id}`)} columnPicker emptyLabel="No clients match" />
      )}
    </div>
  );
}
