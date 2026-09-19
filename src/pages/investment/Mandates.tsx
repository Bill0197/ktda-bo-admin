import type { InvestmentMandate } from "../../mock";
import { getInvestmentMandates } from "../../lib/api";
import { PageHeader, Badge, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Card, formatDate } from "../../ui";
import { FileSignature, CalendarCheck2, ShieldCheck, TriangleAlert } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE = { active: "success", under_review: "warning", superseded: "neutral" } as const;
const STATUS_LABEL = { active: "Active", under_review: "Under review", superseded: "Superseded" } as const;
const LIMIT_TONE = { within: "success", near: "warning", breach: "danger" } as const;
const LIMIT_LABEL = { within: "Within", near: "Near limit", breach: "Breach" } as const;

/** Investment mandates — the fund-level constraints the book is run against.
 *
 * Rendered as cards rather than a table because a mandate is a document with a
 * variable number of limits, and flattening it into rows loses the thing that
 * matters: which constraints belong to which fund. A superseded version stays
 * listed, since "what were we allowed to do in June" is a question the current
 * version cannot answer. */
export default function Mandates() {
  const { data, loading } = useAsyncData(getInvestmentMandates);
  const rows = data ?? [];

  const active = rows.filter((m) => m.status === "active");
  const underReview = rows.filter((m) => m.status === "under_review");
  const allLimits = active.flatMap((m) => m.limits);
  const nearOrBreach = allLimits.filter((l) => l.status !== "within");
  const breaches = allLimits.filter((l) => l.status === "breach");

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Investment Management"
        title="Investment mandates"
        subtitle="What each fund is permitted to hold, and where the book currently sits against those limits."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Active mandates" value={active.length} icon={<FileSignature size={17} />} tone="primary" emphasis={false} hint={`${rows.length} versions on file including superseded`} />
        <GlassStat label="Limits monitored" value={allLimits.length} icon={<ShieldCheck size={17} />} tone="neutral" emphasis={false} hint="across every active mandate" />
        <GlassStat label="Near limit or through" value={nearOrBreach.length} icon={<TriangleAlert size={17} />} tone={breaches.length ? "danger" : nearOrBreach.length ? "warning" : "success"} hint={`${breaches.length} through the limit`} />
        <GlassStat label="Under review" value={underReview.length} icon={<CalendarCheck2 size={17} />} tone={underReview.length ? "warning" : "neutral"} emphasis={false} hint="draft or amendment not yet approved" />
      </StatRail>

      <NotePanel tone="info" className="mb-5" title="Fund mandates, not client mandates">
        These constrain the pooled funds. Segregated institutional clients each have their own Investment Management
        Agreement with client-specific restrictions — those live under Institutional Funds, and breaching one is a
        contractual matter with the client rather than an internal limit excursion.
      </NotePanel>

      <SectionTitle
        title="Mandate register"
        description="A superseded version keeps its limits. Answering what the mandate permitted at a past date is impossible if only the current version survives."
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {rows.map((m: InvestmentMandate) => (
          <GlassPanel key={m.id} className="p-5" sheen={m.status === "active"}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text">{m.fund}</div>
                <div className="text-[11px] text-text-faint tabular mt-0.5">{m.ref} · v{m.version}</div>
              </div>
              <Badge tone={STATUS_TONE[m.status]} className="whitespace-nowrap shrink-0">{STATUS_LABEL[m.status]}</Badge>
            </div>

            <p className="text-[13px] text-text-soft leading-relaxed mb-4">{m.objective}</p>

            <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
              <div>
                <div className="text-text-faint uppercase tracking-wide text-[10px] font-semibold mb-0.5">Benchmark</div>
                <div className="text-text-soft">{m.benchmark}</div>
              </div>
              <div>
                <div className="text-text-faint uppercase tracking-wide text-[10px] font-semibold mb-0.5">Owner</div>
                <div className="text-text-soft">{m.owner}</div>
              </div>
              <div>
                <div className="text-text-faint uppercase tracking-wide text-[10px] font-semibold mb-0.5">Approved</div>
                <div className="text-text-soft tabular">{m.approvedAt === "—" ? "not approved" : formatDate(m.approvedAt)}</div>
              </div>
              <div>
                <div className="text-text-faint uppercase tracking-wide text-[10px] font-semibold mb-0.5">Review due</div>
                <div className="text-text-soft tabular">{m.reviewDue === "—" ? "n/a" : formatDate(m.reviewDue)}</div>
              </div>
            </div>

            <Card className="p-0 bg-surface-sunken border-none overflow-hidden">
              <ul className="divide-y divide-border">
                {m.limits.map((l) => (
                  <li key={l.label} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[13px] text-text">{l.label}</div>
                      <div className="text-[11px] text-text-faint">{l.limit}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="tabular text-[13px] text-text">{l.current}</div>
                      {m.status === "active" && (
                        <Badge tone={LIMIT_TONE[l.status]} className="mt-1 whitespace-nowrap">{LIMIT_LABEL[l.status]}</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}
