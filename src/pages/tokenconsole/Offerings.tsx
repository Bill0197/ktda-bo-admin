import { PageHeader } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { dateTime, money, units } from "../../lib/tokenConsole/format";
import type { OfferingResponse } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";

const num = "tabular text-right whitespace-nowrap";

export default function TokenConsoleOfferings() {
  const offerings = useAsyncData(tokenConsole.offerings);

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="Offerings"
        subtitle="Primary issuance windows: what is on sale, at what price, and how much of it is left."
      />
      <ConsoleTable<OfferingResponse>
        what="offerings"
        source={offerings}
        rowId={(r) => r.offeringId}
        emptyLabel="No offerings"
        columns={[
          { key: "offering", header: "Offering", render: (r) => (
            <div>
              <Code>{r.offeringId}</Code>
              <div className="text-xs text-text-faint">{r.productId ?? "—"}</div>
            </div>
          ) },
          { key: "price", header: "Price", className: num, render: (r) => money(r.pricePerUnit, r.currency) },
          { key: "total", header: "Total units", className: num, render: (r) => units(r.totalUnits), hideOnMobile: true },
          { key: "issued", header: "Issued", className: num, render: (r) => units(r.outstandingUnits) },
          { key: "remaining", header: "Remaining", className: num, render: (r) => units(r.remainingUnits) },
          { key: "created", header: "Created", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.createdAt)}</span>, hideOnMobile: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </div>
  );
}
