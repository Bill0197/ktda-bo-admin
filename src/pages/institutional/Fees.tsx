import { FEE_STRUCTURE_LABELS, type FeeSchedule } from "../../mock";
import { getFeeSchedules } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, formatDate, type Column } from "../../ui";
import { Percent, Receipt, Trophy, CalendarClock } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

/** Fee schedules — what each institutional mandate is billed, and on what basis.
 *
 * Flat and tiered schedules cannot be compared by their headline rate, so the
 * effective rate on current AUM is computed and shown alongside. That is the
 * only number that answers "which client are we cheapest to" without the
 * reader having to reconstruct a tier ladder in their head. */
export default function Fees() {
  const { data, loading } = useAsyncData(getFeeSchedules);
  const rows = data ?? [];

  const kesAccrued = rows.filter((f) => f.currency === "KES").reduce((s, f) => s + f.accruedAmount, 0);
  const withPerformance = rows.filter((f) => f.performanceFeePct !== null);
  const kesRows = rows.filter((f) => f.currency === "KES");
  const avgBps = kesRows.length ? kesRows.reduce((s, f) => s + f.effectiveBps, 0) / kesRows.length : 0;
  const neverInvoiced = rows.filter((f) => f.lastInvoicedAt === null);

  const columns: Column<FeeSchedule>[] = [
    { key: "client", header: "Client", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.clientName}</div>
        <div className="text-[11px] text-text-faint tabular">{r.mandateRef}</div>
      </div>
    ) },
    { key: "structure", header: "Structure", className: "whitespace-nowrap", render: (r) => <Badge tone="info">{FEE_STRUCTURE_LABELS[r.structure]}</Badge> },
    { key: "rate", header: "Basis", render: (r) => <span className="text-xs text-text-soft max-w-sm block leading-relaxed">{r.rateDescription}</span> },
    { key: "effective", header: "Effective rate", render: (r) => (
      <div>
        <span className="tabular text-text font-medium">{r.effectiveBps} bps</span>
        <div className="text-[11px] text-text-faint">on current AUM</div>
      </div>
    ) },
    { key: "performance", header: "Performance fee", render: (r) => r.performanceFeePct === null
      ? <span className="text-text-faint text-xs">none</span>
      : (
        <div>
          <span className="tabular text-text">{r.performanceFeePct}%</span>
          <div className="text-[11px] text-text-faint">over {r.hurdle}{r.highWaterMark ? " · high-water mark" : ""}</div>
        </div>
      ) },
    { key: "accrued", header: "Accrued", render: (r) => <Money amount={r.accruedAmount} currency={r.currency} /> },
    { key: "billing", header: "Billing", render: (r) => (
      <div className="text-xs">
        <div className="text-text-soft capitalize">{r.billingFrequency}</div>
        <div className="text-text-faint tabular">next {formatDate(r.nextInvoiceDue)}</div>
      </div>
    ), hideOnMobile: true },
    { key: "lastInvoiced", header: "Last invoiced", render: (r) => r.lastInvoicedAt
      ? <span className="tabular text-xs text-text-soft">{formatDate(r.lastInvoicedAt)}</span>
      : <Badge tone="warning">Never</Badge>, hideOnMobile: true },
    { key: "note", header: "Note", render: (r) => r.note
      ? <span className="text-xs text-text-soft max-w-md block leading-relaxed">{r.note}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Institutional Funds"
        title="Fee schedules"
        subtitle="What each mandate is billed, what has accrued, and when it next invoices."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="KES accrued" value={<Money amount={kesAccrued} currency="KES" compact />} icon={<Receipt size={17} />} tone="neutral" emphasis={false} hint="earned and not yet invoiced" />
        <GlassStat label="Average effective rate" value={`${avgBps.toFixed(0)} bps`} icon={<Percent size={17} />} tone="neutral" emphasis={false} hint="across KES mandates, on current AUM" />
        <GlassStat label="Performance-fee mandates" value={withPerformance.length} icon={<Trophy size={17} />} tone="neutral" emphasis={false} hint="accrue but crystallise only above the high-water mark" />
        <GlassStat label="Never invoiced" value={neverInvoiced.length} icon={<CalendarClock size={17} />} tone={neverInvoiced.length ? "warning" : "success"} hint="accruing with no billing history" />
      </StatRail>

      <NotePanel tone="info" className="mb-5" title="Accrued is not the same as billable">
        A performance fee accrues daily but only crystallises above the client's high-water mark at the measurement
        date. Treating the accrual as revenue in hand would recognise a fee the firm may never be entitled to charge.
      </NotePanel>

      <SectionTitle
        title="Fee register"
        description="The effective rate is what a tiered ladder actually costs at today's AUM. It moves as the mandate grows, which is the point of a tiered schedule and the reason the headline rate is not comparable across clients."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No fee schedules" />
      </GlassPanel>
    </div>
  );
}
