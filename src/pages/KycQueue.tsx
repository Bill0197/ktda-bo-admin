import { useState } from "react";
import { type ClientRow } from "../mock";
import { getClients } from "../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, FilterBar, SearchInput, SelectFilter, formatDate, type Column } from "../ui";
import { useNavigate } from "react-router-dom";
import { useAsyncData } from "../lib/useAsyncData";

export default function KycQueue() {
  const { data, loading } = useAsyncData(getClients);
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("all");
  const navigate = useNavigate();

  const pending = (data ?? []).filter((r) => r.kycStatus === "pending_review");
  const channelOptions = [...new Set(pending.map((c) => c.channel))].map((c) => ({ value: c, label: c }));

  const q = query.trim().toLowerCase();
  const rows = pending.filter((c) => {
    if (channel !== "all" && c.channel !== channel) return false;
    return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q);
  });

  const columns: Column<ClientRow>[] = [
    { key: "name", header: "Applicant", render: (r) => <span className="text-text font-medium">{r.name}</span> },
    { key: "email", header: "Email", render: (r) => r.email, hideOnMobile: true },
    { key: "phone", header: "Phone", render: (r) => <span className="tabular">{r.phone}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "channel", header: "Channel", render: (r) => r.channel, hideOnMobile: true },
    { key: "suitabilityScore", header: "Suitability", render: (r) => (r.suitabilityScore != null ? <span className="tabular">{r.suitabilityScore}/100</span> : <span className="text-text-faint">—</span>), hideOnMobile: true },
    { key: "joinedAt", header: "Applied", render: (r) => formatDate(r.joinedAt), hideOnMobile: true },
    { key: "status", header: "Status", render: () => <Badge tone="info">Pending Activation</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="KYC Onboarding"
        tooltip="KYC = Know Your Customer, the identity checks required before an account can invest. PEP = Politically Exposed Person, someone in a prominent public role who needs extra screening."
        subtitle="Applications with ID and selfie captured, awaiting manual sanctions/PEP review. Open a row to review and decide."
      />

      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, email, phone…" />
        <SelectFilter value={channel} onChange={setChannel} options={channelOptions} allLabel="All channels" />
        <span className="text-xs text-text-faint ml-auto">{rows.length} of {pending.length} in queue</span>
      </FilterBar>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          columnPicker
          onRowClick={(r) => navigate(`/kyc-queue/${r.id}`)}
          emptyLabel={pending.length === 0 ? "Queue is empty." : "No applicants match your filters."}
        />
      )}
    </div>
  );
}
