import { PRECLEARANCE_LABELS, type EmployeeTrade, type PreClearanceStatus } from "../../mock";
import { getEmployeeTrades } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, formatDateTime, type Column } from "../../ui";
import { UserRoundCheck, ShieldX, CalendarX2, Timer } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const CLEARANCE_TONE: Record<PreClearanceStatus, "warning" | "success" | "danger" | "neutral"> = {
  pending: "warning",
  approved: "success",
  declined: "danger",
  expired: "neutral",
};

/** Personal account (PA) dealing.
 *
 * Three standing rules — closed periods, the 30-day minimum holding period,
 * and no dealing against a declared conflict — and each is recorded as its own
 * outcome. A single "breach" badge would tell the reviewer nothing about which
 * rule broke, and the three rules have entirely different remedies.
 *
 * An approved request that was never used is not a breach. Executed and
 * approved are separate fields for that reason. */
export default function EmployeeTrading() {
  const { data, loading } = useAsyncData(getEmployeeTrades);
  const rows = data ?? [];

  const breaches = (t: EmployeeTrade) => {
    const b: string[] = [];
    if (!t.blackoutClear) b.push("Closed period");
    if (!t.minHoldClear) b.push("Min. holding");
    if (!t.conflictClear) b.push("Conflict");
    return b;
  };

  const pending = rows.filter((r) => r.preClearance === "pending");
  const executed = rows.filter((r) => r.executedAt);
  const withBreach = rows.filter((r) => breaches(r).length > 0);
  const dealtWithoutClearance = rows.filter((r) => r.executedAt && r.preClearance !== "approved");

  const columns: Column<EmployeeTrade>[] = [
    { key: "ref", header: "Reference", render: (r) => (
      <div>
        <div className="text-text font-medium tabular">{r.ref}</div>
        <div className="text-[11px] text-text-faint tabular">{formatDateTime(r.requestedAt)}</div>
      </div>
    ) },
    { key: "employee", header: "Employee", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.employee}</div>
        <div className="text-xs text-text-faint">{r.roleLabel}</div>
      </div>
    ) },
    { key: "instrument", header: "Instrument", render: (r) => (
      <div>
        <div className="text-text-soft text-sm">{r.instrument}</div>
        <div className="text-xs text-text-faint">{r.side === "buy" ? "Buy" : "Sell"} · {r.quantity.toLocaleString()}</div>
      </div>
    ) },
    { key: "value", header: "Value", render: (r) => <Money amount={r.valueKes} currency="KES" /> },
    { key: "clearance", header: "Pre-clearance", className: "whitespace-nowrap", render: (r) => <Badge tone={CLEARANCE_TONE[r.preClearance]}>{PRECLEARANCE_LABELS[r.preClearance]}</Badge> },
    { key: "executed", header: "Executed", render: (r) => r.executedAt
      ? <span className="tabular text-xs text-text-soft">{formatDateTime(r.executedAt)}</span>
      : <span className="text-text-faint text-xs">not dealt</span> },
    { key: "rules", header: "Rule outcomes", render: (r) => {
      const failed = breaches(r);
      if (!failed.length) return <Badge tone="success" className="whitespace-nowrap">All rules clear</Badge>;
      return (
        <div className="flex flex-wrap gap-1.5">
          {failed.map((f) => <Badge key={f} tone="danger" className="whitespace-nowrap">{f}</Badge>)}
        </div>
      );
    } },
    { key: "decidedBy", header: "Decided by", render: (r) => r.decidedBy
      ? <span className="text-xs text-text-soft">{r.decidedBy}</span>
      : <span className="text-text-faint text-xs">—</span>, hideOnMobile: true },
    { key: "note", header: "Note", render: (r) => r.note
      ? <span className="text-xs text-text-soft max-w-md block leading-relaxed">{r.note}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Market Conduct"
        title="Employee trading"
        tooltip="Personal account dealing — trades staff place for their own account, which must be pre-cleared and are checked against closed periods, a minimum holding period and their declared conflicts."
        subtitle="The personal account dealing register: what was requested, what was cleared, and what actually dealt."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Awaiting clearance" value={pending.length} icon={<Timer size={17} />} tone={pending.length ? "warning" : "success"} hint="requests with no decision yet" />
        <GlassStat label="Dealt" value={executed.length} icon={<UserRoundCheck size={17} />} tone="neutral" emphasis={false} hint={`of ${rows.length} requests on the register`} />
        <GlassStat label="Rule breaches" value={withBreach.length} icon={<ShieldX size={17} />} tone={withBreach.length ? "danger" : "success"} hint="closed period, holding period or conflict" />
        <GlassStat label="Dealt without clearance" value={dealtWithoutClearance.length} icon={<CalendarX2 size={17} />} tone={dealtWithoutClearance.length ? "danger" : "success"} hint="executed on a declined or lapsed approval" />
      </StatRail>

      {dealtWithoutClearance.length > 0 && (
        <NotePanel tone="danger" className="mb-5" title="Trades executed without a live approval">
          {dealtWithoutClearance.map((r) => `${r.ref} — ${r.employee}`).join("; ")}. Dealing on a declined or expired
          pre-clearance is a policy breach independent of whether the trade itself broke a rule, and it is the
          strongest evidence available to a market abuse investigation.
        </NotePanel>
      )}

      <NotePanel tone="info" className="mb-5" title="An unused approval is not a breach">
        Requests that were cleared and then left to expire show as &ldquo;Expired unused&rdquo; with no execution
        time. Counting them as dealing would overstate staff activity and bury the trades that actually happened.
      </NotePanel>

      <SectionTitle
        title="Pre-clearance register"
        description="Each of the three rules is reported separately, so a breach names which rule broke. Cross-check anything flagged here against the market abuse board — the same trade often appears on both."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No dealing requests" />
      </GlassPanel>
    </div>
  );
}
