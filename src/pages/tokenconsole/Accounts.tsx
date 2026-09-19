import { PageHeader } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { calendarDate } from "../../lib/tokenConsole/format";
import type { InvestorContract } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";

export default function TokenConsoleAccounts() {
  const contracts = useAsyncData(tokenConsole.contracts);

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="Accounts"
        subtitle="Investor contracts: one per investor per product, and the anchor every posting hangs off."
      />
      <ConsoleTable<InvestorContract>
        what="accounts"
        source={contracts}
        rowId={(r) => r.contractId}
        emptyLabel="No accounts open"
        columns={[
          { key: "contract", header: "Contract", render: (r) => <Code>{r.contractId}</Code> },
          { key: "investor", header: "Investor", render: (r) => r.investorRef ?? "—" },
          { key: "product", header: "Product", render: (r) => <Code>{r.productId}</Code> },
          { key: "ccy", header: "Ccy", render: (r) => r.currency ?? "—", hideOnMobile: true },
          { key: "opened", header: "Opened", render: (r) => <span className="tabular text-xs text-text-soft">{calendarDate(r.openedAt)}</span>, hideOnMobile: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.contractStatus} /> },
        ]}
      />
    </div>
  );
}
