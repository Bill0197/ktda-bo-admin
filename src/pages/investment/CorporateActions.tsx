import { CORPORATE_ACTION_LABELS, CORPORATE_ACTION_STATUS_LABELS, type CorporateAction, type CorporateActionStatus } from "../../mock";
import { getCorporateActions } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, formatDate, type Column } from "../../ui";
import { CalendarClock, Vote, TriangleAlert, Banknote } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE: Record<CorporateActionStatus, "info" | "success" | "neutral" | "danger"> = {
  announced: "info",
  confirmed: "success",
  processed: "neutral",
  disputed: "danger",
};

/** Corporate actions — what the issuers are doing to the instruments held.
 *
 * The distinction that drives the page is `electionRequired`. A coupon happens
 * to the fund whether anyone reads this screen or not; a call or a tap issue
 * needs an instruction by a date, and a missed election window is a decision
 * made by inaction. Those rows are surfaced separately for that reason. */
export default function CorporateActions() {
  const { data, loading } = useAsyncData(getCorporateActions);
  const rows = data ?? [];

  const pendingElections = rows.filter((r) => r.electionRequired && r.status !== "processed");
  const disputed = rows.filter((r) => r.status === "disputed");
  const upcoming = rows.filter((r) => r.status === "announced" || r.status === "confirmed");
  const kesIncome = rows.filter((r) => r.currency === "KES" && r.status !== "disputed").reduce((s, r) => s + (r.grossAmount - r.withholdingTax), 0);

  const columns: Column<CorporateAction>[] = [
    { key: "ref", header: "Reference", render: (r) => (
      <div>
        <div className="text-text font-medium tabular">{r.ref}</div>
        <Badge tone="info" className="mt-1 whitespace-nowrap">{CORPORATE_ACTION_LABELS[r.type]}</Badge>
      </div>
    ) },
    { key: "instrument", header: "Instrument", render: (r) => (
      <div>
        <div className="text-text-soft text-sm">{r.instrument}</div>
        <div className="text-[11px] text-text-faint tabular">{r.isin}</div>
      </div>
    ) },
    { key: "dates", header: "Ex → pay", render: (r) => (
      <span className="tabular text-xs text-text-soft">{formatDate(r.exDate)} → {formatDate(r.payDate)}</span>
    ) },
    { key: "amount", header: "Gross", render: (r) => r.grossAmount > 0
      ? <Money amount={r.grossAmount} currency={r.currency} compact />
      : <span className="text-text-faint text-xs">no cash flow</span> },
    { key: "wht", header: "Withholding tax", render: (r) => r.grossAmount === 0
      ? <span className="text-text-faint text-xs">n/a</span>
      : <Money amount={r.withholdingTax} currency={r.currency} />, hideOnMobile: true },
    { key: "election", header: "Election", className: "whitespace-nowrap", render: (r) => {
      if (!r.electionRequired) return <span className="text-xs text-text-faint">not required</span>;
      return (
        <div>
          <Badge tone={r.status === "processed" ? "neutral" : "warning"}>Instruction needed</Badge>
          {r.electionDue && <div className="text-[11px] text-text-faint mt-1 tabular">by {formatDate(r.electionDue)}</div>}
        </div>
      );
    } },
    { key: "status", header: "Status", className: "whitespace-nowrap", render: (r) => <Badge tone={STATUS_TONE[r.status]}>{CORPORATE_ACTION_STATUS_LABELS[r.status]}</Badge> },
    { key: "note", header: "Note", render: (r) => r.note
      ? <span className="text-xs text-text-soft max-w-lg block leading-relaxed">{r.note}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Investment Management"
        title="Corporate actions"
        subtitle="Coupons, maturities, calls and tap issues on the instruments the fund holds — and the ones that need an instruction."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Elections outstanding" value={pendingElections.length} icon={<Vote size={17} />} tone={pendingElections.length ? "warning" : "success"} hint="need an instruction before the window closes" />
        <GlassStat label="Upcoming events" value={upcoming.length} icon={<CalendarClock size={17} />} tone="neutral" emphasis={false} hint="announced or confirmed, not yet processed" />
        <GlassStat label="Disputed" value={disputed.length} icon={<TriangleAlert size={17} />} tone={disputed.length ? "danger" : "success"} hint="custodian and expectation disagree" />
        <GlassStat label="KES net income" value={<Money amount={kesIncome} currency="KES" compact />} icon={<Banknote size={17} />} tone="neutral" emphasis={false} hint="gross less withholding, undisputed events" />
      </StatRail>

      {pendingElections.length > 0 && (
        <NotePanel tone="warning" className="mb-5" title="Election windows open">
          {pendingElections.map((r) => `${r.ref} — ${r.instrument}${r.electionDue ? ` (by ${r.electionDue})` : ""}`).join("; ")}.
          Letting a window lapse is itself a decision, and it is one nobody has taken deliberately. Raise the
          instruction, or record the decision not to participate.
        </NotePanel>
      )}

      <SectionTitle
        title="Corporate action calendar"
        description="Infrastructure bond coupons show a genuine zero withholding tax — the exemption is real, not an unpopulated field. Events with no cash flow say so rather than showing KES 0."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No corporate actions" />
      </GlassPanel>
    </div>
  );
}
