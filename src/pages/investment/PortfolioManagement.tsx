import { TRADE_STATUS_LABELS, type PortfolioTrade, type TradeStatus } from "../../mock";
import { getPortfolioTrades } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, InfoTip, formatDate, type Column } from "../../ui";
import { PieChart, Vote, TriangleAlert, Handshake } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE: Record<TradeStatus, "neutral" | "warning" | "info" | "success" | "danger"> = {
  proposed: "neutral",
  ic_pending: "warning",
  executed: "info",
  settled: "success",
  failed: "danger",
};

/** Portfolio management — the trade blotter.
 *
 * Trades are *sourced* through Investcent's existing Dealer → Investment
 * Committee → Ops process; this system does not execute them. What it does own
 * is the record of why each one was raised and where it stands, because that
 * rationale is what the Committee votes on and what an auditor asks for later.
 * Every row therefore carries a rationale, and none of them is optional. */
export default function PortfolioManagement() {
  const { data, loading } = useAsyncData(getPortfolioTrades);
  const rows = data ?? [];

  const withCommittee = rows.filter((r) => r.status === "ic_pending");
  const failed = rows.filter((r) => r.status === "failed");
  const settledKes = rows.filter((r) => r.status === "settled" && r.currency === "KES").reduce((s, r) => s + r.nominal, 0);
  const brokers = new Set(rows.map((r) => r.broker)).size;

  const columns: Column<PortfolioTrade>[] = [
    { key: "ref", header: "Trade", className: "min-w-[150px]", render: (r) => (
      <div>
        <div className="flex items-center gap-1.5 text-text font-medium">
          <span className="tabular whitespace-nowrap">{r.ref}</span>
          {/* The rationale is a paragraph; it sits behind the icon so the blotter stays scannable. */}
          <InfoTip text={r.rationale} />
        </div>
        <div className="mt-0.5 text-xs text-text-faint">{r.portfolio}</div>
      </div>
    ) },
    { key: "instrument", header: "Instrument", className: "min-w-[150px]", render: (r) => (
      <div>
        <div className="text-text-soft text-sm">{r.instrument}</div>
        <div className="mt-0.5 text-xs text-text-faint tabular">{r.isin}</div>
      </div>
    ) },
    // Direction and size are read together — "buying 180m" — so they share a cell.
    { key: "nominal", header: "Side · nominal", className: "text-right whitespace-nowrap", render: (r) => (
      <div>
        <Badge tone={r.side === "buy" ? "success" : "warning"} className="whitespace-nowrap">{r.side === "buy" ? "Buy" : "Sell"}</Badge>
        <div className="mt-1 text-text"><Money amount={r.nominal} currency={r.currency} compact /></div>
      </div>
    ) },
    { key: "price", header: "Price · yield", className: "text-right whitespace-nowrap", render: (r) => (
      <div className="tabular text-sm">
        <div className="text-text">{r.price.toFixed(2)}</div>
        <div className="text-xs text-text-faint">{r.yieldPct.toFixed(2)}% yield</div>
      </div>
    ) },
    { key: "dates", header: "Trade → settle", className: "whitespace-nowrap", render: (r) => (
      <div className="tabular text-xs text-text-soft">
        <div>{formatDate(r.tradeDate)}</div>
        <div className="text-text-faint">→ {formatDate(r.settlementDate)}</div>
      </div>
    ), hideOnMobile: true },
    // The broker sits under the status: a failed settlement is a counterparty's failure.
    { key: "status", header: "Status · broker", className: "whitespace-nowrap", render: (r) => (
      <div>
        <Badge tone={STATUS_TONE[r.status]} className="whitespace-nowrap">{TRADE_STATUS_LABELS[r.status]}</Badge>
        <div className="mt-1 text-xs text-text-soft">{r.broker}</div>
      </div>
    ) },
    { key: "rationale", header: "Rationale", render: (r) => <span className="text-xs text-text-soft max-w-lg block leading-relaxed">{r.rationale}</span>, hideOnMobile: true, defaultHidden: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Investment Management"
        title="Portfolio management"
        subtitle="The trade blotter across pooled and segregated portfolios, with the reason each trade was raised."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="With the Committee" value={withCommittee.length} icon={<Vote size={17} />} tone={withCommittee.length ? "warning" : "success"} hint="above dealer authority, awaiting a vote" />
        <GlassStat label="Failed settlement" value={failed.length} icon={<TriangleAlert size={17} />} tone={failed.length ? "danger" : "success"} hint="no securities delivered — needs re-booking" />
        <GlassStat label="KES nominal settled" value={<Money amount={settledKes} currency="KES" compact />} icon={<PieChart size={17} />} tone="neutral" emphasis={false} hint="across all KES portfolios" />
        <GlassStat label="Brokers used" value={brokers} icon={<Handshake size={17} />} tone="neutral" emphasis={false} hint="concentration is reviewed at counterparty due diligence" />
      </StatRail>

      <NotePanel tone="info" className="mb-5" title="This system records trades, it does not place them">
        Execution runs through the existing Dealer → Investment Committee → Operations process. What lives here is
        the instruction, the rationale and the settlement outcome — the record NAV is built on and the audit trail
        the Committee's decisions attach to.
      </NotePanel>

      <SectionTitle
        title="Trade blotter"
        description="A failed trade stays on the blotter with its re-book alongside it. Deleting the failure would hide a counterparty performance problem that counterparty due diligence needs to see."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No trades" />
      </GlassPanel>
    </div>
  );
}
