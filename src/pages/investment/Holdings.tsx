import { useMemo, useState } from "react";
import type { BookHolding } from "../../mock";
import { getHoldingsBook } from "../../lib/api";
import { PageHeader, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, ProgressBar, FilterBar, SelectFilter, formatDate, type Column } from "../../ui";
import { Layers, Ruler, Gauge, TriangleAlert } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

/** Holdings & positions — the book, measured against the limits that bind it.
 *
 * A weight on its own says nothing; a weight against its mandate limit says
 * everything. Cash carries no limit and shows none rather than a misleading
 * 0% — an empty limit cell means "not limit-bearing", not "no headroom". */
export default function Holdings() {
  const { data, loading } = useAsyncData(getHoldingsBook);
  const rows = useMemo(() => data ?? [], [data]);
  const [portfolio, setPortfolio] = useState("all");

  const portfolios = useMemo(() => [...new Set(rows.map((r) => r.portfolio))], [rows]);
  const shown = portfolio === "all" ? rows : rows.filter((r) => r.portfolio === portfolio);

  const nearLimit = shown.filter((r) => r.limitPct !== null && r.weightPct / r.limitPct >= 0.9);
  const overLimit = shown.filter((r) => r.limitPct !== null && r.weightPct > r.limitPct);
  const totalKes = shown.filter((r) => r.currency === "KES").reduce((s, r) => s + r.marketValue, 0);
  // Weighted by market value within each currency, so a USD sleeve cannot
  // distort a KES portfolio's duration through a raw average.
  const weightedDuration = (() => {
    const base = shown.filter((r) => r.limitPct !== null);
    const mv = base.reduce((s, r) => s + r.marketValue, 0);
    return mv > 0 ? base.reduce((s, r) => s + r.durationYears * r.marketValue, 0) / mv : 0;
  })();

  const columns: Column<BookHolding>[] = [
    { key: "instrument", header: "Instrument", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.instrument}</div>
        <div className="text-[11px] text-text-faint tabular">{r.isin} · {r.assetClass}</div>
      </div>
    ) },
    { key: "portfolio", header: "Portfolio", render: (r) => <span className="text-xs text-text-soft">{r.portfolio}</span>, hideOnMobile: true },
    { key: "nominal", header: "Nominal", render: (r) => <Money amount={r.nominal} currency={r.currency} compact />, hideOnMobile: true },
    { key: "marketValue", header: "Market value", render: (r) => <Money amount={r.marketValue} currency={r.currency} compact /> },
    { key: "weight", header: "Weight vs. limit", render: (r) => {
      if (r.limitPct === null) {
        return (
          <div>
            <div className="tabular text-text">{r.weightPct.toFixed(2)}%</div>
            <div className="text-[11px] text-text-faint">no limit applies</div>
          </div>
        );
      }
      const used = r.weightPct / r.limitPct;
      return (
        <div className="min-w-[9rem]">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="tabular text-text">{r.weightPct.toFixed(2)}%</span>
            <span className="text-[11px] text-text-faint tabular">of {r.limitPct.toFixed(0)}%</span>
          </div>
          <ProgressBar value={Math.min(100, used * 100)} tone={used > 1 ? "danger" : used >= 0.9 ? "warning" : "primary"} />
        </div>
      );
    } },
    { key: "duration", header: "Duration", render: (r) => <span className="tabular text-text-soft">{r.durationYears.toFixed(1)} yrs</span> },
    { key: "yield", header: "Yield", render: (r) => <span className="tabular text-text-soft">{r.yieldPct.toFixed(2)}%</span>, hideOnMobile: true },
    { key: "maturity", header: "Maturity", render: (r) => <span className="tabular text-xs text-text-soft">{r.maturity === "—" ? "—" : formatDate(r.maturity)}</span>, hideOnMobile: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Investment Management"
        title="Holdings & positions"
        subtitle="Every position across the pooled funds and the segregated book, measured against the limit that binds it."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Positions" value={shown.length} icon={<Layers size={17} />} tone="primary" emphasis={false} hint={portfolio === "all" ? "across every portfolio" : portfolio} />
        <GlassStat label="KES market value" value={<Money amount={totalKes} currency="KES" compact />} icon={<Gauge size={17} />} tone="neutral" emphasis={false} hint="KES-denominated positions in view" />
        <GlassStat label="Weighted duration" value={`${weightedDuration.toFixed(2)} yrs`} icon={<Ruler size={17} />} tone="neutral" emphasis={false} hint="market-value weighted, excludes cash" />
        <GlassStat label="At or over limit" value={nearLimit.length} icon={<TriangleAlert size={17} />} tone={overLimit.length ? "danger" : nearLimit.length ? "warning" : "success"} hint={`${overLimit.length} through the limit, ${nearLimit.length - overLimit.length} within 10% of it`} />
      </StatRail>

      {overLimit.length > 0 && (
        <NotePanel tone="danger" className="mb-5" title="Positions through their limit">
          {overLimit.map((r) => `${r.instrument} (${r.portfolio})`).join("; ")}. Raise it on the mandate breach
          register so it carries a cure period and a client notification clock, rather than leaving it as a number
          on this page.
        </NotePanel>
      )}

      <FilterBar className="mb-4">
        <SelectFilter
          value={portfolio}
          onChange={setPortfolio}
          allLabel="All portfolios"
          options={portfolios.map((p) => ({ value: p, label: p }))}
          className="w-auto min-w-[220px]"
        />
      </FilterBar>

      <SectionTitle
        title="Position book"
        description="Cash shows a weight but no limit — it is not limit-bearing, and rendering a 0% cap against it would read as a breach on every line."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={shown} columnPicker emptyLabel="No positions in this portfolio" />
      </GlassPanel>
    </div>
  );
}
