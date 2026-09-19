import { useState } from "react";
import { getJurisdictions, proposeJurisdictionStatus, JURISDICTION_STATUS_LABELS, type Jurisdiction, type JurisdictionStatus } from "../../mock";
import { Card, Badge, Button, Modal, Field, Dropdown, Textarea, Skeleton, useToast, DataTable, type Column } from "../../ui";
import { useAsyncData } from "../../lib/useAsyncData";

const STATUS_TONE: Record<JurisdictionStatus, "success" | "info" | "warning" | "neutral"> = {
  open: "success",
  planned: "info",
  under_review: "warning",
  excluded: "neutral",
};

const PRIORITY_LABEL: Record<Jurisdiction["priority"], string> = {
  highest: "Highest",
  high: "High",
  medium_high: "Medium-high",
  medium: "Medium",
  low: "Low",
  excluded: "Excluded",
};

export function TokenizationTab({ me }: { me: string }) {
  const toast = useToast();
  const { data: jurisdictions, loading, error, reload, setData } = useAsyncData(getJurisdictions);
  const [active, setActive] = useState<Jurisdiction | null>(null);
  const [status, setStatus] = useState<JurisdictionStatus>("planned");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const open = (j: Jurisdiction) => {
    setActive(j);
    setStatus(j.status);
    setReason("");
  };

  const submit = async () => {
    if (!active) return;
    if (status === active.status) {
      toast.push("Select a status different from the current one", "warning");
      return;
    }
    if (!reason.trim()) {
      toast.push("A change reason is required — it goes on the approval item", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await proposeJurisdictionStatus(active.id, status, me, reason.trim());
      setData((prev) => (prev ? prev.map((j) => (j.id === updated.id ? { ...updated } : j)) : prev));
      toast.push("Whitelist change proposed — awaiting a second approver", "success");
      setActive(null);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not propose the change", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<Jurisdiction>[] = [
    {
      key: "segment",
      header: "Investor segment",
      render: (r) => (
        <div>
          <div className="text-text font-medium">{r.segment}</div>
          <div className="text-xs text-text-soft mt-0.5 max-w-md">{r.rationale}</div>
        </div>
      ),
    },
    { key: "priority", header: "Priority", render: (r) => <span className="text-sm text-text-soft">{PRIORITY_LABEL[r.priority]}</span>, hideOnMobile: true },
    { key: "timing", header: "Target timing", render: (r) => <span className="text-xs text-text-soft">{r.timing}</span>, hideOnMobile: true },
    { key: "kycTier", header: "KYC tier", render: (r) => <Badge tone={r.kycTier === "enhanced" ? "warning" : "neutral"}>{r.kycTier}</Badge>, hideOnMobile: true },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[r.status]}>{JURISDICTION_STATUS_LABELS[r.status]}</Badge>
          {r.pendingApprovalId && <Badge tone="warning">pending: {r.pendingSummary}</Badge>}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <Button size="sm" variant="outline" disabled={!!r.pendingApprovalId} onClick={() => open(r)}>
          Propose change
        </Button>
      ),
    },
  ];

  if (error) {
    return (
      <Card className="p-5 flex items-center justify-between">
        <span className="text-sm text-danger">{error}</span>
        <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
      </Card>
    );
  }

  if (loading || !jurisdictions) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  return (
    <>
      <Card className="p-4 mb-4 bg-surface-sunken border-none">
        <p className="text-xs text-text-soft leading-relaxed">
          Concept note §6.3 — the Phase 2 whitelist. When tokenized units launch, this matrix becomes the on-chain
          eligibility policy (only KYC-complete wallets in approved jurisdictions can hold units), so it sits under
          BO governance and maker-checker from day one.
        </p>
      </Card>
      <DataTable columns={columns} rows={jurisdictions} />

      <Modal open={!!active} onClose={() => !submitting && setActive(null)} title="Propose whitelist change" size="md">
        {active && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm font-semibold text-text">{active.segment}</div>
              <p className="text-xs text-text-soft mt-1">{active.rationale}</p>
            </div>
            <Field label="Status" required>
              <Dropdown
                value={status}
                onChange={(v) => setStatus(v as JurisdictionStatus)}
                options={(Object.keys(JURISDICTION_STATUS_LABELS) as JurisdictionStatus[]).map((s) => ({ value: s, label: JURISDICTION_STATUS_LABELS[s] }))}
                ariaLabel="Status"
              />
            </Field>
            <Field label="Reason for change" required hint="Whitelist changes carry compliance weight — write it for the checker and the regulator.">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. CMA sandbox approval received for diaspora subscriptions…" />
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
