import { useState } from "react";
import { Button, DataTable, Field, Input, Modal, NotePanel, SectionTitle, Select, Skeleton, useToast } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { useAction } from "../../lib/tokenConsole/useAction";
import { invalidateList } from "../../lib/tokenConsole/sharedList";
import { PENDING_CHANGES_KEY, usePendingChanges } from "../../lib/tokenConsole/usePendingChanges";
import { pendingFor } from "../../lib/tokenConsole/configChanges";
import type { CreateProductLimitRequest } from "../../lib/tokenConsole/types.gen";
import { Code, SourceError } from "../../components/tokenconsole/ConsoleTable";
import { ProductBindings } from "./ProductBindings";

const LIMIT_TYPES = ["MIN_INITIAL_SUBSCRIPTION", "MIN_TOP_UP", "MAX_PER_INVESTOR"] as const;
const TRIGGER_POINTS = ["ON_OPEN", "ON_CLOSE", "ON_SUBSCRIPTION", "ON_REDEMPTION", "ON_ACCRUAL", "ON_DISTRIBUTION", "ON_MATURITY"] as const;

/** Blank is "not set"; anything else must be a real number. */
function parseAmount(s: string): number | undefined | "invalid" {
  if (s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : "invalid";
}

function limitProblem(min: number | undefined | "invalid", max: number | undefined | "invalid") {
  if (min === "invalid" || max === "invalid") return "Enter numbers only.";
  if (min === undefined && max === undefined) return "Enter a min, a max, or both.";
  if ((min ?? 0) < 0 || (max ?? 0) < 0) return "Limits cannot be negative.";
  if (min !== undefined && max !== undefined && min > max) return "Min is above max.";
  return undefined;
}

/** Per-product limits and lifecycle events. Rendered only while open, and
 * keyed by product by its parent, so nothing typed for one product is ever
 * submitted against another. */
export function ProductConfigModal({ productId, canWrite, onClose, onChanged }: {
  productId: string;
  canWrite: boolean;
  onClose: () => void;
  /** A status or binding changed — the product list is stale. */
  onChanged: () => void;
}) {
  const toast = useToast();
  const limits = useAsyncData(() => tokenConsole.productLimits(productId));
  const events = useAsyncData(() => tokenConsole.lifecycleEvents(productId));
  // Limits are maker-checker controlled: staged here, applied on approval.
  const saveLimit = useAction((body: CreateProductLimitRequest) => tokenConsole.stageChange("PRODUCT_LIMIT_CREATE", body));
  const pendingChanges = usePendingChanges();
  const waitingLimits = pendingFor(pendingChanges.data, productId, ["PRODUCT_LIMIT_CREATE"]);
  const saveEvent = useAction(tokenConsole.createLifecycleEvent);

  const [limitType, setLimitType] = useState<string>(LIMIT_TYPES[0]);
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [currency, setCurrency] = useState("KES");

  const [eventId, setEventId] = useState("");
  const [triggerPoint, setTriggerPoint] = useState<string>("ON_ACCRUAL");
  const [actionRef, setActionRef] = useState("");
  const [description, setDescription] = useState("");

  const min = parseAmount(minValue);
  const max = parseAmount(maxValue);
  const problem = limitProblem(min, max);
  const touched = minValue.trim() !== "" || maxValue.trim() !== "";

  const addLimit = async () => {
    if (problem || min === "invalid" || max === "invalid") return;
    const saved = await saveLimit.run({
      productId, limitType, minValue: min, maxValue: max, currency: currency.trim().toUpperCase() || undefined,
    });
    if (saved === undefined) return;
    toast.push(`${limitType} for ${productId} sent for approval.`);
    setMinValue("");
    setMaxValue("");
    invalidateList(PENDING_CHANGES_KEY);
  };

  const addEvent = async () => {
    const saved = await saveEvent.run({
      eventId: eventId.trim(), productId, triggerPoint, actionRef: actionRef.trim(), description: description.trim() || undefined,
    });
    if (saved === undefined) return;
    toast.push(`Added ${eventId.trim()} to ${productId}`);
    setEventId("");
    setActionRef("");
    setDescription("");
    void events.reload();
  };

  return (
    <Modal open onClose={onClose} title={`Configure ${productId}`} size="lg">
      <SectionTitle title="Status & bindings" description="Whether it sells, and what it is recorded, priced and accrued against." />
      <ProductBindings productId={productId} canWrite={canWrite} onChanged={onChanged} />
      <SectionTitle title="Limits" description="Bounds a subscription, top-up or holding must respect." />
      {canWrite && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Limit type">
              <Select value={limitType} onChange={(e) => setLimitType(e.target.value)}>
                {LIMIT_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Min"><Input type="number" inputMode="decimal" value={minValue} onChange={(e) => setMinValue(e.target.value)} /></Field>
            <Field label="Max"><Input type="number" inputMode="decimal" value={maxValue} onChange={(e) => setMaxValue(e.target.value)} /></Field>
            <Field label="Currency"><Input value={currency} onChange={(e) => setCurrency(e.target.value)} /></Field>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
            {touched && problem && <span className="text-xs text-danger">{problem}</span>}
            <Button size="sm" disabled={!!problem || saveLimit.pending} onClick={() => void addLimit()}>
              {saveLimit.pending ? "Sending…" : "Send for approval"}
            </Button>
          </div>
          {saveLimit.error && <NotePanel tone="danger" className="mt-2">{saveLimit.error}</NotePanel>}
          {waitingLimits.length > 0 && (
            <NotePanel tone="info" className="mt-2" title="Awaiting approval">
              {waitingLimits.map((c) => c.summary ?? "Limit change").join(" · ")}
            </NotePanel>
          )}
        </>
      )}
      <div className="mt-3 mb-6">
        {limits.error ? <SourceError what="limits" error={limits.error} onRetry={limits.reload} className="" />
          : limits.loading && !limits.data ? <Skeleton className="h-24" />
          : (
            <DataTable
              rows={(limits.data ?? []).map((r, i) => ({ ...r, id: r.limitId ?? `limit-${i}` }))}
              emptyLabel="No limits on this product yet"
              columns={[
                { key: "type", header: "Type", render: (r) => <Code>{r.limitType}</Code> },
                { key: "min", header: "Min", className: "tabular text-right", render: (r) => r.minValue ?? "—" },
                { key: "max", header: "Max", className: "tabular text-right", render: (r) => r.maxValue ?? "—" },
                { key: "ccy", header: "Ccy", render: (r) => r.currency ?? "—" },
              ]}
            />
          )}
      </div>

      <SectionTitle title="Lifecycle events" description="Which named automation fires at which milestone." />
      {canWrite && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Event ID"><Input value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="EVT-…" /></Field>
            <Field label="Trigger">
              <Select value={triggerPoint} onChange={(e) => setTriggerPoint(e.target.value)}>
                {TRIGGER_POINTS.map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Action ref"><Input value={actionRef} onChange={(e) => setActionRef(e.target.value)} placeholder="run_daily_accrual" /></Field>
            <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          </div>
          <div className="mt-2 flex justify-end">
            <Button size="sm" disabled={!eventId.trim() || !actionRef.trim() || saveEvent.pending} onClick={() => void addEvent()}>
              {saveEvent.pending ? "Adding…" : "Add event"}
            </Button>
          </div>
          {saveEvent.error && <NotePanel tone="danger" className="mt-2">{saveEvent.error}</NotePanel>}
        </>
      )}
      <div className="mt-3">
        {events.error ? <SourceError what="lifecycle events" error={events.error} onRetry={events.reload} className="" />
          : events.loading && !events.data ? <Skeleton className="h-24" />
          : (
            <DataTable
              rows={(events.data ?? []).map((r, i) => ({ ...r, id: r.eventId ?? `event-${i}` }))}
              emptyLabel="No lifecycle events on this product yet"
              columns={[
                { key: "event", header: "Event", render: (r) => <Code>{r.eventId}</Code> },
                { key: "trigger", header: "Trigger", render: (r) => <Code>{r.triggerPoint}</Code> },
                { key: "action", header: "Action", render: (r) => <Code>{r.actionRef}</Code> },
                { key: "description", header: "Description", render: (r) => r.description ?? "—", hideOnMobile: true },
              ]}
            />
          )}
      </div>
    </Modal>
  );
}
