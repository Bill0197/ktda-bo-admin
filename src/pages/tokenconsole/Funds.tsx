import { Badge, PageHeader } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { money, percent } from "../../lib/tokenConsole/format";
import type { BondLadderView, FundResponse, Institution, SubFundResponse } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";

const num = "tabular text-right whitespace-nowrap";

export default function TokenConsoleFunds() {
  const funds = useAsyncData(tokenConsole.funds);
  const subFunds = useAsyncData(tokenConsole.subFunds);
  const ladders = useAsyncData(tokenConsole.ladders);
  const institutions = useAsyncData(tokenConsole.institutions);

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="Funds"
        subtitle="The structure products hang off: institutions, funds, sub-funds and their bond ladders."
      />

      <ConsoleTable<BondLadderView>
        what="bond ladders"
        source={ladders}
        rowId={(r) => r.subFundId}
        title="Bond ladders"
        description="Coupon cover and capacity per sub-fund. Headroom is what can still be sold before claims exceed what the ladder pays."
        emptyLabel="No ladders built"
        columns={[
          { key: "subFund", header: "Sub-fund", render: (r) => (
            <div>
              <div className="text-text font-medium">{r.subFundName ?? "—"}</div>
              <div className="text-xs text-text-faint">{r.currency ?? ""} · blended coupon {percent(r.blendedCoupon)}</div>
            </div>
          ) },
          { key: "capacity", header: "Capacity", className: num, render: (r) => money(r.capacity, r.currency), hideOnMobile: true },
          { key: "claims", header: "Claims", className: num, render: (r) => money(r.claims, r.currency), hideOnMobile: true },
          { key: "headroom", header: "Headroom", className: num, render: (r) => (
            <span className={(r.headroom ?? 0) < 0 ? "text-danger" : undefined}>{money(r.headroom, r.currency)}</span>
          ) },
          { key: "cover", header: "Coupon cover", render: (r) => r.everyMonthCovered === undefined
            ? <span className="text-text-faint">—</span>
            : <Badge tone={r.everyMonthCovered ? "success" : "warning"} className="whitespace-nowrap">{r.everyMonthCovered ? "Every month" : "Gaps"}</Badge> },
        ]}
      />

      <ConsoleTable<SubFundResponse>
        what="sub-funds"
        source={subFunds}
        rowId={(r) => r.subFundId}
        title="Sub-funds"
        emptyLabel="No sub-funds"
        columns={[
          { key: "name", header: "Name", render: (r) => <span className="text-text font-medium">{r.name ?? "—"}</span> },
          { key: "ccy", header: "Ccy", render: (r) => r.baseCurrency ?? "—" },
          { key: "min", header: "Minimum", className: num, render: (r) => money(r.minInvestmentAmount, r.baseCurrency), hideOnMobile: true },
          { key: "gate", header: "Gate", className: num, render: (r) => percent(r.gatePct), hideOnMobile: true },
          { key: "facility", header: "Facility", className: num, render: (r) => money(r.facilitySize, r.baseCurrency), hideOnMobile: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />

      <ConsoleTable<FundResponse>
        what="funds"
        source={funds}
        rowId={(r) => r.fundId}
        title="Funds"
        emptyLabel="No funds"
        columns={[
          { key: "name", header: "Name", render: (r) => <span className="text-text font-medium">{r.name ?? "—"}</span> },
          { key: "reg", header: "Registration", render: (r) => <Code>{r.registrationRef}</Code> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />

      <ConsoleTable<Institution>
        what="institutions"
        source={institutions}
        rowId={(r) => r.institutionId}
        title="Institutions"
        emptyLabel="No institutions"
        columns={[
          { key: "name", header: "Name", render: (r) => <span className="text-text font-medium">{r.name ?? "—"}</span> },
          { key: "country", header: "Country", render: (r) => r.country ?? "—" },
          { key: "ccy", header: "Local ccy", render: (r) => r.localCurrency ?? "—" },
        ]}
      />
    </div>
  );
}
