import { IC_KIND_LABELS, type IcApprovalItem } from "../../mock";
import { getIcApprovalQueue } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, InfoTip, formatDate, formatDateTime, type Column } from "../../ui";
import { Vote, Users, CircleCheck, CircleX } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE = { pending: "warning", approved: "success", rejected: "danger", withdrawn: "neutral" } as const;
const STATUS_LABEL = { pending: "Pending", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn" } as const;

/** Every member's vote by name, dissent included — the record a tally alone would lose. */
const voteRoll = (r: IcApprovalItem) => r.votes.map((v) => `${v.member} — ${v.vote}`).join("; ");

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
    { key: "title", header: "Decision", className: "min-w-[260px]", render: (r) => (
      <div>
        <div className="text-text font-medium leading-snug">
          {r.title}
          {/* The case for the decision is a paragraph; it sits behind the icon. */}
          <span className="ml-1.5 inline-flex align-middle"><InfoTip text={r.detail} /></span>
        </div>
        <div className="mt-0.5 text-xs text-text-faint"><span className="tabular">{r.ref}</span> · {IC_KIND_LABELS[r.kind]}</div>
      </div>
    ) },
    { key: "detail", header: "Detail", render: (r) => <span className="text-xs text-text-soft max-w-md block leading-relaxed">{r.detail}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "amount", header: "Amount · portfolio", className: "min-w-[170px]", render: (r) => (
      <div>
        <div className="whitespace-nowrap">
          {r.amount === null
            ? <span className="text-text-faint text-xs">no cash amount</span>
            : <Money amount={r.amount} currency={r.currency} compact className="text-text" />}
        </div>
        <div className="mt-0.5 text-xs text-text-faint">{r.portfolio}</div>
      </div>
    ) },
    { key: "votes", header: "Votes vs. quorum", className: "whitespace-nowrap", render: (r) => {
      const met = r.votes.length >= r.quorum;
      const tally = (["for", "against", "abstain"] as const)
        .map((v) => [v, r.votes.filter((x) => x.vote === v).length] as const)
        .filter(([, n]) => n > 0)
        .map(([v, n]) => `${n} ${v}`)
        .join(" · ");
      return (
        <div>
          <div className="flex items-center gap-1.5">
            <span className={met ? "tabular text-success font-medium" : "tabular text-warning font-medium"}>
              {r.votes.length} of {r.quorum}
            </span>
            {r.votes.length > 0 && <InfoTip text={voteRoll(r)} />}
          </div>
          {r.votes.length > 0 && <div className="mt-0.5 text-xs text-text-faint">{tally}</div>}
          {r.votes.length === 0 && r.status === "pending" && (
            <div className="mt-0.5 text-xs text-text-faint">no votes cast</div>
          )}
        </div>
      );
    } },
    { key: "roll", header: "Votes cast", render: (r) => r.votes.length > 0
      ? <span className="text-xs text-text-soft max-w-xs block leading-relaxed">{voteRoll(r)}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
    { key: "status", header: "Status · due", className: "whitespace-nowrap", render: (r) => (
      <div>
        <Badge tone={STATUS_TONE[r.status]} className="whitespace-nowrap">{STATUS_LABEL[r.status]}</Badge>
        {r.dueBy && <div className="mt-1 text-xs text-text-soft">due <span className="tabular">{formatDate(r.dueBy)}</span></div>}
      </div>
    ) },
    { key: "proposed", header: "Proposed", className: "whitespace-nowrap", render: (r) => (
      <div className="text-xs">
        <div className="text-text-soft">{r.proposedBy}</div>
        <div className="text-text-faint tabular">{formatDateTime(r.proposedAt)}</div>
      </div>
    ), hideOnMobile: true },
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
