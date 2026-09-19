import { useEffect, useState } from "react";
import { type FeeAccrual, type NavComposition, type SubFund } from "../mock";
import { getFeeAccrual, getNavComposition, getNavHistory, getSubFunds } from "../lib/api";
import { PageHeader, Card, Badge, Money, formatDate, KeyValue, TimeSeriesChart, ShareBar, compactNumber } from "../ui";
import { Link } from "react-router-dom";

export default function Nav() {
  const [funds, setFunds] = useState<SubFund[]>([]);
  const [history, setHistory] = useState<Record<string, { date: string; nav: number }[]>>({});
  const [composition, setComposition] = useState<Record<string, NavComposition>>({});
  const [fees, setFees] = useState<Record<string, FeeAccrual>>({});

  useEffect(() => {
    getSubFunds().then(async (fs) => {
      setFunds(fs);
      const [hist, comps, feeRows] = await Promise.all([
        Promise.all(fs.map(async (f) => [f.code, await getNavHistory(f.code, 30)] as const)),
        Promise.all(fs.map(async (f) => [f.code, await getNavComposition(f.code)] as const)),
        Promise.all(fs.map(async (f) => [f.code, await getFeeAccrual(f.code)] as const)),
      ]);
      setHistory(Object.fromEntries(hist));
      setComposition(Object.fromEntries(comps));
      setFees(Object.fromEntries(feeRows));
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="NAV"
        tooltip="NAV = Net Asset Value. The fund's price per unit, recalculated every day from the value of the bonds it holds."
        subtitle="Built from positions, cash, accrued income and accrued expenses — then independently reviewed before publication."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {funds.map((f) => {
          const comp = composition[f.code];
          const fee = fees[f.code];
          // A non-zero variance between the derived and published price is
          // exactly what the independent review step exists to examine.
          const hasVariance = comp ? Math.abs(comp.variance) >= 0.0001 : false;
          return (
            <Card key={f.code} className="p-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-text">{f.name}</span>
                <Badge tone="info">published {formatDate(f.navAsOf)}</Badge>
              </div>
              <div className="text-2xl font-semibold tabular text-text mb-3"><Money amount={f.nav} currency={f.currency} /></div>
              {history[f.code] && (
                <TimeSeriesChart
                  height={140}
                  labels={history[f.code].map((p) => formatDate(p.date).replace(/ \d{4}$/, ""))}
                  series={[{ label: `${f.code} NAV`, values: history[f.code].map((p) => p.nav), colorIndex: f.currency === "KES" ? 0 : 2 }]}
                  formatValue={(v) => v.toFixed(2)}
                />
              )}

              {comp && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-xs uppercase tracking-wide text-text-faint mb-3">Today's composition</div>
                  {/* A share bar, not a donut: the ladder is ~97% of AUM, and a
                      ring with two slivers in it hides the parts that move. */}
                  <ShareBar
                    formatValue={(v) => compactNumber(v)}
                    segments={[
                      { label: "Bond ladder", value: comp.bondMarketValue, colorIndex: 0 },
                      { label: "Cash", value: comp.cashBalance, colorIndex: 2 },
                      { label: "Accrued income", value: comp.accruedIncome, colorIndex: 3 },
                    ]}
                  />
                  <div className="h-4" />
                  <KeyValue
                    rows={[
                      { label: "Bond ladder (mark to market)", value: <Money amount={comp.bondMarketValue} currency={f.currency} /> },
                      { label: "Cash", value: <Money amount={comp.cashBalance} currency={f.currency} /> },
                      { label: "Accrued coupon income", value: <Money amount={comp.accruedIncome} currency={f.currency} /> },
                      { label: "Accrued fees & facility interest", value: <>− <Money amount={comp.accruedFees} currency={f.currency} /></> },
                      { label: "Total AUM", value: <Money amount={comp.totalAum} currency={f.currency} /> },
                      { label: "Units outstanding", value: comp.unitsOutstanding.toLocaleString() },
                      { label: "Derived NAV per unit", value: <Money amount={comp.derivedNav} currency={f.currency} /> },
                    ]}
                  />
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-text-faint">Variance vs published</span>
                    <Badge tone={hasVariance ? "warning" : "success"}>
                      {comp.variance >= 0 ? "+" : "−"}{Math.abs(comp.variance).toFixed(4)} {f.currency}
                    </Badge>
                  </div>
                  {fee && (
                    <p className="text-xs text-text-faint mt-2">
                      Includes <Money amount={fee.accruedToDate} currency={f.currency} /> accrued management fee
                      ({(fee.annualRate * 100).toFixed(2)}% p.a.), worth {fee.navImpactPerUnit.toFixed(6)} {f.currency} per unit.
                    </p>
                  )}
                </div>
              )}

              <p className="text-xs text-text-faint mt-3">
                {hasVariance
                  ? "Derived NAV differs from the published price — publication is gated on independent review in the "
                  : "Derived NAV matches the published price. Publication still requires sign-off in the "}
                <Link to="/approvals" className="text-primary-600 font-medium">Approvals queue</Link>.
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
