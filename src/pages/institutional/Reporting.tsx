import { REPORT_DELIVERY_LABELS, type InstitutionalReport, type ReportDelivery } from "../../mock";
import { getInstitutionalReports } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, InfoTip, formatDate, type Column } from "../../ui";
import { Send, Landmark, FileClock, CircleCheck } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const DELIVERY_TONE: Record<ReportDelivery, "success" | "warning" | "danger" | "neutral"> = {
  on_time: "success",
  due: "warning",
  overdue: "danger",
  scheduled: "neutral",
};

const OBLIGATION_LABEL = { regulatory: "Regulatory", contractual: "Contractual", service: "Service standard" } as const;
const OBLIGATION_TONE = { regulatory: "danger", contractual: "warning", service: "neutral" } as const;

/** Institutional reporting — what the firm owes each client, and when.
 *
 * Obligation type is not decoration. A late regulatory return exposes the
 * *client* to their own regulator; a late service report is an internal
 * standard. Both show as overdue, and conflating them would put the same
 * urgency on two very different failures. */
export default function Reporting() {
  const { data, loading } = useAsyncData(getInstitutionalReports);
  const rows = data ?? [];

  const overdue = rows.filter((r) => r.delivery === "overdue");
  const overdueRegulatory = overdue.filter((r) => r.obligation === "regulatory");
  const due = rows.filter((r) => r.delivery === "due");
  const onTime = rows.filter((r) => r.delivery === "on_time");

  const columns: Column<InstitutionalReport>[] = [
    { key: "name", header: "Report", className: "min-w-[220px]", render: (r) => (
      <div>
        <div className="flex items-center gap-1.5 text-text font-medium leading-snug">
          {r.name}
          {r.note && <InfoTip text={r.note} />}
        </div>
        <div className="mt-0.5 text-xs text-text-faint">{r.clientName}</div>
      </div>
    ) },
    // What obliges the report, then how often and in what form it goes out.
    { key: "obligation", header: "Obligation · cadence", className: "whitespace-nowrap", render: (r) => (
      <div>
        <Badge tone={OBLIGATION_TONE[r.obligation]}>{OBLIGATION_LABEL[r.obligation]}</Badge>
        <div className="mt-1 text-xs text-text-faint">{r.frequency} · {r.format}</div>
      </div>
    ) },
    { key: "due", header: "Due · last delivered", className: "whitespace-nowrap", render: (r) => (
      <div className="text-xs">
        <div className="tabular text-text-soft">{formatDate(r.dueDate)}</div>
        {r.lastSentAt
          ? <div className="tabular text-text-faint">last {formatDate(r.lastSentAt)}</div>
          : <div className="text-text-faint">never sent</div>}
      </div>
    ) },
    { key: "delivery", header: "Status", className: "whitespace-nowrap", render: (r) => <Badge tone={DELIVERY_TONE[r.delivery]}>{REPORT_DELIVERY_LABELS[r.delivery]}</Badge> },
    { key: "owner", header: "Owner", className: "whitespace-nowrap", render: (r) => <span className="text-xs text-text-soft">{r.owner}</span>, hideOnMobile: true },
    { key: "note", header: "Note", render: (r) => r.note
      ? <span className="text-xs text-text-soft max-w-md block leading-relaxed">{r.note}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Institutional Funds"
        title="Institutional reporting"
        subtitle="Every report the firm owes an institutional client, what obliges it, and whether it went out on time."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Overdue" value={overdue.length} icon={<FileClock size={17} />} tone={overdue.length ? "danger" : "success"} hint="past the due date and not delivered" />
        <GlassStat label="Regulatory overdue" value={overdueRegulatory.length} icon={<Landmark size={17} />} tone={overdueRegulatory.length ? "danger" : "success"} hint="exposes the client to their own regulator" />
        <GlassStat label="Due now" value={due.length} icon={<Send size={17} />} tone={due.length ? "warning" : "success"} hint="in the current delivery window" />
        <GlassStat label="Delivered on time" value={onTime.length} icon={<CircleCheck size={17} />} tone="neutral" emphasis={false} hint="most recent cycle" />
      </StatRail>

      {overdueRegulatory.length > 0 && (
        <NotePanel tone="danger" className="mb-5" title="Regulatory returns overdue">
          {overdueRegulatory.map((r) => `${r.name} — ${r.clientName}`).join("; ")}. These are filings the client
          makes to their own regulator using our data. A delay on our side becomes a breach on theirs, and holding a
          return back to avoid reporting an awkward position does not remove the obligation to file it.
        </NotePanel>
      )}

      <SectionTitle
        title="Reporting obligations"
        description="A report that has never been sent shows &ldquo;never&rdquo; rather than a blank date — for a one-off closing report that is correct and expected; for a recurring one it is the finding."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No reporting obligations" />
      </GlassPanel>
    </div>
  );
}
