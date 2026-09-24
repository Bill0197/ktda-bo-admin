import { type SegregatedPortfolio } from "../../mock";
import { getSegregatedPortfolios } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, formatDate, type Column } from "../../ui";
import { LineChart, TrendingUp, TrendingDown, ShieldAlert } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

/** Segregated portfolios — each institutional client's own book.
 *
 * Performance is only meaningful against the client's own benchmark, so the
 * two always travel together and the page reports relative return rather than
 * leaving the reader to subtract. A portfolio ahead of the market but behind
 * its benchmark has underperformed, and a bare YTD figure hides that. */
export default function Portfolios() {
  const { data, loading } = useAsyncData(getSegregatedPortfolios);
  const rows = data ?? [];

  const kesValue = rows.filter((p) => p.currency === "KES").reduce((s, p) => s + p.marketValue, 0);
  const ahead = rows.filter((p) => p.ytdReturnPct >= p.benchmarkReturnPct);
  const behind = rows.filter((p) => p.ytdReturnPct < p.benchmarkReturnPct);
  const withBreaches = rows.filter((p) => p.openBreaches > 0);

  const columns: Column<SegregatedPortfolio>[] = [
    { key: "name", header: "Portfolio", className: "min-w-[250px]", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.name}</div>
        <div className="text-xs text-text-faint">{r.clientName} · <span className="tabular whitespace-nowrap">{r.mandateRef}</span></div>
      </div>
    ) },
    { key: "value", header: "Market value", className: "text-right whitespace-nowrap", render: (r) => (
      <div>
        <Money amount={r.marketValue} currency={r.currency} compact />
        <div className="text-[11px] text-text-faint">
          cash <Money amount={r.cash} currency={r.currency} compact />
        </div>
      </div>
    ) },
    { key: "performance", header: "YTD vs. benchmark", className: "text-right whitespace-nowrap", render: (r) => {
      const relative = r.ytdReturnPct - r.benchmarkReturnPct;
      return (
        <div className="tabular text-sm">
          <div className="text-text">{r.ytdReturnPct.toFixed(2)}%</div>
          <div className={relative >= 0 ? "text-[11px] text-success" : "text-[11px] text-danger"}>
            {relative >= 0 ? "+" : ""}{(relative * 100).toFixed(0)} bps vs. {r.benchmarkReturnPct.toFixed(2)}%
          </div>
        </div>
      );
    } },
    // Shape of the book: rate sensitivity, then how many lines carry it.
    { key: "duration", header: "Duration · positions", className: "text-right", render: (r) => (
      <div className="tabular whitespace-nowrap">
        <div className="text-text-soft">{r.durationYears.toFixed(2)} yrs</div>
        <div className="text-[11px] text-text-faint">{r.holdingsCount} positions</div>
      </div>
    ) },
    { key: "holdings", header: "Positions", className: "text-right", render: (r) => <span className="tabular text-text-soft">{r.holdingsCount}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "breaches", header: "Open breaches", className: "whitespace-nowrap", render: (r) => r.openBreaches > 0
      ? <Badge tone="danger">{r.openBreaches} open</Badge>
      : <Badge tone="success">Clear</Badge> },
    { key: "custodian", header: "Custodian", className: "min-w-[110px]", render: (r) => <span className="text-xs text-text-soft leading-snug">{r.custodian}</span>, hideOnMobile: true },
    { key: "valued", header: "Last valued", className: "whitespace-nowrap", render: (r) => <span className="tabular text-xs text-text-soft">{formatDate(r.lastValuedAt)}</span>, hideOnMobile: true, defaultHidden: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Institutional Funds"
        title="Segregated portfolios"
        subtitle="Each institutional client's own book — value, performance against their benchmark, and restriction standing."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Portfolios" value={rows.length} icon={<LineChart size={17} />} tone="primary" emphasis={false} hint="segregated mandates under management" />
        <GlassStat label="KES market value" value={<Money amount={kesValue} currency="KES" compact />} icon={<TrendingUp size={17} />} tone="neutral" emphasis={false} hint="KES-denominated portfolios" />
        <GlassStat label="Behind benchmark" value={behind.length} icon={<TrendingDown size={17} />} tone={behind.length ? "warning" : "success"} hint={`${ahead.length} ahead of their own benchmark`} />
        <GlassStat label="With open breaches" value={withBreaches.length} icon={<ShieldAlert size={17} />} tone={withBreaches.length ? "danger" : "success"} hint="restriction breaches not yet cured" />
      </StatRail>

      <NotePanel tone="info" className="mb-5" title="Each portfolio is the client's, not the fund's">
        A segregated client holds their own assets at their own custodian under their own agreement. Nothing here
        pools with the retail funds, which is why a breach on one of these portfolios is a contractual matter with
        that client rather than an internal limit excursion.
      </NotePanel>

      <SectionTitle
        title="Portfolio book"
        description="Relative return is stated in basis points against each client's own benchmark. Comparing two clients' headline returns to each other would compare two different mandates."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No segregated portfolios" />
      </GlassPanel>
    </div>
  );
}
