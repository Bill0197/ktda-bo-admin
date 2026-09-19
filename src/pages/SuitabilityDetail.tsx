import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Lead } from "../mock";
import { getApprovalQueue, getLeads, logInteraction } from "../lib/api";
import { PageHeader, Card, Badge, Button, KeyValue, Skeleton, EmptyState, useToast, formatDateTime } from "../ui";
import { ArrowLeft, PhoneCall, ClipboardCheck } from "lucide-react";
import { useAsyncData } from "../lib/useAsyncData";

export default function SuitabilityDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data: queue, loading } = useAsyncData(getApprovalQueue);
  const { data: allLeads } = useAsyncData(getLeads);
  const [busy, setBusy] = useState(false);
  const [callLogged, setCallLogged] = useState(false);

  const item = (queue ?? []).find((e) => e.id === id && e.kind === "kyc_exception");
  const lead: Lead | undefined = item ? (allLeads ?? []).find((l) => item.title.includes(l.name)) : undefined;

  /** logDiscoveryCall had no dedicated endpoint on the real backend — it's
   * ported onto the existing interactions log (`POST /api/interactions`,
   * already wired in api.crm.ts) rather than a new one-off route, per the
   * same `subjectType: "lead"` / `type: "call_outbound"` shape every other
   * CRM interaction uses. Needs the underlying lead (not just the approval
   * item) since an interaction is logged against a subject. */
  const logCall = async () => {
    if (!item || !lead) return;
    setBusy(true);
    try {
      await logInteraction({
        subjectType: "lead",
        subjectId: lead.id,
        type: "call_outbound",
        summary: `Suitability discovery call — ${applicant}`,
        detail: item.detail,
      });
      setCallLogged(true);
      toast.push("Discovery call logged — the suitability score will re-run after the call.", "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not log the call", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!item) {
    return (
      <Card>
        <EmptyState
          icon={<ClipboardCheck size={20} />}
          title="Exception not found"
          body="This suitability exception may have been decided already, or the link is stale."
          action={<Link to="/suitability" className="text-sm text-primary-600 font-medium">Back to the queue</Link>}
        />
      </Card>
    );
  }

  const applicant = item.title.replace("Suitability exception — ", "");

  return (
    <div>
      <Link to="/suitability" className="inline-flex items-center gap-1.5 text-sm text-text-soft hover:text-text mb-4">
        <ArrowLeft size={15} /> Suitability queue
      </Link>

      <PageHeader
        title={applicant}
        subtitle="Below-threshold suitability score — held for a BD Officer discovery call before activation."
        actions={<Badge tone={item.status === "pending" ? "warning" : item.status === "approved" ? "success" : "danger"}>{item.status === "pending" ? "awaiting call" : item.status}</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-text mb-4">Exception</h2>
          <p className="text-sm text-text-soft leading-relaxed mb-4">{item.detail}</p>
          <KeyValue
            rows={[
              { label: "Flagged", value: formatDateTime(item.proposedAt) },
              { label: "Raised by", value: item.proposedBy },
              ...(lead
                ? [
                    { label: "Phone", value: <span className="tabular">{lead.phone}</span> },
                    { label: "Lead source", value: lead.source },
                    { label: "Score", value: lead.suitabilityScore != null ? `${lead.suitabilityScore}/100` : "—" },
                  ]
                : []),
            ]}
          />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-text mb-1">Next step</h2>
          <p className="text-xs text-text-soft mb-4">
            Call the applicant, walk through objectives, liquidity needs and risk tolerance, then re-run the score.
            If it still lands below the pass mark, the exception goes to Compliance via the Approvals queue.
          </p>
          <div className="flex items-center gap-2">
            <Button disabled={busy || callLogged || !lead || item.status !== "pending"} onClick={logCall}>
              <PhoneCall size={14} /> {callLogged ? "Call logged" : busy ? "Logging…" : "Log discovery call"}
            </Button>
            <Link to="/approvals" className="text-sm text-primary-600 font-medium">View in Approvals</Link>
            {!lead && <span className="text-[11px] text-text-faint">No matching lead record — can't log an interaction.</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}
