import { REDEMPTION_STATUS_LABELS, type RedemptionRequest, type RedemptionStatus } from "../../mock";
import { getRedemptionRequests } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, InfoTip, formatDateTime, formatDate, type Column } from "../../ui";
import { Undo2, Droplets, Ban, Coins } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE: Record<RedemptionStatus, "info" | "warning" | "success" | "danger" | "neutral"> = {
  requested: "info",
  pending_liquidity: "warning",
  approved: "info",
  gated: "warning",
  settled: "success",
  rejected: "danger",
};

/** Redemptions — money leaving, and what it costs the book to let it.
 *
 * The column that matters most is not the amount, it is whether the payout had
 * to be funded by selling. Redemptions paid from the cash buffer are neutral;
 * redemptions that force a sale set the price for everyone still invested, and
 * a run of them is the early signal that the buffer is set too tight. */
export default function Redemptions() {
  const { data, loading } = useAsyncData(getRedemptionRequests);
  const rows = data ?? [];

  const live = rows.filter((r) => r.status !== "settled" && r.status !== "rejected");
  const gated = rows.filter((r) => r.status === "gated");
  const fundedBySale = rows.filter((r) => r.fundedBySale && r.status !== "rejected");
  const liveKes = live.filter((r) => r.currency === "KES").reduce((s, r) => s + r.amount, 0);

  const columns: Column<RedemptionRequest>[] = [
    { key: "ref", header: "Request", className: "min-w-[170px]", render: (r) => (
      <div>
        <div className="flex items-center gap-1.5 text-text font-medium">
          <span className="tabular whitespace-nowrap">{r.ref}</span>
          {/* The note carries the reason a request was held or blocked; it sits behind the icon. */}
          {r.note && <InfoTip text={r.note} />}
        </div>
        <div className="mt-0.5 text-xs text-text-faint tabular whitespace-nowrap">{formatDateTime(r.requestedAt)}</div>
      </div>
    ) },
    { key: "client", header: "Client", className: "min-w-[180px]", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.clientName}</div>
        <div className="mt-0.5 text-xs text-text-faint">{r.clientType === "institutional" ? "Institutional" : "Retail"} · {r.product}</div>
      </div>
    ) },
    { key: "amount", header: "Amount · units", className: "text-right whitespace-nowrap", render: (r) => (
      <div>
        <div className="text-text"><Money amount={r.amount} currency={r.currency} compact /></div>
        <div className="text-xs text-text-faint tabular">{r.units.toLocaleString(undefined, { maximumFractionDigits: 2 })} units</div>
      </div>
    ) },
    { key: "tier", header: "Settlement tier", className: "whitespace-nowrap", render: (r) => (
      <div className="text-xs">
        <div className="text-text-soft">{r.settlementTier}</div>
        <div className="text-text-faint tabular">due {formatDate(r.dueAt)}</div>
      </div>
    ), hideOnMobile: true },
    // Where the payout comes from sits under the status: the state of a request and
    // what it costs the book to meet it are read together.
    { key: "status", header: "Status · funded by", className: "whitespace-nowrap", render: (r) => (
      <div>
        <Badge tone={STATUS_TONE[r.status]} className="whitespace-nowrap">{REDEMPTION_STATUS_LABELS[r.status]}</Badge>
        <div className={r.fundedBySale ? "mt-1 text-xs font-medium text-warning" : "mt-1 text-xs text-success"}>
          {r.fundedBySale ? "Asset sale" : "Cash buffer"}
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
        title="Redemptions"
        subtitle="Outstanding redemption requests, their settlement clocks, and whether the book had to sell to meet them."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Live requests" value={live.length} icon={<Undo2 size={17} />} tone={live.length ? "warning" : "success"} hint="not yet settled or rejected" />
        <GlassStat label="KES outstanding" value={<Money amount={liveKes} currency="KES" compact />} icon={<Coins size={17} />} tone="neutral" emphasis={false} hint="live KES redemption value" />
        <GlassStat label="Funded by selling" value={fundedBySale.length} icon={<Droplets size={17} />} tone={fundedBySale.length > 2 ? "warning" : "neutral"} emphasis={false} hint="paid by raising cash, not from the buffer" />
        <GlassStat label="Gated" value={gated.length} icon={<Ban size={17} />} tone={gated.length ? "warning" : "success"} hint="deferred to the next dealing cycle" />
      </StatRail>

      <NotePanel tone="info" className="mb-5" title="The gate is a last resort, not a lever">
        Gating defers a redemption to protect the investors who stay in, and it is only reachable at the 10%-of-AUM
        threshold with trustee approval to extend. A gated request is not a refused one — it keeps its place in the
        queue and settles on the following cycle.
      </NotePanel>

      <SectionTitle
        title="Redemption queue"
        description="A rejected request carries the reason it was blocked, but the customer is never told a compliance reason — the restriction is communicated, the cause is not."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable newest={(r) => r.requestedAt} columns={columns} rows={rows} columnPicker emptyLabel="No redemption requests" />
      </GlassPanel>
    </div>
  );
}
