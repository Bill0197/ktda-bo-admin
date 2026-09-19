import { getClientCrmProfile } from "../mock";
import {
  Badge, Skeleton, GlassPanel, GlassStat, StatRail, SectionTitle, EmptyState,
  DataTable, formatDate, type Column,
} from "../ui";
import { UserCheck, Layers, CalendarClock } from "lucide-react";
import { useAsyncData } from "../lib/useAsyncData";

type Profile = NonNullable<Awaited<ReturnType<typeof getClientCrmProfile>>>;
type HistoryRow = Profile["coverageHistory"][number] | Profile["segmentHistory"][number];

/** The commercial half of a client file: who covers them, what segment they
 * sit in, what servicing that segment promises, and when the next review is
 * due. Both assignments are dated windows, so the history is the record — a
 * handover never overwrites who held the relationship before it. */
export default function RelationshipPanel({ clientId }: { clientId: string }) {
  const { data, loading } = useAsyncData(() => getClientCrmProfile(clientId));

  if (loading) return <Skeleton className="h-64" />;
  if (!data) return <EmptyState title="No relationship record" body="This client has no coverage or segment assignment yet." />;

  const historyColumns: Column<HistoryRow & { id: string }>[] = [
    { key: "value", header: "Value", render: (r) => (
      <div className="flex items-center gap-2">
        <span className="text-text font-medium">{r.valueLabel}</span>
        {r.current && <Badge tone="success">current</Badge>}
      </div>
    ), className: "whitespace-nowrap" },
    { key: "from", header: "From", render: (r) => <span className="tabular">{formatDate(r.validFrom)}</span>, className: "whitespace-nowrap" },
    { key: "to", header: "Until", render: (r) => r.validTo
      ? <span className="tabular">{formatDate(r.validTo)}</span>
      : <span className="text-text-faint">open</span>, className: "whitespace-nowrap" },
    { key: "by", header: "Assigned by", render: (r) => <span className="text-text-soft">{r.assignedBy}</span>, hideOnMobile: true },
    { key: "reason", header: "Why it changed", render: (r) => r.reason
      ? <span className="text-xs text-text-soft">{r.reason}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true },
  ];

  const nextReview = data.reviews
    .filter((r) => !r.completedAt)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const overdue = nextReview ? nextReview.dueDate < new Date().toISOString().slice(0, 10) : false;

  return (
    <div className="flex flex-col gap-5">
      <StatRail columns={3}>
        <GlassStat
          label="Relationship owner"
          value={data.ownerLabel ?? <span className="text-text-faint text-lg">Pooled queue</span>}
          icon={<UserCheck size={17} />}
          tone="primary"
          emphasis={false}
          hint={data.ownerSince ? `since ${formatDate(data.ownerSince)}` : "no named owner — mass retail is serviced by the pooled queue"}
        />
        <GlassStat
          label="Commercial segment"
          value={data.segmentLabel ?? <span className="text-text-faint text-lg">Unsegmented</span>}
          icon={<Layers size={17} />}
          tone={data.segment ? "accent" : "warning"}
          emphasis={false}
          hint={data.serviceModel?.coverage}
        />
        <GlassStat
          label="Next servicing review"
          value={nextReview ? formatDate(nextReview.dueDate) : <span className="text-text-faint text-lg">None scheduled</span>}
          icon={<CalendarClock size={17} />}
          tone={overdue ? "danger" : nextReview ? "neutral" : "neutral"}
          emphasis={false}
          hint={
            nextReview
              ? `${overdue ? "Overdue · " : ""}${nextReview.ownerLabel}${nextReview.note ? ` · ${nextReview.note}` : ""}`
              : data.serviceModel?.reviewMonths
                ? `${data.serviceModel.reviewMonths}-monthly cadence, none booked yet`
                : "this segment carries no scheduled review"
          }
        />
      </StatRail>

      <div>
        <SectionTitle
          title="Coverage history"
          description="Every owner this relationship has had, and why it moved."
        />
        {data.coverageHistory.length ? (
          <GlassPanel className="p-1" sheen={false}>
            <DataTable columns={historyColumns} rows={data.coverageHistory} />
          </GlassPanel>
        ) : (
          <EmptyState title="Never assigned" body="Mass-retail clients are serviced by the pooled queue and carry no named owner." />
        )}
      </div>

      <div>
        <SectionTitle
          title="Segment history"
          description="Commercial segmentation over time — a separate axis from the AML risk band."
        />
        {data.segmentHistory.length ? (
          <GlassPanel className="p-1" sheen={false}>
            <DataTable columns={historyColumns} rows={data.segmentHistory} />
          </GlassPanel>
        ) : (
          <EmptyState title="Never segmented" body="No commercial segment has been assigned to this client." />
        )}
      </div>
    </div>
  );
}
