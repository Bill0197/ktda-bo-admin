import { PageHeader } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { dateTime, label, money, units } from "../../lib/tokenConsole/format";
import type { UnitHoldingRow, UnitLedgerActivityView } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable } from "../../components/tokenconsole/ConsoleTable";

const num = "tabular text-right whitespace-nowrap";

export default function TokenConsoleUnitLedger() {
  const holdings = useAsyncData(tokenConsole.unitLedger);
  const activity = useAsyncData(tokenConsole.unitLedgerActivity);

  return (
    <div>
      <PageHeader eyebrow="Baracel Unyt" title="Unit ledger" subtitle="Who holds what, and every movement that got them there." />

      <ConsoleTable<UnitHoldingRow>
        what="holdings"
        source={holdings}
        rowId={(r) => (r.investorId ? `${r.investorId}|${r.offeringId ?? ""}|${r.productId ?? ""}` : undefined)}
        title="Holdings"
        emptyLabel="No units outstanding"
        columns={[
          { key: "investor", header: "Investor", render: (r) => <span className="text-text">{r.investorRef ?? "—"}</span> },
          { key: "product", header: "Product", render: (r) => (
            <div>
              <Code>{r.productId}</Code>
              <div className="text-xs text-text-faint">{r.offeringId ?? "—"}</div>
            </div>
          ) },
          { key: "units", header: "Units", className: num, render: (r) => units(r.quantity) },
          { key: "price", header: "Price", className: num, render: (r) => money(r.pricePerUnit, r.currency), hideOnMobile: true },
          { key: "value", header: "Value", className: num, render: (r) => money(r.value, r.currency) },
        ]}
      />

      <ConsoleTable<UnitLedgerActivityView>
        what="unit movements"
        newest={(r) => r.occurredAt}
        source={activity}
        rowId={() => undefined}
        title="Activity"
        description="Subscriptions, redemptions and transfers."
        emptyLabel="No movements"
        columns={[
          { key: "when", header: "When", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.occurredAt)}</span> },
          { key: "action", header: "Action", render: (r) => <span className="text-text">{label(r.action)}</span> },
          { key: "investor", header: "Investor", render: (r) => r.investorRef ?? "—" },
          { key: "counterparty", header: "Counterparty", render: (r) => r.counterpartyRef ?? "—", hideOnMobile: true },
          { key: "reference", header: "Reference", render: (r) => <Code>{r.reference}</Code>, hideOnMobile: true },
          { key: "units", header: "Units", className: num, render: (r) => units(r.quantity) },
        ]}
      />
    </div>
  );
}
