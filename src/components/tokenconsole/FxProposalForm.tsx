import { useState } from "react";
import { Button, Field, GlassPanel, Input, NotePanel, SectionTitle, Textarea, Toggle } from "../../ui";
import { useAction } from "../../lib/tokenConsole/useAction";
import { OmniApiError, omniApi, type FxChange, type FxSettings } from "../../lib/omniApi";
import { changesSomething, formOf, formProblem, NOTE_MAX, proposalFrom, ratesOf, type FxForm } from "../../lib/tokenConsole/fx";

/** The service's field names, as the form's. */
const FIELD_OF: Record<string, keyof FxForm> = {
  midRate: "midRate", rateValidUntil: "validUntil", marginPct: "marginPct", marginFloorPct: "marginFloorPct",
  quoteTtlSeconds: "quoteTtlSeconds", minAmount: "minAmount", perConversion: "perConversion", perDay: "perDay",
};

const rate = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v);

/** The FX setting as it should be, prefilled from the one in force; only what
 *  differs is sent. The page remounts it (by key) when the setting in force
 *  changes, so it never edits a stale copy. */
export function FxProposalForm({ settings, blocked, onProposed }: {
  settings: FxSettings;
  /** Why a proposal cannot be made now (one is already waiting); null when it can. */
  blocked: string | null;
  onProposed: (change: FxChange) => void;
}) {
  const [form, setForm] = useState<FxForm>(() => formOf(settings));
  const [note, setNote] = useState("");
  const [served, setServed] = useState<{ field: keyof FxForm; message: string } | null>(null);
  const propose = useAction(async (p: ReturnType<typeof proposalFrom>) => {
    try {
      return await omniApi.proposeFxChange(p);
    } catch (e) {
      const field = e instanceof OmniApiError && e.field ? FIELD_OF[e.field] : undefined;
      if (field) setServed({ field, message: (e as Error).message });
      throw e;
    }
  });

  const set = <K extends keyof FxForm>(k: K, v: FxForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServed(null);
  };
  const proposal = proposalFrom(settings, form, note);
  const local = formProblem(settings, form);
  const problem = blocked ?? local?.message ?? (changesSomething(proposal) ? null : "Change at least one value to propose it.");
  const errorOn = (field: keyof FxForm) => (local?.field === field ? local.message : served?.field === field ? served.message : undefined);
  const panelError = propose.error && !served ? propose.error : null;

  const mid = Number(form.midRate);
  const margin = Number(form.marginPct);
  const preview = form.midRate.trim() !== "" && mid > 0 && Number.isFinite(margin) && margin >= 0 ? ratesOf(mid, margin) : null;

  const reset = () => {
    setForm(formOf(settings));
    setNote("");
    setServed(null);
    propose.reset();
  };

  const submit = async () => {
    if (problem || propose.pending) return;
    setServed(null);
    const change = await propose.run(proposal);
    if (change) onProposed(change);
  };

  return (
    <GlassPanel className="mb-6 p-5" sheen={false}>
      <SectionTitle
        title="Propose a new rate"
        description="Set it as it should be: usually the bank's mid rate this morning and how long it holds. Only what you change is sent. Someone else has to approve it before customers' quotes use it."
      />
      <form noValidate data-testid="fx-proposal" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={`Mid rate (${settings.quote} per ${settings.base})`} error={errorOn("midRate")}>
            <Input type="number" inputMode="decimal" step="0.0001" min="0" value={form.midRate} aria-label="Mid rate"
              invalid={!!errorOn("midRate")} onChange={(e) => set("midRate", e.target.value)} />
          </Field>
          <Field label="Valid until" hint="Your local time. Left as is, the rate in force keeps its date." error={errorOn("validUntil")}>
            <Input type="datetime-local" value={form.validUntil} aria-label="Valid until"
              invalid={!!errorOn("validUntil")} onChange={(e) => set("validUntil", e.target.value)} />
          </Field>
          <Field label="Margin (%)" hint="The whole spread, half either side of the mid" error={errorOn("marginPct")}>
            <Input type="number" inputMode="decimal" step="0.01" min="0" max="50" value={form.marginPct} aria-label="Margin"
              invalid={!!errorOn("marginPct")} onChange={(e) => set("marginPct", e.target.value)} />
          </Field>
          <Field label="Conversion" group>
            <div className="flex h-11 items-center gap-3">
              <Toggle checked={form.suspended} onChange={(v) => set("suspended", v)} label="Pause conversion" />
              <span className={form.suspended ? "text-sm font-medium text-danger" : "text-sm text-text"}>
                {form.suspended ? "Paused: no quotes are given" : "Open"}
              </span>
            </div>
          </Field>
        </div>

        {preview && (
          <div className="mt-4 grid gap-3 rounded-md bg-surface-sunken px-4 py-3 text-sm sm:grid-cols-2" data-testid="fx-preview">
            <div>
              <div className="text-xs text-text-faint">Customers buying {settings.base} pay</div>
              <div className="tabular font-semibold text-text">{settings.quote} {rate(preview.buy)} per {settings.base}</div>
            </div>
            <div>
              <div className="text-xs text-text-faint">Customers selling {settings.base} get</div>
              <div className="tabular font-semibold text-text">{settings.quote} {rate(preview.sell)} per {settings.base}</div>
            </div>
          </div>
        )}

        <details className="mt-4 rounded-md border border-border px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-text">Limits and quote hold</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Margin floor (%)" hint="The margin may not go under it" error={errorOn("marginFloorPct")}>
              <Input type="number" inputMode="decimal" step="0.01" min="0" max="50" value={form.marginFloorPct} aria-label="Margin floor"
                invalid={!!errorOn("marginFloorPct")} onChange={(e) => set("marginFloorPct", e.target.value)} />
            </Field>
            <Field label="Quote holds (s)" hint="1 to 900" error={errorOn("quoteTtlSeconds")}>
              <Input type="number" inputMode="numeric" step="1" min="1" max="900" value={form.quoteTtlSeconds} aria-label="Quote holds"
                invalid={!!errorOn("quoteTtlSeconds")} onChange={(e) => set("quoteTtlSeconds", e.target.value)} />
            </Field>
            <Field label={`Minimum (${settings.quote})`} error={errorOn("minAmount")}>
              <Input type="number" inputMode="decimal" step="0.01" min="0" value={form.minAmount} aria-label="Minimum"
                invalid={!!errorOn("minAmount")} onChange={(e) => set("minAmount", e.target.value)} />
            </Field>
            <Field label={`Per conversion (${settings.quote})`} hint="Blank keeps it as it is" error={errorOn("perConversion")}>
              <Input type="number" inputMode="decimal" step="0.01" min="0" value={form.perConversion} aria-label="Per conversion"
                invalid={!!errorOn("perConversion")} onChange={(e) => set("perConversion", e.target.value)} />
            </Field>
            <Field label={`Per day (${settings.quote})`} hint="Blank keeps it as it is" error={errorOn("perDay")}>
              <Input type="number" inputMode="decimal" step="0.01" min="0" value={form.perDay} aria-label="Per day"
                invalid={!!errorOn("perDay")} onChange={(e) => set("perDay", e.target.value)} />
            </Field>
          </div>
          <p className="mt-3 text-xs text-text-faint">Amounts are in {settings.quote} whichever way a customer converts.</p>
        </details>

        <div className="mt-4">
          <Field label="Note" hint={`Optional. Kept with the proposal in the log. ${note.length}/${NOTE_MAX}`}>
            <Textarea rows={2} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>

        {blocked && <NotePanel tone="warning" className="mt-4" title="Waiting for a decision">{blocked}</NotePanel>}
        {panelError && <NotePanel tone="danger" className="mt-4" title="Not proposed">{panelError}</NotePanel>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={!!problem || propose.pending} title={problem ?? undefined}>
            {propose.pending ? "Proposing…" : "Propose for approval"}
          </Button>
          <Button type="button" variant="outline" disabled={propose.pending} onClick={reset}>Start again</Button>
          {problem && !blocked && <span className="text-[12.5px] text-text-soft">{problem}</span>}
        </div>
      </form>
    </GlassPanel>
  );
}
