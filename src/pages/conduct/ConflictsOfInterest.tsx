import { CONFLICT_CATEGORY_LABELS, CONFLICT_STATUS_LABELS, type ConflictDeclaration, type ConflictStatus } from "../../mock";
import { getConflictDeclarations } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, InfoTip, formatDate, type Column } from "../../ui";
import { Handshake, ClockAlert, ShieldBan, ClipboardList } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE: Record<ConflictStatus, "neutral" | "info" | "success" | "danger" | "warning"> = {
  declared: "info",
  under_review: "warning",
  approved_with_controls: "success",
  prohibited: "danger",
  lapsed: "warning",
};

/** The conflicts of interest register.
 *
 * A conflict is not a breach — declaring one is the control working. What
 * matters is whether each declaration has been reviewed, what mitigation was
 * imposed, and whether the annual re-declaration is still current. A lapsed
 * declaration is worse than a new one: the interest still exists, but the
 * mitigation attached to it no longer has a live authority behind it. */
export default function ConflictsOfInterest() {
  const { data, loading } = useAsyncData(getConflictDeclarations);
  const rows = data ?? [];

  const awaitingReview = rows.filter((r) => r.status === "declared" || r.status === "under_review");
  const lapsed = rows.filter((r) => r.status === "lapsed");
  const prohibited = rows.filter((r) => r.status === "prohibited");
  const withControls = rows.filter((r) => r.status === "approved_with_controls");

  const columns: Column<ConflictDeclaration>[] = [
    { key: "ref", header: "Reference · declared", render: (r) => (
      <div className="whitespace-nowrap">
        <div className="text-text font-medium tabular">{r.ref}</div>
        <div className="mt-0.5 text-xs text-text-faint tabular">{formatDate(r.declaredAt)}</div>
      </div>
    ) },
    { key: "declaredBy", header: "Declared by", className: "min-w-[140px]", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.declaredBy}</div>
        <div className="mt-0.5 text-xs text-text-faint">{r.roleLabel}</div>
      </div>
    ) },
    // Only gifts and hospitality carry a value, so it sits under the category rather than in a mostly-"n/a" column.
    { key: "category", header: "Category · value", className: "whitespace-nowrap", render: (r) => (
      <div>
        <Badge tone="info">{CONFLICT_CATEGORY_LABELS[r.category]}</Badge>
        <div className="mt-1 text-xs tabular">
          {r.valueKes === undefined
            ? <span className="text-text-faint">n/a</span>
            : <span className="text-text-soft"><Money amount={r.valueKes} currency="KES" /></span>}
        </div>
      </div>
    ) },
    { key: "description", header: "Interest", className: "min-w-[180px]", render: (r) => (
      <div>
        <div className="text-xs text-text-soft leading-relaxed line-clamp-2" title={r.description}>{r.description}</div>
        <div className="text-xs text-text-faint mt-0.5 line-clamp-1" title={r.relatedParty}>Related party: {r.relatedParty}</div>
      </div>
    ) },
    // The mitigation is the substance of the decision; it sits behind the icon next to the status it explains.
    { key: "status", header: "Status · reviewed by", className: "whitespace-nowrap", render: (r) => (
      <div>
        <div className="flex items-center gap-1.5">
          <Badge tone={STATUS_TONE[r.status]}>{CONFLICT_STATUS_LABELS[r.status]}</Badge>
          {r.mitigation && <span className="whitespace-normal"><InfoTip text={r.mitigation} /></span>}
        </div>
        <div className="mt-1 text-xs">
          {r.reviewedBy ? <span className="text-text-soft">{r.reviewedBy}</span> : <span className="text-warning font-medium">Not reviewed</span>}
        </div>
      </div>
    ) },
    { key: "mitigation", header: "Mitigation", className: "min-w-[240px]", render: (r) => r.mitigation
      ? <span className="text-xs text-text-soft leading-relaxed line-clamp-2" title={r.mitigation}>{r.mitigation}</span>
      : <span className="text-text-faint text-xs">none recorded</span>, hideOnMobile: true, defaultHidden: true },
    { key: "reviewDue", header: "Re-declaration due", className: "whitespace-nowrap", render: (r) => r.reviewDue
      ? <span className="tabular text-xs text-text-soft">{formatDate(r.reviewDue)}</span>
      : <span className="text-text-faint text-xs">—</span>, hideOnMobile: true, defaultHidden: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Market Conduct"
        title="Conflicts of interest"
        subtitle="Every declared interest, what was decided about it, and whether that decision is still current."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Awaiting review" value={awaitingReview.length} icon={<ClipboardList size={17} />} tone={awaitingReview.length ? "warning" : "success"} hint="declared but not yet decided" />
        <GlassStat label="Permitted with controls" value={withControls.length} icon={<Handshake size={17} />} tone="neutral" emphasis={false} hint="live interests carrying a mitigation" />
        <GlassStat label="Lapsed" value={lapsed.length} icon={<ClockAlert size={17} />} tone={lapsed.length ? "danger" : "success"} hint="annual re-declaration overdue" />
        <GlassStat label="Prohibited" value={prohibited.length} icon={<ShieldBan size={17} />} tone={prohibited.length ? "warning" : "neutral"} emphasis={false} hint="refused, or required to be unwound" />
      </StatRail>

      {lapsed.length > 0 && (
        <NotePanel tone="danger" className="mb-5" title={`${lapsed.length} lapsed declaration${lapsed.length === 1 ? "" : "s"}`}>
          {lapsed.map((r) => `${r.ref} — ${r.declaredBy}`).join("; ")}. The underlying interest has not gone away;
          only the authority permitting it has expired. Chase the re-declaration rather than treating the entry as
          historical.
        </NotePanel>
      )}

      <NotePanel tone="info" className="mb-5" title="Declaring is the control, not the offence">
        A full register with active mitigations reads better than an empty one. The findings on this page are the
        entries that were never reviewed, and the ones whose review has expired — not the number of declarations.
      </NotePanel>

      <SectionTitle
        title="Register"
        description="Gifts and hospitality carry a value because the KES 25,000 acceptance threshold is what escalates them; every other category carries none, and shows &ldquo;n/a&rdquo; rather than a misleading zero."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable newest={(r) => r.declaredAt} columns={columns} rows={rows} columnPicker emptyLabel="No declarations on the register" />
      </GlassPanel>
    </div>
  );
}
