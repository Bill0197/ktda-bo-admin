import { ORDER_STATUS_LABELS, type InvestmentOrder, type OrderStatus } from "../../mock";
import { getInvestmentOrders } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, formatDateTime, formatDate, type Column } from "../../ui";
import { ShoppingCart, ArrowDownToLine, ArrowUpFromLine, Clock } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE: Record<OrderStatus, "info" | "warning" | "success" | "danger" | "neutral"> = {
  received: "info",
  pending_pricing: "warning",
  priced: "info",
  settled: "success",
  rejected: "danger",
  cancelled: "neutral",
};

const SIDE_TONE = { subscription: "success", redemption: "warning", switch: "info" } as const;
const SIDE_LABEL = { subscription: "Subscription", redemption: "Redemption", switch: "Switch" } as const;

/** Orders & subscriptions — client flow into and out of the products, from
 * placement to settlement.
 *
 * Units and the dealing price are null until the strike. Showing an estimated
 * unit count against a price that does not exist yet would be a guess presented
 * as a figure, and a client who reads it as a promise has been mis-sold. */
export default function Orders() {
  const { data, loading } = useAsyncData(getInvestmentOrders);
  const rows = data ?? [];

  const awaitingPrice = rows.filter((r) => r.status === "received" || r.status === "pending_pricing");
  const kesSubs = rows.filter((r) => r.side === "subscription" && r.currency === "KES" && r.status !== "rejected" && r.status !== "cancelled").reduce((s, r) => s + r.amount, 0);
  const kesRedemptions = rows.filter((r) => r.side === "redemption" && r.currency === "KES" && r.status !== "rejected" && r.status !== "cancelled").reduce((s, r) => s + r.amount, 0);
  const notDealt = rows.filter((r) => r.status === "rejected" || r.status === "cancelled");

  const columns: Column<InvestmentOrder>[] = [
    { key: "ref", header: "Order", render: (r) => (
      <div>
        <div className="text-text font-medium tabular">{r.ref}</div>
        <div className="text-[11px] text-text-faint tabular">{formatDateTime(r.placedAt)}</div>
      </div>
    ) },
    { key: "client", header: "Client", render: (r) => (
      <div>
        <div className="text-text font-medium">{r.clientName}</div>
        <div className="text-xs text-text-faint">{r.clientType === "institutional" ? "Institutional" : "Retail"} · {r.product}</div>
      </div>
    ) },
    { key: "side", header: "Side", className: "whitespace-nowrap", render: (r) => <Badge tone={SIDE_TONE[r.side]}>{SIDE_LABEL[r.side]}</Badge> },
    { key: "amount", header: "Amount", render: (r) => <Money amount={r.amount} currency={r.currency} compact /> },
    { key: "units", header: "Units", render: (r) => r.units === null
      ? <span className="text-text-faint text-xs">not yet priced</span>
      : <span className="tabular text-text">{r.units.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span> },
    { key: "price", header: "Dealing price", render: (r) => r.dealingPrice === null
      ? <span className="text-text-faint text-xs">—</span>
      : <span className="tabular text-text-soft">{r.dealingPrice.toFixed(4)}</span>, hideOnMobile: true },
    { key: "dealingDate", header: "Dealing date", render: (r) => <span className="tabular text-xs text-text-soft">{formatDate(r.dealingDate)}</span>, hideOnMobile: true },
    { key: "status", header: "Status", className: "whitespace-nowrap", render: (r) => <Badge tone={STATUS_TONE[r.status]}>{ORDER_STATUS_LABELS[r.status]}</Badge> },
    { key: "channel", header: "Channel", render: (r) => <span className="text-xs text-text-soft">{r.channel}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "note", header: "Note", render: (r) => r.note
      ? <span className="text-xs text-text-soft max-w-md block leading-relaxed">{r.note}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Investment Management"
        title="Orders & subscriptions"
        subtitle="Client dealing flow — placement, strike, settlement — across pooled and segregated products."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Awaiting the strike" value={awaitingPrice.length} icon={<Clock size={17} />} tone={awaitingPrice.length ? "warning" : "success"} hint="received or waiting on the dealing price" />
        <GlassStat label="KES subscriptions" value={<Money amount={kesSubs} currency="KES" compact />} icon={<ArrowDownToLine size={17} />} tone="success" emphasis={false} hint="live orders in the current window" />
        <GlassStat label="KES redemptions" value={<Money amount={kesRedemptions} currency="KES" compact />} icon={<ArrowUpFromLine size={17} />} tone="warning" emphasis={false} hint="live orders in the current window" />
        <GlassStat label="Not dealt" value={notDealt.length} icon={<ShoppingCart size={17} />} tone="neutral" emphasis={false} hint="rejected or withdrawn before the strike" />
      </StatRail>

      <NotePanel tone="info" className="mb-5" title="Forward pricing">
        Orders deal at the next computed price, not the last published one. An order placed after the 16:00 cut-off
        deals on the following strike — that is the rule working, not a late order. Until the strike runs, both the
        unit count and the price are genuinely unknown and are shown as such.
      </NotePanel>

      <SectionTitle title="Order book" description="Institutional and retail flow in one book — the dealing rules are the same, only the settlement tiers differ." />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No orders" />
      </GlassPanel>
    </div>
  );
}
