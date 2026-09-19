import { useState } from "react";
import { getRiskFactors, addRiskFactor, setRiskFactorEnabled } from "../../mock";
import { Card, Button, Toggle, Field, Input, Skeleton, useToast } from "../../ui";
import { Plus } from "lucide-react";
import { useAsyncData } from "../../lib/useAsyncData";

export function RiskFactorsTab({ me }: { me: string }) {
  const toast = useToast();
  const { data: factors, loading, error, reload, setData } = useAsyncData(getRiskFactors);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const add = async () => {
    if (!label.trim()) {
      toast.push("A factor label is required", "warning");
      return;
    }
    setBusy("add");
    try {
      const created = await addRiskFactor(label.trim(), description.trim(), me);
      setData((prev) => (prev ? [...prev, created] : prev));
      setLabel("");
      setDescription("");
      toast.push(`"${created.label}" added to the catalogue`, "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not add the factor", "error");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (id: string, enabled: boolean) => {
    setBusy(id);
    try {
      const updated = await setRiskFactorEnabled(id, enabled, me);
      setData((prev) => (prev ? prev.map((f) => (f.id === updated.id ? { ...updated } : f)) : prev));
      toast.push(`"${updated.label}" ${enabled ? "enabled" : "disabled"}`, enabled ? "success" : "info");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not update the factor", "error");
    } finally {
      setBusy(null);
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

  if (loading || !factors) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
      <Card className="overflow-hidden">
        <div className="p-5 pb-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text">Risk-factor catalogue</h2>
          <p className="text-xs text-text-soft mt-0.5">
            The selectable factors when Compliance assigns a customer risk rating. Disabled factors stay on
            existing profiles but can't be newly selected. Every change is audit-logged.
          </p>
        </div>
        <ul className="divide-y divide-border">
          {factors.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-text">{f.label}</span>
                <p className="text-xs text-text-soft mt-0.5">{f.description}</p>
              </div>
              <div className={busy === f.id ? "opacity-50 pointer-events-none" : ""}>
                <Toggle checked={f.enabled} onChange={(v) => toggle(f.id, v)} label={f.label} />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 lg:sticky lg:top-24">
        <h2 className="text-sm font-semibold text-text mb-3">Add a factor</h2>
        <div className="flex flex-col gap-3">
          <Field label="Label" required>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Geography" />
          </Field>
          <Field label="Description">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When this factor applies" />
          </Field>
          <Button disabled={busy === "add"} onClick={add}>
            <Plus size={14} /> {busy === "add" ? "Adding…" : "Add to catalogue"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
