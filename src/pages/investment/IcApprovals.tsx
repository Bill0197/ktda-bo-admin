import { IC_KIND_LABELS, type IcApprovalItem } from "../../mock";
import { getIcApprovalQueue } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, formatDate, formatDateTime, type Column } from "../../ui";
import { Vote, Users, CircleCheck, CircleX } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE = { pending: "warning", approved: "success", rejected: "danger", withdrawn: "neutral" } as const;
const STATUS_LABEL = { pending: "Pending", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn" } as const;

/** The Investment Committee approval queue.
 *
 * Not the same control as `/approvals`. That queue is maker-checker: one
 * proposer, one approver. This one is a committee vote with a quorum, so an
 * item with two votes and a quorum of three is not "waiting on someone" — it
 * is undecidable until a third member votes. Showing votes against quorum,
 * rather than a pending badge, is the difference. */
export default function IcApprovals() {
  const { data, loading } = useAsyncData(getIcApprovalQueue);
  const rows = data ?? [];

  const pending = rows.filter((r) => r.status === "pending");
  const belowQuorum = pending.filter((r) => r.votes.length < r.quorum);
  const approved = rows.filter((r) => r.status === "approved").length;
  const rejected = rows.filter((r) => r.status === "rejected").length;

  const columns: Column<IcApprovalItem>[] = [
    { key: "ref", header: "Reference", render: (r) => (
      <div>
        <div className="text-text font-medium tabular">{r.ref}</div>
        <Badge tone="info" className="mt-1 whitespace-nowrap">{IC_KIND_LABELS[r.kind]}</Badge>
      </div>
    ) },
    { key: "title", header: "Decision", render: (r) => (
      <div className="max-w-xl">
        <div className="text-text font-medium">{r.title}</div>
        <div className="text-xs text-text-soft mt-1 leading-relaxed">{r.detail}</div>
        <div className="text-[11px] text-text-faint mt-1">{r.portfolio}</div>
      </div>
    ) },
    { key: "amount", header: "Amount", render: (r) => r.amount === null
      ? <span className="text-text-faint text-xs">no cash amount</span>
      : <Money amount={r.amount} currency={r.currency} compact /> },
    { key: "votes", header: "Votes vs. quorum", className: "whitespace-nowrap", render: (r) => {
      const met = r.votes.length >= r.quorum;
      return (
        <div>
          <span className={met ? "tabular text-success font-medium" : "tabular text-warning font-medium"}>
            {r.votes.length} of {r.quorum}
          </span>
          {r.votes.length > 0 && (
            <div className="text-[11px] text-text-faint mt-1 leading-snug">
              {r.votes.map((v) => `${v.member} — ${v.vote}`).join("; ")}
            </div>
          )}
          {r.votes.length === 0 && r.status === "pending" && (
            <div className="text-[11px] text-text-faint mt-1">no votes cast</div>
          )}
        </div>
      );
    } },
    { key: "status", header: "Status", className: "whitespace-nowrap", render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
    { key: "proposed", header: "Proposed", render: (r) => (
      <div className="text-xs">
        <div className="text-text-soft">{r.proposedBy}</div>
        <div className="text-text-faint tabular">{formatDateTime(r.proposedAt)}</div>
      </div>
    ), hideOnMobile: true },
    { key: "due", header: "Decision due", render: (r) => r.dueBy
      ? <span className="tabular text-xs text-text-soft">{formatDate(r.dueBy)}</span>
      : <span className="text-text-faint text-xs">—</span>, hideOnMobile: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Investment Management"
        title="Investment Committee approval queue"
        tooltip="Decisions above the dealer's own authority — large trades, new issue participation, limit breach ratification, counterparty and mandate changes."
        subtitle="What the Committee has been asked to decide, and how far each item is from a quorum."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Pending decisions" value={pending.length} icon={<Vote size={17} />} tone={pending.length ? "warning" : "success"} hint="raised and not yet decided" />
        <GlassStat label="Below quorum" value={belowQuorum.length} icon={<Users size={17} />} tone={belowQuorum.length ? "warning" : "success"} hint="cannot be decided until more members vote" />
        <GlassStat label="Approved" value={approved} icon={<CircleCheck size={17} />} tone="neutral" emphasis={false} hint="carried by the Committee" />
        <GlassStat label="Rejected" value={rejected} icon={<CircleX size={17} />} tone="neutral" emphasis={false} hint="a rejection is a recorded decision, not a gap" />
      </StatRail>

      <NotePanel tone="info" className="mb-5" title="The manager proposes, the Committee decides">
        Everything on this queue was raised by the Investment Manager, who holds no vote on it. That separation is
        why the Investment Manager role reaches this page but not the maker-checker Approvals queue — proposing and
        approving the same instruction would remove the control entirely.
      </NotePanel>

      <SectionTitle
        title="Committee queue"
        description="Votes are shown individually, including dissent. A decision carried two-to-one is a materially different record from a unanimous one, and only the vote list preserves that."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="Nothing before the Committee" />
      </GlassPanel>
    </div>
  );
}
