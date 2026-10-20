import { useMemo, useState } from "react";
import { Button, Checkbox, Field, GlassPanel, Input, NotePanel, SectionTitle, Skeleton, Textarea, Toggle } from "../../ui";
import { omniApi, type MarketChange, type MarketSettings } from "../../lib/omniApi";
import { useAction } from "../../lib/tokenConsole/useAction";
import { changesSomething, hhmm, hoursProblem, proposalFrom, valuesOf } from "../../lib/tokenConsole/market";
import type { OfferingOption } from "../../lib/tokenConsole/offeringNames";

const NOTE_MAX = 300;

/** The setting as it should be, prefilled from the current one. Only what
 *  differs is sent, so a field left alone keeps its value. The page remounts
 *  this (by key) whenever the current setting changes, so it never edits a
 *  stale copy. */
export function MarketProposalForm({ settings, offerings, offeringsLoading, offeringsError, blocked, onProposed }: {
  settings: MarketSettings;
  offerings: OfferingOption[];
  offeringsLoading: boolean;
  offeringsError: string | null;
  /** Why a proposal cannot be made now (one is already waiting); null when it can. */
  blocked: string | null;
  onProposed: (change: MarketChange) => void;
}) {
  const current = useMemo(() => valuesOf(settings), [settings]);
  const [open, setOpen] = useState(hhmm(current.tradingOpen));
  const [close, setClose] = useState(hhmm(current.tradingClose));
  const [weekendsOpen, setWeekendsOpen] = useState(current.weekendsOpen);
  const [halted, setHalted] = useState(current.halted);
  const [haltedOfferings, setHaltedOfferings] = useState<string[]>(current.haltedOfferings);
  const [note, setNote] = useState("");
  const propose = useAction(omniApi.proposeMarketChange);

  const proposal = proposalFrom(current, { tradingOpen: open, tradingClose: close, weekendsOpen, halted, haltedOfferings }, note);
  const hours = hoursProblem(open, close);
  const problem = blocked ?? hours?.message ?? (changesSomething(proposal) ? null : "Change at least one value to propose it.");

  // Bonds halted now that the offerings list does not hold (removed, or the
  // list failed) stay listed, so their halt can still be lifted.
  const choices = useMemo(() => {
    const known = new Set(offerings.map((o) => o.id));
    const unknown = current.haltedOfferings.filter((id) => !known.has(id)).map((id) => ({ id, name: id, meta: "Not in the offerings list" }));
    return [...offerings, ...unknown];
  }, [offerings, current.haltedOfferings]);

  const toggleOffering = (id: string, on: boolean) =>
    setHaltedOfferings((ids) => (on ? [...new Set([...ids, id])] : ids.filter((x) => x !== id)));

  const reset = () => {
    setOpen(hhmm(current.tradingOpen));
    setClose(hhmm(current.tradingClose));
    setWeekendsOpen(current.weekendsOpen);
    setHalted(current.halted);
    setHaltedOfferings(current.haltedOfferings);
    setNote("");
    propose.reset();
  };

  const submit = async () => {
    if (problem || propose.pending) return;
    const change = await propose.run(proposal);
    if (change) onProposed(change);
  };

  return (
    <GlassPanel className="p-5 mb-6" sheen={false}>
      <SectionTitle
        title="Propose a change"
        description="Set it as it should be. Only what you change is sent; the rest keeps whatever is in force when the change is approved. Someone else has to approve it before the quotes and the order check follow it."
      />
      <form
        noValidate
        data-testid="market-proposal"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Dealing opens" hint={`24-hour, ${settings.zone}`} error={hours?.field === "tradingOpen" ? hours.message : undefined}>
            <Input type="time" value={open} onChange={(e) => setOpen(e.target.value)} aria-label="Dealing opens" invalid={hours?.field === "tradingOpen"} required />
          </Field>
          <Field label="Dealing closes" hint={`24-hour, ${settings.zone}`} error={hours?.field === "tradingClose" ? hours.message : undefined}>
            <Input type="time" value={close} onChange={(e) => setClose(e.target.value)} aria-label="Dealing closes" invalid={hours?.field === "tradingClose"} required />
          </Field>
          <Field label="Weekends" group>
            <div className="flex h-11 items-center gap-3">
              <Toggle checked={weekendsOpen} onChange={setWeekendsOpen} label="Open at weekends" />
              <span className="text-sm text-text">{weekendsOpen ? "Open at weekends" : "Closed at weekends"}</span>
            </div>
          </Field>
          <Field label="Whole market" group>
            <div className="flex h-11 items-center gap-3">
              <Toggle checked={halted} onChange={setHalted} label="Halt the whole market" />
              <span className={halted ? "text-sm font-medium text-danger" : "text-sm text-text"}>{halted ? "Halted: no bond deals" : "Not halted"}</span>
            </div>
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Bonds halted on their own" group hint="Each ticked bond shows HALTED and refuses orders, whatever the market does.">
            {offeringsLoading && choices.length === 0 ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                {offeringsError && (
                  <p className="text-xs text-danger">Couldn't load the offerings: {offeringsError}. The bonds halted now are still listed.</p>
                )}
                {choices.length === 0 ? (
                  <p className="text-sm text-text-soft">No offerings to choose from.</p>
                ) : (
                  <div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border border-border bg-surface-sunken p-3 sm:grid-cols-2" data-testid="halted-offerings">
                    {choices.map((o) => (
                      <Checkbox key={o.id} checked={haltedOfferings.includes(o.id)} onChange={(on) => toggleOffering(o.id, on)}>
                        <span className="text-text">{o.name}</span>
                        <span className="block text-xs text-text-faint">{o.meta}</span>
                      </Checkbox>
                    ))}
                  </div>
                )}
              </>
            )}
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Note" hint={`Optional. Why, for the approver and the log. ${note.length}/${NOTE_MAX}`}>
            <Textarea rows={2} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Halt while the coupon is being repriced" />
          </Field>
        </div>

        {propose.error && <NotePanel tone="danger" className="mt-4">{propose.error}</NotePanel>}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          {problem && <p className="mr-auto text-[12.5px] text-text-soft" role="status">{problem}</p>}
          <Button type="button" variant="ghost" size="sm" disabled={propose.pending} onClick={reset}>Reset</Button>
          <Button type="submit" size="sm" disabled={!!problem || propose.pending}>
            {propose.pending ? "Proposing…" : "Propose change"}
          </Button>
        </div>
      </form>
    </GlassPanel>
  );
}
