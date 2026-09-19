import { useEffect, useState } from "react";
import { type SubFund, type WithholdingPolicy } from "../mock";
import { getApprovalQueue, getSubFunds, getWithholdingPolicy } from "../lib/api";
import { PageHeader, Card, Badge, KeyValue, formatDateTime, Skeleton, FilterBar, SearchInput } from "../ui";
import { Link } from "react-router-dom";
import { useAsyncData } from "../lib/useAsyncData";

export default function Distributions() {
  const { data, loading } = useAsyncData(getApprovalQueue);
  const [query, setQuery] = useState("");
  const [wht, setWht] = useState<{ fund: SubFund; policy: WithholdingPolicy }[]>([]);

  useEffect(() => {
    getSubFunds().then(async (fs) => {
      const rows = await Promise.all(fs.map(async (fund) => ({ fund, policy: await getWithholdingPolicy(fund.code) })));
      setWht(rows);
    });
  }, []);

  const batches = (data ?? []).filter((i) => i.kind === "distribution_batch");
  const q = query.trim().toLowerCase();
  const shown = batches.filter((b) => !q || b.title.toLowerCase().includes(q) || b.detail.toLowerCase().includes(q));

  return (
    <div>
      <PageHeader title="Distributions" subtitle="Monthly coupon income batches — reinvest/payout elections and withholding tax applied before trustee sign-off." />

      {/* Withholding is per instrument, not per fund, and neither rate has been
          signed off by Tax yet (Open Question 7). Operations must not apply a
          batch without seeing which rate it is about to use. */}
      {wht.length > 0 && (
        <Card className="p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-text">Withholding tax applied to coupon income</span>
            {wht.some((r) => r.policy.unconfirmed) && <Badge tone="warning">Pending Tax confirmation</Badge>}
          </div>
          <KeyValue
            rows={wht.map(({ fund, policy }) => ({
              label: fund.name,
              value: `${(policy.rate * 100).toFixed(2)}% — ${policy.label}`,
            }))}
          />
          <p className="text-xs text-text-faint mt-3">
            Kenya infrastructure-bond income is exempt; Eurobond coupon income is not. Both rates are
            configured in{" "}
            <Link to="/settings" className="text-primary-600 font-medium">Platform Settings</Link>{" "}
            and remain provisional until Investcent Tax confirms treatment.
          </p>
        </Card>
      )}

      <FilterBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search batches…" />
        <span className="text-xs text-text-faint ml-auto">{shown.length} of {batches.length} batches</span>
      </FilterBar>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[0, 1].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {shown.map((b) => (
            <Card key={b.id} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-text">{b.title}</span>
                <Badge tone={b.status === "approved" ? "success" : "warning"}>{b.status}</Badge>
              </div>
              <p className="text-sm text-text-soft mb-3">{b.detail}</p>
              <KeyValue
                rows={[
                  { label: "Proposed by", value: b.proposedBy },
                  { label: "Submitted", value: formatDateTime(b.proposedAt) },
                  ...(b.decidedBy ? [{ label: "Trustee decision", value: `${b.status} by ${b.decidedBy}` }] : []),
                ]}
              />
            </Card>
          ))}
          {shown.length === 0 && (
            <p className="text-sm text-text-faint">
              {batches.length === 0 ? (
                <>No batches yet this cycle. Check <Link to="/approvals" className="text-primary-600 font-medium">Approvals</Link> once month-end runs.</>
              ) : (
                "No batches match your search."
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
