import { useState } from "react";
import { getApprovalPolicies, proposeApprovalRouteChange, ROLE_LABELS, APPROVAL_KIND_LABELS, type ApprovalPolicyRule, type AdminRole } from "../../mock";
import { Card, Badge, Button, Modal, Field, Textarea, Skeleton, useToast } from "../../ui";
import { useAsyncData } from "../../lib/useAsyncData";

const ALL_ROLES = Object.keys(ROLE_LABELS) as AdminRole[];

export function ApprovalRoutingTab({ me }: { me: string }) {
  const toast = useToast();
  const { data: rules, loading, error, reload, setData } = useAsyncData(getApprovalPolicies);
  const [active, setActive] = useState<ApprovalPolicyRule | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const open = (r: ApprovalPolicyRule) => {
    setActive(r);
    setRoles([...r.approverRoles]);
    setReason("");
  };

  const toggleRole = (role: AdminRole) => {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const submit = async () => {
    if (!active) return;
    if (roles.length === 0) {
      toast.push("At least one approver role is required", "warning");
      return;
    }
    const unchanged = roles.length === active.approverRoles.length && roles.every((r) => active.approverRoles.includes(r));
    if (unchanged) {
      toast.push("Select a different approver set from the current one", "warning");
      return;
    }
    if (!reason.trim()) {
      toast.push("A change reason is required — it goes on the approval item", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await proposeApprovalRouteChange(active.id, roles, me, reason.trim());
      setData((prev) => (prev ? prev.map((r) => (r.id === updated.id ? { ...updated } : r)) : prev));
      toast.push("Routing change proposed — awaiting a second approver", "success");
      setActive(null);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not propose the change", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <Card className="p-5 flex items-center justify-between">
        <span className="text-sm text-danger">{error}</span>
        <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
      </Card>
    );
  }

  if (loading || !rules) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="p-5 pb-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text">Delegation of Authority — who may approve what</h2>
          <p className="text-xs text-text-soft mt-0.5">
            The Approvals queue enforces these bands: a role outside a band's approver set can see the item but not decide it.
            Seed limits are indicative — real DoA assignments are Open Question 8 with Investcent.
          </p>
        </div>
        <ul className="divide-y divide-border">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone="info">{APPROVAL_KIND_LABELS[r.kind]}</Badge>
                  <span className="text-sm font-medium text-text">{r.label}</span>
                  {r.pendingApprovalId && <Badge tone="warning">pending: {r.pendingSummary}</Badge>}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[11px] text-text-faint uppercase tracking-wide">Approvers:</span>
                  {r.approverRoles.map((role) => (
                    <Badge key={role} tone="neutral">{ROLE_LABELS[role]}</Badge>
                  ))}
                </div>
              </div>
              <Button size="sm" variant="outline" disabled={!!r.pendingApprovalId} onClick={() => open(r)} className="shrink-0">
                Propose change
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Modal open={!!active} onClose={() => !submitting && setActive(null)} title="Propose approver change" size="md">
        {active && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm font-semibold text-text">{active.label}</div>
              <p className="text-xs text-text-soft mt-1">Select every role allowed to act as checker for this band.</p>
            </div>
            <div className="flex flex-col gap-2">
              {ALL_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2.5 text-sm text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="h-4 w-4 accent-[var(--primary-600)]"
                  />
                  {ROLE_LABELS[role]}
                </label>
              ))}
            </div>
            <Field label="Reason for change" required>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Board-approved DoA revision, Aug 2026…" />
            </Field>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" disabled={submitting} onClick={() => setActive(null)}>Cancel</Button>
              <Button disabled={submitting} onClick={submit}>{submitting ? "Submitting…" : "Submit for approval"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
