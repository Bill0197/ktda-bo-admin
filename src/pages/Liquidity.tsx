import { useEffect, useState } from "react";
import { type FacilityState, type FeeAccrual, type SubFund } from "../mock";
import { getFacilityState, getFeeAccrual, getSubFunds } from "../lib/api";
import { PageHeader, Card, ProgressBar, Money, Badge, GaugeArc, compactNumber } from "../ui";

export default function Liquidity() {
  const [funds, setFunds] = useState<SubFund[]>([]);
  const [facilities, setFacilities] = useState<Record<string, FacilityState>>({});
  const [fees, setFees] = useState<Record<string, FeeAccrual>>({});

  useEffect(() => {
    getSubFunds().then(async (fs) => {
      setFunds(fs);
      const [facRows, feeRows] = await Promise.all([
        Promise.all(fs.map(async (f) => [f.code, await getFacilityState(f.code)] as const)),
        Promise.all(fs.map(async (f) => [f.code, await getFeeAccrual(f.code)] as const)),
      ]);
      setFacilities(Object.fromEntries(facRows));
      setFees(Object.fromEntries(feeRows));
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Liquidity, facility & fee accrual"
        tooltip="A 'gate' is a safeguard that can delay large withdrawals during a stress period, so the fund isn't forced to sell assets in a fire sale. AUM = Assets Under Management. FIFO = first-in-first-out — earliest withdrawal requests are paid first."
        subtitle="Redemptions above 10% of a sub-fund's AUM in a period trigger the gate clause — FIFO deferral, up to 5 dealing days. The facility must stay above its scaling covenant as AUM grows."
      />
      <div className="flex flex-col gap-5">
        {funds.map((f) => {
          const facility = facilities[f.code];
          const fee = fees[f.code];
          const gateThreshold = facility?.gateThresholdValue ?? f.aum * 0.1;
          const utilisation = f.liquidityUsed / gateThreshold;
          const facilityUsage = f.liquidityUsed / f.liquidityFacility;

          let tone: "danger" | "warning" | "success" = "success";
          let label = "Healthy";
          if (f.gateActive || facility?.covenantBreached) {
            tone = "danger";
            label = f.gateActive ? "Gate active" : "Covenant breached";
          } else if (utilisation > 0.7) {
            tone = "warning";
            label = "Watch";
          }

          return (
            <Card key={f.code} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-text">{f.name}</span>
                <Badge tone={tone}>{label}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-6 mb-4">
                <GaugeArc
                  value={utilisation}
                  markerAt={1}
                  tone={tone === "danger" ? "danger" : utilisation > 0.7 ? "warning" : "success"}
                  label={`${(utilisation * 100).toFixed(0)}%`}
                  caption={<span className="block">of the gate<br />{compactNumber(f.liquidityUsed)} / {compactNumber(gateThreshold)}</span>}
                />
                <div className="grid grid-cols-2 gap-6 flex-1 min-w-[220px]">
                  <div>
                    <div className="text-xs text-text-faint mb-1">Redemptions this period</div>
                    <div className="text-lg font-semibold tabular text-text"><Money amount={f.liquidityUsed} currency={f.currency} /></div>
                  </div>
                  <div>
                    <div className="text-xs text-text-faint mb-1">Gate threshold (10% AUM)</div>
                    <div className="text-lg font-semibold tabular text-text"><Money amount={gateThreshold} currency={f.currency} /></div>
                  </div>
                </div>
              </div>
              <div className="mb-1 flex justify-between text-xs text-text-faint"><span>Gate utilisation</span><span>{(utilisation * 100).toFixed(1)}%</span></div>
              <ProgressBar value={utilisation * 100} tone={utilisation > 0.9 ? "danger" : utilisation > 0.6 ? "warning" : "primary"} />

              <div className="mt-4 mb-1 flex justify-between text-xs text-text-faint"><span>Liquidity facility drawn</span><span>{(facilityUsage * 100).toFixed(1)}% of <Money amount={f.liquidityFacility} currency={f.currency} compact /></span></div>
              <ProgressBar value={facilityUsage * 100} tone="primary" />

              {facility && (
                <div className="mt-5 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Metric label="Headroom" value={<Money amount={facility.headroom} currency={f.currency} compact />} />
                  <Metric
                    label="Facility rate"
                    value={`${(facility.interestRate * 100).toFixed(2)}% p.a.`}
                    note="CBR + margin"
                  />
                  <Metric
                    label="Interest accrued"
                    value={<Money amount={facility.interestAccrued} currency={f.currency} />}
                    note="Charged to the fund as an expense"
                  />
                  {/* The 5%-of-AUM scaling covenant is what the trustee reviews
                      quarterly — a breach must be visible, not derived by hand. */}
                  <Metric
                    label="Covenant minimum"
                    value={<Money amount={facility.covenantMinimum} currency={f.currency} compact />}
                    note={facility.covenantBreached ? "Facility is below the covenant" : "Facility is above the covenant"}
                    tone={facility.covenantBreached ? "danger" : undefined}
                  />
                </div>
              )}

              {fee && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-xs uppercase tracking-wide text-text-faint mb-2">Management fee accrual</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Metric label="Annual rate" value={`${(fee.annualRate * 100).toFixed(2)}% of NAV`} />
                    <Metric label="Accrued today" value={<Money amount={fee.dailyAccrual} currency={f.currency} />} />
                    <Metric label="Accrued, unsettled" value={<Money amount={fee.accruedToDate} currency={f.currency} />} />
                  </div>
                  {/* The fee is never debited from an investor's principal — it
                      reduces NAV, so this is the only place it is visible. */}
                  <p className="text-xs text-text-faint mt-3">
                    Deducted from AUM before NAV is struck, worth {fee.navImpactPerUnit.toFixed(6)} {f.currency} per unit today.
                    No investor's principal or unit balance is debited.
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, note, tone }: Readonly<{ label: string; value: React.ReactNode; note?: string; tone?: "danger" }>) {
  return (
    <div>
      <div className="text-xs text-text-faint mb-1">{label}</div>
      <div className={`text-sm font-semibold tabular ${tone === "danger" ? "text-danger" : "text-text"}`}>{value}</div>
      {note && <div className="text-xs text-text-faint mt-0.5">{note}</div>}
    </div>
  );
}
