import { getBdKpis, getRecentInteractions, getCoverageBook } from "../lib/api";
import {
  PageHeader, Badge, Skeleton, GlassPanel, StatRail, SectionTitle, NotePanel,
  DistributionBars, formatDateTime,
} from "../ui";
import { CircleHelp } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";

/** The BD SOP's own KPI list: "response time, KYC turnaround, transaction
 * accuracy, redemption turnaround, complaints, client satisfaction, RFP
 * conversion and onboarding cycle time."
 *
 * Only the ones this platform can honestly compute are computed. The rest
 * render as an explicit gap with the reason — a dashboard that invents a
 * client-satisfaction score because the tile looked empty is worse than one
 * that says where the number would have to come from. Four of the ten are
 * currently unavailable, and that is the finding, not a rendering bug. */
export default function BdPerformance() {
  const { role } = useAuth();
  const { data: kpis, loading } = useAsyncData(getBdKpis);
  // Head of BD and BD Officer reach this page and are not Compliance, so the
  // activity feed redacts for them too. Passed explicitly rather than relying
  // on the route check staying correct.
  const canSeeComplianceDetail = role === "compliance" || role === "mlro" || role === "system_admin";
  const { data: interactions } = useAsyncData(() => getRecentInteractions(8, canSeeComplianceDetail));
  const { data: book } = useAsyncData(getCoverageBook);

  if (loading) return <Skeleton className="h-96" />;

  const available = (kpis ?? []).filter((k) => k.value !== null);
  const unavailable = (kpis ?? []).filter((k) => k.value === null);

  return (
    <div>
      <PageHeader
        title="BD performance"
        tooltip="Turnaround metrics are measured in business days, matching how the SOP states its service standards."
        subtitle="The Business Development SOP's KPI set, computed where the platform can and marked as a gap where it cannot."
      />

      <StatRail columns={3} className="mb-6">
        {available.map((k) => {
          const meetsTarget =
            k.target === undefined || k.value === null
              ? null
              : k.direction === "lower_better" ? k.value <= k.target : k.value >= k.target;
          return (
            <GlassPanel key={k.key} className="p-5 flex flex-col gap-2 lift">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-faint">{k.label}</span>
                {meetsTarget !== null && (
                  <Badge tone={meetsTarget ? "success" : "warning"}>{meetsTarget ? "On target" : "Off target"}</Badge>
                )}
              </div>
              <div className={`text-[26px] leading-none font-display font-semibold tabular ${
                meetsTarget === false ? "text-warning" : "text-text"
              }`}>
                {k.value}
                <span className="text-sm font-sans font-normal text-text-faint ml-1.5">{k.unit}</span>
              </div>
              <div className="text-xs text-text-faint mt-1">
                {k.target !== undefined && (
                  <span className="block">Target {k.direction === "lower_better" ? "\u2264" : "\u2265"} {k.target} {k.unit}</span>
                )}
                <span className="block mt-0.5">Source: {k.source}</span>
              </div>
            </GlassPanel>
          );
        })}
      </StatRail>

      {unavailable.length > 0 && (
        <NotePanel
          tone="warning"
          icon={<CircleHelp size={16} className="text-warning" />}
          title={`Named in the SOP, not computable here (${unavailable.length})`}
          className="mb-6"
        >
          <div className="flex flex-col gap-3 mt-2">
            {unavailable.map((k) => (
              <div key={k.key} className="rounded-lg border border-border bg-surface/60 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                  <span className="text-[13px] font-medium text-text">{k.label}</span>
                  <span className="text-xs text-text-faint">would come from: {k.source}</span>
                </div>
                <p className="text-xs text-text-soft leading-relaxed">{k.unavailableReason}</p>
              </div>
            ))}
          </div>
        </NotePanel>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle title="Recent activity" description="The most recent logged interactions across every relationship." />
          <GlassPanel className="p-5">
            {interactions?.length ? (
              <div className="flex flex-col gap-3">
                {interactions.map((i) => (
                  <div key={i.id} className="flex gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-text">{i.summary}</div>
                      <div className="text-[11px] text-text-faint mt-0.5">
                        {i.typeLabel} · {i.byName} · {i.subjectType} {i.subjectId}
                      </div>
                    </div>
                    <span className="text-[11px] text-text-faint tabular shrink-0">{formatDateTime(i.occurredAt)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-text-faint">No interactions logged.</p>
            )}
          </GlassPanel>
        </div>

        <div>
          <SectionTitle title="Book by segment" description="Commercial segmentation, not the AML risk band." />
          <GlassPanel className="p-5">
            <DistributionBars
              rows={Object.entries(
                (book ?? []).reduce<Record<string, number>>((acc, r) => {
                  const key = r.segmentLabel ?? "Unsegmented";
                  acc[key] = (acc[key] ?? 0) + 1;
                  return acc;
                }, {}),
              )
                .sort((a, b) => b[1] - a[1])
                .map(([label, value]) => ({
                  label,
                  value,
                  tone: label === "Unsegmented" ? ("warning" as const) : ("primary" as const),
                }))}
            />
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
