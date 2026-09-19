import { useState } from "react";
import { getRedemptionTierConfig, proposeTierChange, type RedemptionTier } from "../../mock";
import { Card, Badge, Button, Modal, Field, Input, Textarea, Skeleton, useToast } from "../../ui";
import { Clock } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

export function RedemptionTiersTab({ me }: { me: string }) {
  const toast = useToast();
  const { data: tiers, loading, error, reload, setData } = useAsyncData(getRedemptionTierConfig);
  const [active, setActive] = useState<RedemptionTier | null>(null);
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const open = (t: RedemptionTier) => {
    setActive(t);
    setDays(String(t.settlementDays));
    setReason("");
  };

  const submit = async () => {
    if (!active) return;
    const parsed = Number(days);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 90) {
      toast.push("Settlement days must be a whole number between 0 and 90", "warning");
      return;
    }
    if (parsed === active.settlementDays) {
      toast.push("Enter a value different from the current one", "warning");
      return;
    }
    if (!reason.trim()) {
      toast.push("A change reason is required — it goes on the approval item", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await proposeTierChange(active.id, parsed, me, reason.trim());
      setData((prev) => (prev ? prev.map((t) => (t.id === updated.id ? { ...updated } : t)) : prev));
      toast.push("Tier change proposed — awaiting a second approver", "success");
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

  if (loading || !tiers) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-12 w-full mb-2" />
            <Skeleton className="h-12 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(["KES", "USD"] as const).map((currency) => (
          <Card key={currency} className="overflow-hidden">
            <div className="p-5 pb-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text">{currency} redemption schedule</h2>
              <p className="text-xs text-text-soft mt-0.5">
                {currency === "KES"
                  ? "Concept note §5.2 — same-day liquidity for small retail tickets, longer notice for institutional sizes."
                  : "Indicative bands — the concept note defines no USD schedule; confirm with Investcent before launch."}
              </p>
            </div>
            <ul className="divide-y divide-border">
              {tiers.filter((t) => t.currency === currency).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-text">{t.label}</span>
                      {t.pendingApprovalId && <Badge tone="warning">pending: {t.pendingSummary}</Badge>}
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 text-sm tabular text-text-soft shrink-0">
                    <Clock size={13} className="text-text-faint" />
                    {t.settlementDays === 0 ? "Same day" : `${t.settlementDays} business days`}
                  </span>
                  <Button size="sm" variant="outline" disabled={!!t.pendingApprovalId} onClick={() => open(t)}>
                    Propose change
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Modal open={!!active} onClose={() => !submitting && setActive(null)} title="Propose a tier change" size="md">
        {active && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm font-semibold text-text">{active.label} ({active.currency})</div>
              <p className="text-xs text-text-soft mt-1">
                Currently {active.settlementDays === 0 ? "same-day settlement" : `${active.settlementDays} business days`}. Investor apps quote settlement timing from this schedule.
              </p>
            </div>
            <Field label="Settlement days" required hint="0 = same-day settlement.">
              <Input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} autoFocus />
            </Field>
            <Field label="Reason for change" required>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Facility renewal allows faster mid-tier settlement…" />
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
