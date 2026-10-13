import { useEffect, useState } from "react";
import {
  getClassifierHistory, getClassifiersAsOf, getProductEligibility, setClassifier, getClassifierTypes,
  type ClassifierTypeId,
} from "../mock";
import {
  Card, Badge, DataTable, Skeleton, Button, Modal, Field, Input, Select, EmptyState,
  useToast, formatDate, type Column,
} from "../ui";
import { useAuth, ADMIN_USERS } from "../lib/auth";
import { useAsyncData } from "../lib/useAsyncData";

type HistoryRow = Awaited<ReturnType<typeof getClassifierHistory>>[number];
type AsOfRow = Awaited<ReturnType<typeof getClassifiersAsOf>>[number];

/** Risk tier, KYC status and jurisdiction as dated assignments rather than
 * columns, so a change never erases what was true before it. The as-of query
 * is the whole point: on the live system the intended risk-history table is
 * empty and nobody can answer "what was their tier on this date". */
export default function ClassifierPanel({ clientId }: { clientId: string }) {
  const { role } = useAuth();
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [asOf, setAsOf] = useState(today);
  const [asOfRows, setAsOfRows] = useState<AsOfRow[] | null>(null);
  const [asOfLoading, setAsOfLoading] = useState(false);
  const [editing, setEditing] = useState<ClassifierTypeId | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: history, loading, reload } = useAsyncData(() => getClassifierHistory(clientId));
  const { data: types } = useAsyncData(getClassifierTypes);
  const { data: eligibility, reload: reloadEligibility } = useAsyncData(() => getProductEligibility(clientId));

  const me = role ? ADMIN_USERS[role].name : "";
  const canAssign = role === "compliance" || role === "mlro" || role === "system_admin";

  /* Re-queries whenever the date changes, and drops a stale response that
     lands after a newer one — typing through a date field fires several. */
  useEffect(() => {
    if (!asOf) return;
    let live = true;
    setAsOfLoading(true);
    getClassifiersAsOf(clientId, asOf)
      .then((rows) => { if (live) setAsOfRows(rows); })
      .catch(() => { if (live) setAsOfRows(null); })
      .finally(() => { if (live) setAsOfLoading(false); });
    return () => { live = false; };
  }, [clientId, asOf]);

  const submit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const result = await setClassifier(clientId, editing, value, me, reason.trim() || undefined);
      toast.push(
        result
          ? "Assigned. The previous window is closed, not overwritten — the old value stays answerable."
          : "Already set to that value; no new window opened.",
        "success",
      );
      setEditing(null);
      setValue("");
      setReason("");
      reload();
      reloadEligibility();
      const refreshed = await getClassifiersAsOf(clientId, asOf);
      setAsOfRows(refreshed);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not assign", "error");
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<HistoryRow>[] = [
    { key: "type", header: "Classifier", render: (r) => <span className="text-text">{r.typeLabel}</span> },
    { key: "value", header: "Value", render: (r) => (
      <div className="flex items-center gap-2">
        <span className="text-text font-medium">{r.valueLabel}</span>
        {r.current && <Badge tone="success">current</Badge>}
      </div>
    ) },
    { key: "from", header: "Valid from", render: (r) => <span className="tabular">{formatDate(r.validFrom)}</span> },
    { key: "to", header: "Valid to", render: (r) => r.validTo
      ? <span className="tabular">{formatDate(r.validTo)}</span>
      : <span className="text-text-faint">open</span>, hideOnMobile: true },
    { key: "prev", header: "Was", render: (r) => r.previousValue
      ? <span className="text-text-soft">{r.previousValue}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true, defaultHidden: true },
    { key: "by", header: "Assigned by", render: (r) => <span className="text-text-soft">{r.assignedBy}</span>, hideOnMobile: true },
    { key: "reason", header: "Why it changed", render: (r) => r.reason
      ? <span className="text-xs text-text-soft max-w-sm block">{r.reason}</span>
      : <span className="text-text-faint">—</span>, hideOnMobile: true },
  ];

  const editingType = types?.find((t) => t.id === editing);

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-text">State as of a date</h2>
            <p className="text-xs text-text-faint mt-1 max-w-xl">
              Pick any past date to see what was true then — the question a regulator asks first, and the one a
              mutable status column cannot answer.
            </p>
          </div>
          <Field label="As of">
            <Input type="date" value={asOf} max={today} onChange={(e) => setAsOf(e.target.value)} />
          </Field>
        </div>

        {asOfLoading && <Skeleton className="h-24" />}
        {!asOfLoading && asOfRows && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {asOfRows.map((r) => (
              <div key={r.typeId} className="rounded-lg border border-border bg-surface-sunken p-3">
                <div className="text-xs text-text-faint mb-1">{r.label}</div>
                <div className="text-sm font-semibold text-text">
                  {r.valueLabel ?? <span className="text-text-faint font-normal">not assigned</span>}
                </div>
                {r.since && <div className="text-[11px] text-text-faint mt-1 tabular">since {formatDate(r.since)}</div>}
                {r.reason && <div className="text-[11px] text-text-soft mt-1.5 leading-snug">{r.reason}</div>}
                {canAssign && (
                  <button
                    type="button"
                    className="mt-2 text-[11px] font-medium text-primary-600 hover:text-primary-700"
                    onClick={() => { setEditing(r.typeId); setValue(r.value ?? ""); setReason(""); }}
                  >
                    Reassign
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {eligibility && (
        <Card className={`p-4 border-l-4 ${eligibility.eligible ? "border-l-success" : "border-l-warning"}`}>
          <div className="text-sm font-semibold text-text mb-1">
            {eligibility.eligible ? "Eligible for product access" : "Not eligible for product access"}
          </div>
          <p className="text-[13px] text-text-soft">
            {eligibility.eligible
              ? "Every gating classifier holds an approved value. Eligibility is a rule read against these assignments, not a check re-implemented per module."
              : <>Blocked on {eligibility.failing.map((f) => `${f.label} (${f.value ?? "not assigned"})`).join(", ")}. A classifier that has never been assigned withholds access rather than defaulting to a pass.</>}
          </p>
        </Card>
      )}

      <div>
        <h2 className="text-sm font-semibold text-text mb-3">Assignment history</h2>
        {history?.length
          ? <Card className="p-1"><DataTable newest={(r) => r.validFrom} columns={columns} rows={history} columnPicker /></Card>
          : <EmptyState title="No assignments on file" body="This client predates the classifier register, or has never been rated." />}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Reassign ${editingType?.label ?? ""}`}>
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-text-soft">
            This closes the current window and opens a new one from today. Nothing is overwritten — the outgoing value
            stays readable for the period it applied to.
          </p>
          <Field label="New value">
            <Select value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">Select…</option>
              {editingType?.values.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </Select>
          </Field>
          {editingType?.values.find((v) => v.value === value)?.note && (
            <p className="text-xs text-warning">{editingType.values.find((v) => v.value === value)!.note}</p>
          )}
          <Field label="Reason" hint="Recorded on the assignment — the half of the trail a bare value loses.">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why it is changing" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !value}>{busy ? "Assigning…" : "Assign"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
