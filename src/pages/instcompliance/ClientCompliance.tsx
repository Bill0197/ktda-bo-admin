import { INSTITUTIONAL_TYPE_LABELS, type InstitutionalClientCompliance } from "../../mock";
import { getInstitutionalClientCompliance } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, formatDate, type Column } from "../../ui";
import { FileSignature, Users, ListChecks, ShieldCheck } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const RISK_TONE = { low: "success", medium: "warning", high: "danger" } as const;

/** Institutional client compliance — KYB standing on the named book.
 *
 * The field that carries the most weight is `authorityOnFile`: evidence that
 * the client's own board or trustees actually authorised the appointment.
 * Funding a mandate without it means managing money nobody with authority
 * agreed to hand over — the single most common institutional onboarding gap,
 * and the reason it is a column rather than a line in an outstanding-items
 * list. */
export default function ClientCompliance() {
  const { data, loading } = useAsyncData(getInstitutionalClientCompliance);
  const rows = data ?? [];

  const missingAuthority = rows.filter((r) => !r.authorityOnFile && r.nextReviewDue !== "—");
  const uboOutstanding = rows.filter((r) => !r.uboVerified);
  const withItems = rows.filter((r) => r.outstandingItems.length > 0);
  const enhanced = rows.filter((r) => r.kycTier === "enhanced");

  const columns: Column<InstitutionalClientCompliance>[] = [
    { key: "client", header: "Client", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.clientName}</div>
        <div className="text-xs text-text-faint">{INSTITUTIONAL_TYPE_LABELS[r.clientType]}</div>
      </div>
    ) },
    { key: "tier", header: "KYC tier", className: "whitespace-nowrap", render: (r) => (
      <Badge tone={r.kycTier === "enhanced" ? "warning" : "neutral"}>{r.kycTier === "enhanced" ? "Enhanced" : "Standard"}</Badge>
    ) },
    { key: "risk", header: "Risk", className: "whitespace-nowrap", render: (r) => <Badge tone={RISK_TONE[r.riskRating]}>{r.riskRating}</Badge> },
    { key: "ubo", header: "Beneficial ownership", render: (r) => {
      if (r.uboCount === 0) return <span className="text-xs text-text-faint">no UBO — public body or trust</span>;
      return r.uboVerified
        ? <span className="text-xs text-text-soft">{r.uboCount} verified</span>
        : <Badge tone="danger">{r.uboCount} unverified</Badge>;
    } },
    { key: "authority", header: "Authority to appoint", className: "whitespace-nowrap", render: (r) => r.authorityOnFile
      ? <Badge tone="success">On file</Badge>
      : <Badge tone="danger">Missing</Badge> },
    { key: "sanctions", header: "Sanctions", className: "whitespace-nowrap", render: (r) => (
      <Badge tone={r.sanctionsClear ? "success" : "danger"}>{r.sanctionsClear ? "Clear" : "Match"}</Badge>
    ) },
    { key: "review", header: "Review cycle", render: (r) => (
      <div className="text-xs">
        <div className="text-text-soft tabular">{r.lastReviewedAt ? formatDate(r.lastReviewedAt) : "never reviewed"}</div>
        <div className="text-text-faint tabular">{r.nextReviewDue === "—" ? "no further review" : `next ${formatDate(r.nextReviewDue)}`}</div>
      </div>
    ), hideOnMobile: true },
    { key: "outstanding", header: "Outstanding items", render: (r) => r.outstandingItems.length === 0
      ? <span className="text-xs text-text-faint">none</span>
      : (
        <ul className="text-xs text-text-soft max-w-md space-y-1 leading-relaxed">
          {r.outstandingItems.map((item) => <li key={item}>• {item}</li>)}
        </ul>
      ) },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Institutional Investment Compliance"
        title="Institutional client compliance"
        tooltip="KYB — know your business. The entity equivalent of KYC: the client's constitution, its beneficial owners, and evidence that whoever signed had authority to."
        subtitle="Onboarding and periodic review standing across the named book."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Authority missing" value={missingAuthority.length} icon={<FileSignature size={17} />} tone={missingAuthority.length ? "danger" : "success"} hint="no board resolution or trustee minute on file" />
        <GlassStat label="UBO outstanding" value={uboOutstanding.length} icon={<Users size={17} />} tone={uboOutstanding.length ? "warning" : "success"} hint="beneficial owners identified but not verified" />
        <GlassStat label="Files with open items" value={withItems.length} icon={<ListChecks size={17} />} tone={withItems.length ? "warning" : "success"} hint="documents or checks still outstanding" />
        <GlassStat label="Enhanced due diligence" value={enhanced.length} icon={<ShieldCheck size={17} />} tone="neutral" emphasis={false} hint="clients on the enhanced KYC tier" />
      </StatRail>

      {missingAuthority.length > 0 && (
        <NotePanel tone="danger" className="mb-5" title="No evidence of authority to appoint">
          {missingAuthority.map((r) => r.clientName).join(", ")}. The mandate must not be funded until the client's
          own governing body has authorised the appointment in writing. A signed IMA proves someone signed; it does
          not prove they were entitled to.
        </NotePanel>
      )}

      <NotePanel tone="info" className="mb-5" title="No UBO is a valid answer">
        A public pension scheme or a charitable trust has no beneficial owner in the AML sense. That reads as
        &ldquo;no UBO&rdquo; here rather than as an unverified zero, so a genuine gap on a corporate file stays
        visible instead of being lost among legitimate blanks.
      </NotePanel>

      <SectionTitle
        title="Client compliance register"
        description="A closed prospect keeps its file for the statutory retention period. Its outstanding item is the retention itself, not an action anybody needs to take."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No institutional client files" />
      </GlassPanel>
    </div>
  );
}
