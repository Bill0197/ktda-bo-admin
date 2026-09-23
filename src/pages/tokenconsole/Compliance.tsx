import { PageHeader } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { dateTime, shortId } from "../../lib/tokenConsole/format";
import type { ComplianceReviewItem } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";

/** Read-only here, as in tokenization-web. KYC items are decided on the KYC
 * desk (and BO Admin's KYC Onboarding queue); anything else stays with
 * Compliance until it is decided which queue owns it. */
export default function TokenConsoleCompliance() {
  const reviews = useAsyncData(tokenConsole.complianceReviews);
  const open = (reviews.data ?? []).filter((r) => r.status === "OPEN").length;

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="Review queue"
        subtitle="Items land here when onboarding or a movement in the accounting service trips a rule and needs a human decision."
      />
      <ConsoleTable<ComplianceReviewItem>
        what="the review queue"
        source={reviews}
        rowId={(r) => r.queueId}
        title="Reviews"
        description={reviews.data ? `${open} open of ${reviews.data.length}` : undefined}
        emptyLabel="Queue is clear"
        columns={[
          { key: "investor", header: "Investor", render: (r) => <Code>{shortId(r.investorId)}</Code> },
          { key: "reason", header: "Reason", render: (r) => <span className="text-sm text-text">{r.reason ?? "—"}</span> },
          { key: "assigned", header: "Assigned", render: (r) => r.assignedTo ?? "—", hideOnMobile: true },
          { key: "opened", header: "Opened", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.openedAt)}</span>, hideOnMobile: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </div>
  );
}
