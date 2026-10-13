import { VALUATION_STATUS_LABELS, type ValuationRun, type ValuationStatus } from "../../mock";
import { getValuationRuns } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, InfoTip, formatDate, type Column } from "../../ui";
import { Calculator, ShieldCheck, TriangleAlert, FileQuestion } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE: Record<ValuationStatus, "neutral" | "info" | "success" | "warning"> = {
  draft: "neutral",
  priced: "info",
  reviewed: "info",
  released_to_finance: "warning",
  published: "success",
};

/** Valuations & NAV — the manager's side of the daily pricing run.
 *
 * Finance publishes; this is where the number is built and checked first. Two
 * things stop a run progressing, and both are shown on the row rather than
 * discovered on opening it: a move outside tolerance, and a price that was
 * never sourced. An unsourced price is not a stale price — carrying yesterday's
 * mark forward silently is how a valuation quietly stops being a valuation. */
export default function Valuations() {
  const { data, loading } = useAsyncData(getValuationRuns);
  const rows = data ?? [];

  const outsideTolerance = rows.filter((r) => Math.abs(r.movePct) > r.tolerancePct);
  const incompletePricing = rows.filter((r) => r.pricesSourced < r.pricesTotal);
  const held = rows.filter((r) => r.status !== "published" && (Math.abs(r.movePct) > r.tolerancePct || r.pricesSourced < r.pricesTotal));
  const published = rows.filter((r) => r.status === "published").length;

  const columns: Column<ValuationRun>[] = [
    { key: "portfolio", header: "Portfolio", className: "min-w-[200px]", render: (r) => (
      <div>
        <div className="flex items-center gap-1.5 text-text font-medium">
          {r.portfolio}
          {/* The note explains a held run; it lives behind the icon, not in a column. */}
          {r.note && <InfoTip text={r.note} />}
        </div>
        <div className="mt-0.5 text-xs text-text-faint tabular">valued {formatDate(r.valuationDate)}</div>
      </div>
    ) },
    // NAV is net assets over units, so the per-unit figure leads and its numerator sits beneath it.
    { key: "nav", header: "NAV · net assets", className: "text-right whitespace-nowrap", render: (r) => (
      <div>
        <div className="tabular text-text font-medium">{r.navPerUnit.toFixed(4)}</div>
        <div className="text-xs text-text-faint"><Money amount={r.netAssets} currency={r.currency} compact /></div>
      </div>
    ) },
    { key: "units", header: "Units in issue", className: "text-right whitespace-nowrap", render: (r) => <span className="tabular text-text-soft">{r.unitsInIssue.toLocaleString()}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "move", header: "Move · tolerance", className: "text-right whitespace-nowrap", render: (r) => {
      const out = Math.abs(r.movePct) > r.tolerancePct;
      return (
        <div>
          <span className={out ? "tabular text-danger font-medium" : "tabular text-text-soft"}>
            {r.movePct > 0 ? "+" : ""}{r.movePct.toFixed(3)}%
          </span>
          <div className="text-xs text-text-faint">tolerance ±{r.tolerancePct.toFixed(2)}%</div>
        </div>
      );
    } },
    { key: "prices", header: "Prices sourced", className: "whitespace-nowrap", render: (r) => r.pricesSourced === r.pricesTotal
      ? <span className="text-xs text-text-soft tabular">{r.pricesSourced} of {r.pricesTotal}</span>
      : <Badge tone="danger" className="whitespace-nowrap">{r.pricesSourced} of {r.pricesTotal}</Badge> },
    // Who reviewed the run is part of its status — the review is the gate the badge reports on.
    { key: "status", header: "Status · reviewer", className: "whitespace-nowrap", render: (r) => (
      <div>
        <Badge tone={STATUS_TONE[r.status]} className="whitespace-nowrap">{VALUATION_STATUS_LABELS[r.status]}</Badge>
        <div className="mt-1 text-xs">
          {r.reviewer
            ? <span className="text-text-soft">{r.reviewer}</span>
            : <span className="text-text-faint">not yet reviewed</span>}
        </div>
      </div>
    ) },
    { key: "note", header: "Note", render: (r) => r.note
      ? <span className="text-xs text-text-soft max-w-md block leading-relaxed">{r.note}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Investment Management"
        title="Valuations & NAV"
        tooltip="NAV — net asset value per unit. Net assets divided by units in issue, computed daily and published only after an independent review."
        subtitle="The daily pricing run before it reaches Finance for publication."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Runs held" value={held.length} icon={<TriangleAlert size={17} />} tone={held.length ? "danger" : "success"} hint="cannot be released until queried" />
        <GlassStat label="Outside tolerance" value={outsideTolerance.length} icon={<Calculator size={17} />} tone={outsideTolerance.length ? "warning" : "success"} hint="moved further than the configured band" />
        <GlassStat label="Incomplete pricing" value={incompletePricing.length} icon={<FileQuestion size={17} />} tone={incompletePricing.length ? "warning" : "success"} hint="at least one instrument has no mark today" />
        <GlassStat label="Published" value={published} icon={<ShieldCheck size={17} />} tone="neutral" emphasis={false} hint="runs already released and published" />
      </StatRail>

      <NotePanel tone="info" className="mb-5" title="Two gates before publication">
        A run is releasable only when every instrument has a sourced price and the move sits inside the tolerance
        band. Failing either does not make the number wrong — it makes it unexplained, and an unexplained NAV is not
        publishable. Finance's independent review is the second gate, not a substitute for this one.
      </NotePanel>

      <SectionTitle
        title="Valuation runs"
        description="Both the move and the tolerance are shown together. A 0.6% move is unremarkable in an equity fund and a query in this one — the band is what makes the number readable."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable newest={(r) => r.valuationDate} columns={columns} rows={rows} columnPicker emptyLabel="No valuation runs" />
      </GlassPanel>
    </div>
  );
}
