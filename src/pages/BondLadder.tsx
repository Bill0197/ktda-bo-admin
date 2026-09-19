import { useEffect, useState } from "react";
import { INDICATIVE_USD_KES, type BondPosition, type CouponMonth, type SubFund } from "../mock";
import { getBondLadder, getCouponCalendar, getSubFunds } from "../lib/api";
import { PageHeader, Badge, DataTable, type Column, Money, formatDate, Card, ChartFrame, ColumnChart, DonutChart, compactNumber } from "../ui";

export default function BondLadder() {
  const [ladder, setLadder] = useState<BondPosition[]>([]);
  const [funds, setFunds] = useState<SubFund[]>([]);
  const [coupons, setCoupons] = useState<CouponMonth[]>([]);

  useEffect(() => {
    // .catch(() => {}) on each: a role without /nav access (e.g. Investment
    // Manager, Investment Committee) gets a 403 from getSubFunds() here —
    // this page still renders fine with funds=[] (currency labels fall back
    // to the raw sub-fund code), it just must not leave an unhandled
    // rejection. See useAsyncData's docstring for the same rationale.
    getBondLadder().then(setLadder).catch(() => {});
    getSubFunds().then(setFunds).catch(() => {});
    getCouponCalendar(12).then(setCoupons).catch(() => {});
  }, []);

  const columns: Column<BondPosition>[] = [
    { key: "rung", header: "Rung", render: (r) => <Badge tone="neutral">#{r.rung}</Badge> },
    {
      key: "subFund",
      header: "Sub-fund",
      render: (r) => <span className="text-text-soft">{funds.find((f) => f.code === r.subFund)?.currency ?? r.subFund}</span>,
    },
    { key: "name", header: "Bond", render: (r) => <span className="text-text font-medium">{r.name}</span> },
    { key: "isin", header: "ISIN", render: (r) => <span className="tabular text-xs">{r.isin}</span>, hideOnMobile: true },
    { key: "coupon", header: "Coupon", render: (r) => `${(r.couponRate * 100).toFixed(2)}%` },
    { key: "maturity", header: "Maturity", render: (r) => formatDate(r.maturity), hideOnMobile: true },
    { key: "marketValue", header: "Market value", render: (r) => <Money amount={r.marketValue} currency={funds.find((f) => f.code === r.subFund)?.currency ?? "KES"} /> },
  ];

  return (
    <div>
      <PageHeader title="Bond ladder" subtitle="Six-rung staggered ladder per sub-fund — sourced through the existing Dealer → Investment Committee trade process." />
      <Card className="p-3.5 bg-surface-sunken border-none mb-5 text-xs text-text-soft">
        This system ingests positions and prices from the existing trade process for NAV — it does not execute trades.
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-5 items-start">
        {/* The ladder is built to produce an inflow every month; this is the
            chart that shows whether the current rungs actually do. */}
        <ChartFrame
          className="md:col-span-2 xl:col-span-2"
          title="Coupon receipts — next 12 months"
          subtitle="KES-equivalent, derived from each rung's own coupon dates and face value."
          table={{
            columns: ["Month", "KES-equivalent", "Bonds paying"],
            rows: coupons.map((m) => [m.month, compactNumber(m.kes + m.usd * INDICATIVE_USD_KES), m.bonds.join(", ") || "—"]),
          }}
        >
          <ColumnChart
            height={200}
            labels={coupons.map((m) => m.month)}
            series={[{ label: "Coupon receipts", values: coupons.map((m) => m.kes + m.usd * INDICATIVE_USD_KES), colorIndex: 1 }]}
          />
        </ChartFrame>

        <ChartFrame
          title="Ladder weight"
          subtitle="Market value by rung, KES fund — a lopsided ladder is a concentration, not a ladder."
          table={{
            columns: ["Rung", "Bond", "Market value"],
            rows: ladder
              .filter((b) => b.subFund === "KES_FIXED_INCOME")
              .map((b) => [`#${b.rung}`, b.name, compactNumber(b.marketValue)]),
          }}
        >
          <DonutChart
            size={140}
            thickness={20}
            centerLabel="KES ladder"
            centerValue={compactNumber(
              ladder.filter((b) => b.subFund === "KES_FIXED_INCOME").reduce((s, b) => s + b.marketValue, 0),
            )}
            formatValue={(v) => compactNumber(v)}
            segments={ladder
              .filter((b) => b.subFund === "KES_FIXED_INCOME")
              .sort((a, b) => a.rung - b.rung)
              .map((b, i) => ({ label: `#${b.rung} ${b.name}`, value: b.marketValue, colorIndex: i }))}
          />
        </ChartFrame>
      </div>

      <DataTable columns={columns} rows={ladder} />
    </div>
  );
}
