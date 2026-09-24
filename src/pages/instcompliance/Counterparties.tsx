import { COUNTERPARTY_TYPE_LABELS, DD_STATUS_LABELS, type Counterparty, type DueDiligenceStatus } from "../../mock";
import { getCounterparties } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, InfoTip, formatDate, type Column } from "../../ui";
import { Building2, FileClock, ShieldAlert, Radar } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const DD_TONE: Record<DueDiligenceStatus, "success" | "warning" | "danger" | "info"> = {
  approved: "success",
  under_review: "warning",
  expired: "danger",
  conditional: "info",
  rejected: "danger",
};

const RISK_TONE = { low: "success", medium: "warning", high: "danger" } as const;

/** Counterparty due diligence — the brokers, custodians and agents the firm
 * transacts through.
 *
 * The finding this register exists to surface is the pairing of an expired
 * review with live exposure. Either alone is manageable; together they mean
 * the firm is carrying risk against a party nobody has looked at inside the
 * review cycle, which is a control failure regardless of whether anything is
 * actually wrong with the counterparty. */
export default function Counterparties() {
  const { data, loading } = useAsyncData(getCounterparties);
  const rows = data ?? [];

  const expiredWithExposure = rows.filter((c) => c.ddStatus === "expired" && c.exposureKes > 0);
  const underReview = rows.filter((c) => c.ddStatus === "under_review");
  const sanctionsHits = rows.filter((c) => !c.sanctionsClear);
  const totalExposure = rows.reduce((s, c) => s + c.exposureKes, 0);

  const columns: Column<Counterparty>[] = [
    { key: "name", header: "Counterparty", className: "min-w-[220px]", render: (r) => (
      <div>
        <div className="flex items-center gap-1.5 text-text font-medium">
          {r.name}
          {/* The note is a paragraph (often the rejection reason); it lives behind the icon. */}
          {r.note && <InfoTip text={r.note} />}
        </div>
        <div className="mt-0.5 text-xs text-text-faint">{COUNTERPARTY_TYPE_LABELS[r.type]} · {r.jurisdiction}</div>
      </div>
    ) },
    { key: "regulator", header: "Regulator", className: "whitespace-nowrap", render: (r) => <span className="text-xs text-text-soft">{r.regulator}</span>, hideOnMobile: true },
    { key: "dd", header: "Due diligence · risk", className: "whitespace-nowrap", render: (r) => (
      <div>
        <Badge tone={DD_TONE[r.ddStatus]}>{DD_STATUS_LABELS[r.ddStatus]}</Badge>
        <div className="mt-1"><Badge tone={RISK_TONE[r.riskRating]}>{r.riskRating} risk</Badge></div>
      </div>
    ) },
    { key: "review", header: "Review cycle", className: "whitespace-nowrap", render: (r) => (
      <div className="text-xs">
        <div className="text-text-soft tabular">{r.lastReviewedAt ? formatDate(r.lastReviewedAt) : "never"}</div>
        <div className={r.ddStatus === "expired" ? "mt-0.5 text-danger tabular" : "mt-0.5 text-text-faint tabular"}>
          {r.nextReviewDue === "—" ? "no further review" : `next ${formatDate(r.nextReviewDue)}`}
        </div>
      </div>
    ) },
    { key: "exposure", header: "Exposure", className: "text-right whitespace-nowrap", render: (r) => r.exposureKes > 0
      ? <span className="tabular"><Money amount={r.exposureKes} currency="KES" compact /></span>
      : <span className="text-text-faint text-xs">none</span> },
    { key: "sanctions", header: "Sanctions", className: "whitespace-nowrap", render: (r) => (
      <div>
        <Badge tone={r.sanctionsClear ? "success" : "danger"}>{r.sanctionsClear ? "Clear" : "Match"}</Badge>
        <div className="text-xs text-text-faint mt-1 tabular">{formatDate(r.sanctionsScreenedAt)}</div>
      </div>
    ) },
    { key: "note", header: "Note", className: "min-w-[240px]", render: (r) => r.note
      ? <span className="text-xs text-text-soft leading-relaxed line-clamp-2" title={r.note}>{r.note}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Institutional Investment Compliance"
        title="Counterparty due diligence"
        subtitle="Brokers, custodians and agents the firm transacts through — their review standing and the exposure carried against each."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Expired review, live exposure" value={expiredWithExposure.length} icon={<FileClock size={17} />} tone={expiredWithExposure.length ? "danger" : "success"} hint="risk carried against an unreviewed party" />
        <GlassStat label="Under review" value={underReview.length} icon={<Radar size={17} />} tone={underReview.length ? "warning" : "success"} hint="review reopened, exposure usually capped" />
        <GlassStat label="Sanctions matches" value={sanctionsHits.length} icon={<ShieldAlert size={17} />} tone={sanctionsHits.length ? "danger" : "success"} hint="unresolved screening hits" />
        <GlassStat label="Total exposure" value={<Money amount={totalExposure} currency="KES" compact />} icon={<Building2 size={17} />} tone="neutral" emphasis={false} hint="KES-equivalent across every counterparty" />
      </StatRail>

      {expiredWithExposure.length > 0 && (
        <NotePanel tone="danger" className="mb-5" title="Review lapsed with exposure outstanding">
          {expiredWithExposure.map((c) => `${c.name} — ${(c.exposureKes / 1_000_000).toFixed(0)}m KES`).join("; ")}.
          A lapsed review is a finding on its own terms. It does not become one only when the counterparty turns out
          to have a problem, because by then the review would not have been the control that caught it.
        </NotePanel>
      )}

      <SectionTitle
        title="Counterparty register"
        description="A rejected counterparty stays listed with the reason. It is the record that stops the same firm being re-proposed a year later without the earlier finding surfacing."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No counterparties" />
      </GlassPanel>
    </div>
  );
}
