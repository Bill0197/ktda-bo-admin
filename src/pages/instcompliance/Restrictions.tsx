import { useMemo, useState } from "react";
import { RESTRICTION_TYPE_LABELS, type MandateRestriction } from "../../mock";
import { getMandateRestrictions } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, ProgressBar, FilterBar, SelectFilter, formatDateTime, type Column } from "../../ui";
import { Gavel, ScanLine, TriangleAlert, Radar } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATE_TONE = { within: "success", near: "warning", breach: "danger" } as const;
const STATE_LABEL = { within: "Within", near: "Near limit", breach: "Breach" } as const;

/** Investment restrictions — Compliance's monitoring view of every client rule.
 *
 * The Investment Manager reads the same records under Institutional Funds to
 * run the book; this view exists to answer a different question: which rules
 * can actually be enforced, and which are only measured afterwards. A mandate
 * whose important limits are all post-trade is not being monitored, it is
 * being observed. */
export default function Restrictions() {
  const { data, loading } = useAsyncData(getMandateRestrictions);
  const rows = useMemo(() => data ?? [], [data]);
  const [client, setClient] = useState("all");

  const clients = useMemo(() => [...new Set(rows.map((r) => r.clientName))], [rows]);
  const shown = client === "all" ? rows : rows.filter((r) => r.clientName === client);

  const breaching = shown.filter((r) => r.state === "breach");
  const near = shown.filter((r) => r.state === "near");
  const postTrade = shown.filter((r) => !r.preTradeChecked);
  const postTradeExposed = postTrade.filter((r) => r.state !== "within");

  const columns: Column<MandateRestriction>[] = [
    { key: "client", header: "Client", className: "min-w-[170px]", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.clientName}</div>
        <div className="mt-0.5 text-xs text-text-faint tabular">{r.mandateRef}</div>
      </div>
    ) },
    // The type heads the rule it classifies; a badge column of its own pushed the table off-screen.
    { key: "rule", header: "Type · rule", className: "min-w-[220px]", render: (r) => (
      <div>
        <div className="text-xs font-medium text-info">{RESTRICTION_TYPE_LABELS[r.type]}</div>
        <div className="mt-0.5 text-xs text-text-soft leading-relaxed line-clamp-2" title={r.rule}>{r.rule}</div>
      </div>
    ) },
    { key: "headroom", header: "Headroom", render: (r) => (
      <div className="min-w-[9rem]">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className={r.state === "breach" ? "tabular whitespace-nowrap text-danger font-medium" : "tabular whitespace-nowrap text-text"}>{r.currentValue}</span>
          <span className="text-[11px] text-text-faint tabular text-right">of {r.limitValue}</span>
        </div>
        <ProgressBar
          value={Math.min(100, Math.max(0, 100 - r.headroomPct))}
          tone={r.state === "breach" ? "danger" : r.state === "near" ? "warning" : "primary"}
        />
        <div className="text-[11px] text-text-faint mt-1 tabular">
          {r.headroomPct >= 0 ? `${r.headroomPct.toFixed(1)}% headroom` : `${Math.abs(r.headroomPct).toFixed(1)}% through`}
        </div>
      </div>
    ) },
    // Where the position stands and whether the rule could have stopped it are read together.
    { key: "state", header: "State · enforcement", className: "whitespace-nowrap", render: (r) => (
      <div>
        <Badge tone={STATE_TONE[r.state]}>{STATE_LABEL[r.state]}</Badge>
        <div className="mt-1">
          {r.preTradeChecked ? <Badge tone="success">Pre-trade</Badge> : <Badge tone="warning">Post-trade only</Badge>}
        </div>
      </div>
    ) },
    { key: "checked", header: "Last checked", className: "min-w-[110px]", render: (r) => <span className="tabular text-xs text-text-soft">{formatDateTime(r.lastChecked)}</span>, hideOnMobile: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Institutional Investment Compliance"
        title="Investment restrictions"
        subtitle="Every client restriction, how much headroom is left, and whether the rule can be enforced before a trade or only measured after one."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Restrictions monitored" value={shown.length} icon={<Gavel size={17} />} tone="primary" emphasis={false} hint={client === "all" ? "across every client mandate" : client} />
        <GlassStat label="In breach" value={breaching.length} icon={<TriangleAlert size={17} />} tone={breaching.length ? "danger" : "success"} hint="through the client's own limit" />
        <GlassStat label="Near limit" value={near.length} icon={<Radar size={17} />} tone={near.length ? "warning" : "success"} hint="inside 10% of the limit" />
        <GlassStat label="Post-trade only" value={postTrade.length} icon={<ScanLine size={17} />} tone={postTradeExposed.length ? "warning" : "neutral"} emphasis={false} hint={`${postTradeExposed.length} of them currently near or through`} />
      </StatRail>

      <NotePanel tone="info" className="mb-5" title="Pre-trade and post-trade are different controls">
        A pre-trade rule blocks the booking, so it can only be breached by a system fault. A post-trade rule can be
        breached by the market with nobody doing anything wrong — which is why duration ceilings and liquidity floors
        dominate the breach register and issuer caps rarely appear on it.
      </NotePanel>

      <FilterBar className="mb-4">
        <SelectFilter
          value={client}
          onChange={setClient}
          allLabel="All clients"
          options={clients.map((c) => ({ value: c, label: c }))}
          className="w-auto min-w-[240px]"
        />
      </FilterBar>

      <SectionTitle
        title="Restriction monitor"
        description="Headroom is expressed against the limit, so a range rule and a ceiling rule read the same way. A negative figure means the position is through the limit, not that it is close to it."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={shown} columnPicker emptyLabel="No restrictions for this client" />
      </GlassPanel>
    </div>
  );
}
