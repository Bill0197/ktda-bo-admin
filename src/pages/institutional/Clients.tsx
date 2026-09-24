import { INSTITUTIONAL_TYPE_LABELS, INSTITUTIONAL_STATUS_LABELS, type InstitutionalClient, type InstitutionalClientStatus } from "../../mock";
import { getInstitutionalClients } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, InfoTip, formatDate, type Column } from "../../ui";
import { Building2, Landmark, DoorOpen, UserPlus } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE: Record<InstitutionalClientStatus, "success" | "info" | "warning" | "neutral"> = {
  active: "success",
  onboarding: "info",
  notice_period: "warning",
  terminated: "neutral",
};

/** Institutional clients — the named book.
 *
 * Every active client has exactly one live Investment Management Agreement, so
 * a client showing no mandate reference is either mid-onboarding or a data
 * problem — never a normal steady state. The column is nullable for that
 * reason rather than defaulted to a blank string. */
export default function InstitutionalClients() {
  const { data, loading } = useAsyncData(getInstitutionalClients);
  const rows = data ?? [];

  const active = rows.filter((c) => c.status === "active");
  const kesAum = active.filter((c) => c.currency === "KES").reduce((s, c) => s + c.aum, 0);
  const onboarding = rows.filter((c) => c.status === "onboarding");
  const leaving = rows.filter((c) => c.status === "notice_period");

  const columns: Column<InstitutionalClient>[] = [
    { key: "name", header: "Client", className: "min-w-[240px]", render: (r) => (
      <div>
        <div className="flex items-center gap-1.5 text-text font-medium">
          {r.name}
          {r.note && <InfoTip text={r.note} />}
        </div>
        <div className="mt-0.5 text-xs text-text-faint">{INSTITUTIONAL_TYPE_LABELS[r.type]}</div>
      </div>
    ) },
    // Status and the mandate reference answer one question — is this client
    // live under a signed IMA — so the reference sits under the status.
    { key: "status", header: "Status · mandate", className: "whitespace-nowrap", render: (r) => (
      <div className="flex flex-col items-start gap-1">
        <Badge tone={STATUS_TONE[r.status]}>{INSTITUTIONAL_STATUS_LABELS[r.status]}</Badge>
        {r.mandateRef
          ? <span className="tabular text-xs text-text-faint">{r.mandateRef}</span>
          : <Badge tone="warning">No live IMA</Badge>}
      </div>
    ) },
    { key: "aum", header: "AUM", className: "text-right whitespace-nowrap", render: (r) => r.aum > 0
      ? <Money amount={r.aum} currency={r.currency} compact />
      : <span className="text-text-faint text-xs">not funded</span> },
    { key: "regulator", header: "Client's regulator", className: "min-w-[120px]", render: (r) => <span className="text-xs text-text-soft leading-snug">{r.clientRegulator}</span>, hideOnMobile: true },
    { key: "rm", header: "Relationship manager", className: "whitespace-nowrap", render: (r) => <span className="text-xs text-text-soft">{r.relationshipManager}</span>, hideOnMobile: true },
    { key: "onboarded", header: "Onboarded", className: "whitespace-nowrap", render: (r) => <span className="tabular text-xs text-text-soft">{formatDate(r.onboardedAt)}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "note", header: "Note", render: (r) => r.note
      ? <span className="text-xs text-text-soft max-w-md block leading-relaxed">{r.note}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Institutional Funds"
        title="Institutional clients"
        subtitle="Schemes, insurers, SACCOs and corporates that appoint the firm under an Investment Management Agreement."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Active clients" value={active.length} icon={<Building2 size={17} />} tone="primary" emphasis={false} hint={`${rows.length} on file including closed`} />
        <GlassStat label="KES assets under management" value={<Money amount={kesAum} currency="KES" compact />} icon={<Landmark size={17} />} tone="neutral" emphasis={false} hint="active KES mandates only" />
        <GlassStat label="Onboarding" value={onboarding.length} icon={<UserPlus size={17} />} tone={onboarding.length ? "primary" : "neutral"} emphasis={false} hint="appointed, not yet funded" />
        <GlassStat label="In notice period" value={leaving.length} icon={<DoorOpen size={17} />} tone={leaving.length ? "warning" : "success"} hint="notice served, orderly realisation running" />
      </StatRail>

      <NotePanel tone="info" className="mb-5" title="Why the client's own regulator is on the record">
        An RBA-regulated pension scheme and an IRA-regulated insurer need different returns from us on different
        clocks. Their regulator drives their reporting obligations, so it is a field on the client rather than
        something the reporting screen has to infer.
      </NotePanel>

      <SectionTitle
        title="Client register"
        description="A terminated client stays listed. The mandate ended; the record-keeping obligation and the closing reports did not."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No institutional clients" />
      </GlassPanel>
    </div>
  );
}
