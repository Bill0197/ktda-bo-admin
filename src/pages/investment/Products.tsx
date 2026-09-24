import { PRODUCT_STATUS_LABELS, type InvestmentProduct, type ProductStatus } from "../../mock";
import { getInvestmentProducts } from "../../lib/api";
import { PageHeader, Badge, DataTable, Skeleton, GlassPanel, GlassStat, StatRail, NotePanel, SectionTitle, Money, InfoTip, formatDate, type Column } from "../../ui";
import { Boxes, Landmark, Rocket, Percent } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE: Record<ProductStatus, "success" | "info" | "warning" | "neutral"> = {
  live: "success",
  pending_launch: "info",
  soft_closed: "warning",
  closed: "neutral",
};

/** Products & funds — the manager's view of what the firm actually runs.
 *
 * Distinct from `/catalogue`, which renders the configuration chain
 * (institution → product → service package → tariff). This is the commercial
 * face of the same objects: what each product invests in, what it charges,
 * which channels may sell it, and whether the CMA has approved it — because a
 * product that is technically configured but not yet approved must not reach
 * an investor app, and that is a fact about the product, not about the chain. */
export default function Products() {
  const { data, loading } = useAsyncData(getInvestmentProducts);
  const rows = data ?? [];

  const live = rows.filter((p) => p.status === "live");
  const kesAum = live.filter((p) => p.currency === "KES").reduce((s, p) => s + p.aum, 0);
  const pending = rows.filter((p) => p.status === "pending_launch");
  const weightedFee = kesAum > 0
    ? live.filter((p) => p.currency === "KES").reduce((s, p) => s + p.managementFeeBps * p.aum, 0) / kesAum
    : 0;

  const columns: Column<InvestmentProduct>[] = [
    { key: "name", header: "Product", className: "min-w-[220px]", render: (r) => (
      <div>
        <div className="flex items-center gap-1.5 text-text font-medium">
          {r.name}
          {/* The note is a paragraph; it lives behind the icon, not in a column. */}
          {r.note && <InfoTip text={r.note} />}
        </div>
        <div className="mt-0.5 text-xs text-text-faint"><span className="tabular">{r.code}</span> · {r.assetClass}</div>
      </div>
    ) },
    // Status and CMA approval answer the same question — may this be sold? — so
    // they share a cell: the state, then the approval reference behind it.
    { key: "status", header: "Status · CMA approval", className: "whitespace-nowrap", render: (r) => {
      // "CMA/CIS/2026/031 — filed, awaiting approval": the reference, then its state.
      const [ref, state] = r.cmaApproval.split(" — ");
      return (
        <div>
          <Badge tone={STATUS_TONE[r.status]}>{PRODUCT_STATUS_LABELS[r.status]}</Badge>
          <div className="mt-1 text-xs">
            <span className="tabular text-text-faint">{ref}</span>
            {state && <div className={r.cmaApproval.includes("awaiting") ? "text-warning" : "text-text-faint"}>{state.charAt(0).toUpperCase() + state.slice(1)}</div>}
          </div>
        </div>
      );
    } },
    { key: "aum", header: "AUM", className: "text-right whitespace-nowrap", render: (r) => r.aum > 0
      ? <Money amount={r.aum} currency={r.currency} compact />
      : <span className="text-text-faint text-xs">not funded</span> },
    { key: "fee", header: "Fee · minimum", className: "text-right whitespace-nowrap", render: (r) => (
      <div>
        <div className="tabular text-text">{r.managementFeeBps} bps</div>
        <div className="text-xs text-text-faint">min <Money amount={r.minInvestment} currency={r.currency} compact /></div>
      </div>
    ) },
    { key: "benchmark", header: "Benchmark", className: "min-w-[130px]", render: (r) => <span className="text-xs text-text-soft leading-snug">{r.benchmark}</span>, hideOnMobile: true },
    { key: "channels", header: "Approved channels", className: "min-w-[130px]", render: (r) => (
      <span className="text-xs text-text-soft leading-relaxed">{r.channels.join(" · ")}</span>
    ), hideOnMobile: true },
    { key: "launched", header: "Launched", className: "whitespace-nowrap", render: (r) => <span className="tabular text-xs text-text-soft">{formatDate(r.launchedAt)}</span>, hideOnMobile: true, defaultHidden: true },
    { key: "note", header: "Note", render: (r) => r.note
      ? <span className="text-xs text-text-soft max-w-md block leading-relaxed">{r.note}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
  ];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader
        eyebrow="Investment Management"
        title="Products & funds"
        subtitle="What the firm runs, what it charges, and which channels are approved to sell each product."
      />

      <StatRail columns={4} className="mb-5">
        <GlassStat label="Live products" value={live.length} icon={<Boxes size={17} />} tone="primary" emphasis={false} hint={`${rows.length} in the register including closed`} />
        <GlassStat label="KES assets under management" value={<Money amount={kesAum} currency="KES" compact />} icon={<Landmark size={17} />} tone="neutral" emphasis={false} hint="pooled and segregated, KES products only" />
        <GlassStat label="Blended fee" value={`${weightedFee.toFixed(0)} bps`} icon={<Percent size={17} />} tone="neutral" emphasis={false} hint="AUM-weighted across live KES products" />
        <GlassStat label="Pending launch" value={pending.length} icon={<Rocket size={17} />} tone={pending.length ? "warning" : "neutral"} emphasis={false} hint="configured but not yet approved to sell" />
      </StatRail>

      {pending.length > 0 && (
        <NotePanel tone="warning" className="mb-5" title="Not yet approved to market">
          {pending.map((p) => p.name).join(", ")} {pending.length === 1 ? "is" : "are"} configured on the platform but
          the CMA approval has not landed. Until it does, the product must not appear in the investor apps or in any
          IFA material — configuration readiness is not permission to sell.
        </NotePanel>
      )}

      <SectionTitle
        title="Product register"
        description="Approved channels are a control, not a description. A product live on the app but not approved for the IFA channel that an advisor nonetheless recommends is a mis-selling event."
      />
      <GlassPanel className="p-1" sheen={false}>
        <DataTable columns={columns} rows={rows} columnPicker emptyLabel="No products" />
      </GlassPanel>
    </div>
  );
}
