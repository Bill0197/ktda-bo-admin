/* Pick-or-create for reference fields, recursively (ported from tokenization-web).
   =====================================================================
   EntityRefField is a searchable picker plus a "New" button. Outside a
   create flow, "New" opens one (EntityCreateFlow). Inside a flow, it pushes
   a step onto that same dialog instead, so creating a service package that
   needs a new institution reads as one trail:
       New product › New service package › New institution
   Finishing a step pops back to its parent with the new id selected. Parent
   forms stay mounted while hidden, so nothing half-typed is lost.

   The flow is portalled to <body>: BO Admin's Modal is not, and a dialog
   rendered inside another one would be positioned against the parent's
   transform and sit inside its <label>s.

   What each entity looks like is data, not code: see entityRegistry.ts.
   ===================================================================== */

import { ChevronRight, Plus, Trash2, X } from "lucide-react";
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { Button, Checkbox, Field, Input, Modal, NotePanel, Select, useToast } from "../../ui";
import {
  blankState, buildBody, createdId, getSpec, isCreatable, validate,
} from "../../lib/tokenConsole/entityRegistry";
import type { CreatableSpec, EntitySpec, FieldSpec, FormState, FormValue } from "../../lib/tokenConsole/entityRegistry";
import { label as humanize } from "../../lib/tokenConsole/format";
import { EntityPicker, type PickerOption } from "./EntityPicker";

interface Flow {
  push: (entityKey: string, onCreated: (id: string) => void) => void;
}
const FlowContext = createContext<Flow | null>(null);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const NONE: string[] = [];

/* Names of rows created in this session, by entity and id. A new row is
   selected the moment it's created, but its list can refetch after that;
   without this the picker would show a bare id meanwhile. */
const createdNames = new Map<string, string>();
const nameKey = (entityKey: string, id: string) => `${entityKey}:${id}`;

function toOptions(spec: EntitySpec, rows: Record<string, unknown>[] | undefined, value: string, exclude: string[]) {
  const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : undefined);
  const options: PickerOption[] = [];
  for (const row of rows ?? []) {
    const id = str(row[spec.idField]);
    if (!id || exclude.includes(id)) continue;
    const meta = spec.metaField ? str(row[spec.metaField]) : undefined;
    options.push({ id, label: str(row[spec.labelField]) ?? id, meta: meta !== undefined && meta !== id ? meta : id });
  }
  // A value not in the list yet — just created, before the refetch lands —
  // still has to show as selected rather than as an empty picker.
  if (value && !options.some((o) => o.id === value)) {
    options.unshift({ id: value, label: createdNames.get(nameKey(spec.key, value)) ?? value });
  }
  return options;
}

/* ------------------------------------------------------------------ fields */

export function EntityRefField({
  id, entityKey, value, onChange, placeholder, exclude = NONE, disabled, originLabel,
}: {
  id?: string;
  entityKey: string;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Ids to leave out of the list — already chosen elsewhere. */
  exclude?: string[];
  disabled?: boolean;
  /** The form this field sits in, shown as the first breadcrumb. */
  originLabel?: string;
}) {
  const spec = getSpec(entityKey);
  const list = spec.useList();
  const flow = useContext(FlowContext);
  const [creating, setCreating] = useState(false);
  const options = useMemo(() => toOptions(spec, list.data, value, exclude), [spec, list.data, value, exclude]);

  return (
    <div className="flex items-stretch gap-2">
      <div className="min-w-0 flex-1">
        <EntityPicker
          id={id}
          options={options}
          value={value || null}
          onChange={(v) => onChange(v ?? "")}
          loading={list.isPending}
          disabled={disabled}
          placeholder={placeholder}
          emptyLabel={list.error ? `Couldn't load ${spec.label}s: ${list.error}` : `No ${spec.label}s yet.`}
        />
      </div>
      {isCreatable(spec) && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled}
          className="h-11"
          aria-label={`New ${spec.label}`}
          title={`New ${spec.label}`}
          onClick={() => (flow ? flow.push(entityKey, onChange) : setCreating(true))}
        >
          <Plus size={14} /> New
        </Button>
      )}
      {creating &&
        createPortal(
          <EntityCreateFlow entityKey={entityKey} onCreated={onChange} onClose={() => setCreating(false)} originLabel={originLabel} />,
          document.body,
        )}
    </div>
  );
}

export function MultiEntityRefField({
  id, entityKey, value, onChange, originLabel,
}: {
  id?: string;
  entityKey: string;
  value: string[];
  onChange: (ids: string[]) => void;
  originLabel?: string;
}) {
  const spec = getSpec(entityKey);
  const list = spec.useList();
  const nameOf = (v: string) => {
    const row = list.data?.find((r) => r[spec.idField] === v);
    const name = row?.[spec.labelField];
    return typeof name === "string" && name ? name : v;
  };
  const add = (v: string) => {
    if (v && !value.includes(v)) onChange([...value, v]);
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Selected ${spec.label}s`}>
          {value.map((v) => (
            <li key={v} className="flex items-center gap-1 rounded-full border border-border bg-surface-sunken py-1 pr-1 pl-3 text-[12.5px] text-text">
              {nameOf(v)}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                aria-label={`Remove ${nameOf(v)}`}
                className="grid size-5 place-items-center rounded-full text-text-faint hover:bg-surface hover:text-text"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* Always empty: picking adds a chip rather than holding a value. */}
      <EntityRefField id={id} entityKey={entityKey} value="" onChange={add} exclude={value} placeholder={`Add a ${spec.label}…`} originLabel={originLabel} />
    </div>
  );
}

/* -------------------------------------------------------------------- flow */

interface Frame {
  key: number;
  entityKey: string;
  onCreated: (id: string) => void;
}

export function EntityCreateFlow({
  entityKey, onCreated, onClose, originLabel,
}: {
  entityKey: string;
  onCreated: (id: string) => void;
  onClose: () => void;
  /** The form this flow was opened from, shown as the first crumb. */
  originLabel?: string;
}) {
  const seq = useRef(0);
  // Captured once, but the caller may re-render with a new function while open.
  const rootOnCreated = useRef(onCreated);
  useEffect(() => {
    rootOnCreated.current = onCreated;
  });
  const [frames, setFrames] = useState<Frame[]>(() => [
    { key: 0, entityKey, onCreated: (id) => rootOnCreated.current(id) },
  ]);

  const push = useCallback((key: string, cb: (id: string) => void) => {
    seq.current += 1;
    const frame = { key: seq.current, entityKey: key, onCreated: cb };
    setFrames((f) => [...f, frame]);
  }, []);
  const flow = useMemo(() => ({ push }), [push]);

  const depth = frames.length - 1;
  const popTo = (index: number) => setFrames((f) => f.slice(0, index + 1));
  // Closing the dialog steps back one level; only the root step closes it.
  const back = () => (depth > 0 ? popTo(depth - 1) : onClose());
  const backRef = useRef(back);
  backRef.current = back;
  const finish = (index: number, id: string) => {
    frames[index].onCreated(id);
    if (index === 0) onClose();
    else popTo(index - 1);
  };

  // Escape steps back one level and goes no further: every open Modal listens
  // on document, so without this one key would close the form this flow was
  // opened from too, with whatever was typed in it. An open picker list gets
  // the key first (it stops it in the same capture phase).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (document.querySelector('[aria-haspopup="listbox"][aria-expanded="true"]')) return;
      backRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  const topSpec = getSpec(frames[depth].entityKey);
  const wide = topSpec.fields.length > 6 || topSpec.fields.some((f) => f.kind === "array");

  return (
    <Modal open onClose={back} title={`New ${topSpec.label}`} size={wide ? "lg" : "md"}>
      <nav aria-label="Breadcrumb" className="-mt-1 mb-4">
        <ol className="flex flex-wrap items-center gap-1 text-[12.5px]">
          {originLabel && (
            <li className="flex items-center gap-1">
              <button type="button" onClick={onClose} className="text-text-soft underline-offset-2 hover:text-text hover:underline">
                {originLabel}
              </button>
              <ChevronRight size={13} className="text-text-faint" aria-hidden />
            </li>
          )}
          {frames.map((f, i) => {
            const text = `New ${getSpec(f.entityKey).label}`;
            return (
              <Fragment key={f.key}>
                {i > 0 && <ChevronRight size={13} className="text-text-faint" aria-hidden />}
                <li>
                  {i === depth ? (
                    <span aria-current="step" className="font-medium text-text">{text}</span>
                  ) : (
                    <button type="button" onClick={() => popTo(i)} className="text-text-soft underline-offset-2 hover:text-text hover:underline">
                      {text}
                    </button>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      </nav>
      <FlowContext.Provider value={flow}>
        {frames.map((f, i) => {
          const spec = getSpec(f.entityKey);
          return (
            <div key={f.key} hidden={i !== depth}>
              {isCreatable(spec) ? (
                <EntityCreateForm spec={spec} backLabel={i > 0 ? "Back" : "Cancel"} onBack={back} onCreated={(id) => finish(i, id)} />
              ) : (
                <p className="text-[13px] text-text-soft">{cap(spec.label)}s can only be picked, not created here.</p>
              )}
            </div>
          );
        })}
      </FlowContext.Provider>
    </Modal>
  );
}

/* -------------------------------------------------------------------- form */

function EntityCreateForm({
  spec, backLabel, onBack, onCreated,
}: {
  spec: CreatableSpec;
  backLabel: string;
  onBack: () => void;
  onCreated: (id: string) => void;
}) {
  const mutation = spec.useCreate();
  const toast = useToast();
  const [state, setState] = useState<FormState>(() => blankState(spec.fields));
  const [dirty, setDirty] = useState(false);
  const problem = validate(spec.fields, state);

  const setField = (key: string, v: FormValue) => {
    setDirty(true);
    setState((s) => ({ ...s, [key]: v }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Portalled, but React still bubbles the event up the component tree —
    // into whatever form opened this flow.
    e.stopPropagation();
    if (problem || mutation.pending) return;
    const body = buildBody(spec.fields, state);
    const data = await mutation.run(body);
    if (!data) return; // the error is on the form
    const name = body[spec.labelField];
    if (spec.staged) {
      // Only a change request exists yet: there is nothing to pick until it
      // is approved, so go back to the form that opened this, values kept.
      toast.push(`New ${spec.label}${typeof name === "string" ? ` "${name}"` : ""} sent for approval. You can pick it once someone else approves it.`);
      onBack();
      return;
    }
    const id = createdId(spec, data, body);
    toast.push(`Created ${spec.label}${typeof name === "string" ? ` "${name}"` : ""}.`);
    if (id && typeof name === "string") createdNames.set(nameKey(spec.key, id), name);
    if (id) {
      onCreated(id);
    } else {
      // Created, but the response didn't say which id — the list has
      // refreshed, so the operator can still pick it by hand.
      toast.push(`Pick the new ${spec.label} from the list.`, "info");
      onBack();
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <FieldGrid fields={spec.fields} state={state} onField={setField} />
      {mutation.error && <NotePanel tone="danger" className="mt-4">{mutation.error}</NotePanel>}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        {dirty && problem ? <p className="mr-auto text-[12.5px] text-text-soft">{problem}</p> : null}
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>{backLabel}</Button>
        <Button type="submit" size="sm" disabled={!!problem || mutation.pending}>
          {spec.staged
            ? (mutation.pending ? "Sending…" : "Send for approval")
            : (mutation.pending ? "Creating…" : `Create ${spec.label}`)}
        </Button>
      </div>
    </form>
  );
}

function FieldGrid({
  fields, state, onField,
}: {
  fields: FieldSpec[];
  state: FormState;
  onField: (key: string, v: FormValue) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const span = f.wide || f.kind === "array" ? "sm:col-span-2" : undefined;
        if (f.kind === "array") {
          const rows = Array.isArray(state[f.key]) ? (state[f.key] as FormState[]) : [];
          return (
            <div key={f.key} className={span}>
              <ArrayField field={f} rows={rows} onChange={(r) => onField(f.key, r)} />
            </div>
          );
        }
        if (f.kind === "bool") {
          return (
            <div key={f.key} className={`flex items-end pb-2.5 ${span ?? ""}`}>
              <Checkbox checked={state[f.key] === true} onChange={(v) => onField(f.key, v)}>{f.label}</Checkbox>
            </div>
          );
        }
        const value = typeof state[f.key] === "string" ? (state[f.key] as string) : "";
        return (
          <div key={f.key} className={span}>
            <Field label={f.label} required={f.required} hint={f.hint} group={f.kind === "ref"}>
              <ScalarInput field={f} value={value} onChange={(v) => onField(f.key, v)} />
            </Field>
          </div>
        );
      })}
    </div>
  );
}

function ScalarInput({ field: f, value, onChange }: { field: FieldSpec; value: string; onChange: (v: string) => void }) {
  switch (f.kind) {
    case "ref":
      return <EntityRefField entityKey={f.refEntity ?? ""} value={value} onChange={onChange} placeholder={f.placeholder} />;
    case "enum":
      return (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          {!f.required && <option value="">(none)</option>}
          {f.options?.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}
        </Select>
      );
    default:
      return (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder}
          type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"}
          step={f.kind === "number" ? "any" : undefined}
          min={f.kind === "number" ? f.min : undefined}
          inputMode={f.kind === "number" ? "decimal" : undefined}
          maxLength={f.kind === "currency" ? 3 : undefined}
          className={f.kind === "currency" || f.uppercase ? "uppercase placeholder:normal-case" : undefined}
        />
      );
  }
}

let rowSeq = 0;
const ROW_KEY = "__row";

function ArrayField({
  field, rows, onChange,
}: {
  field: FieldSpec;
  rows: FormState[];
  onChange: (rows: FormState[]) => void;
}) {
  const itemFields = field.itemFields ?? [];
  const noun = field.itemLabel ?? "row";
  const add = () => {
    rowSeq += 1;
    // The row key rides along in the state but is never sent: buildBody only
    // reads the declared item fields.
    onChange([...rows, { ...blankState(itemFields), [ROW_KEY]: String(rowSeq) }]);
  };
  const update = (i: number, key: string, v: FormValue) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));

  return (
    <fieldset>
      <legend className="text-[13px] font-medium text-text-soft">{field.label}</legend>
      {field.hint && <p className="mt-1 text-xs text-text-faint">{field.hint}</p>}
      <div className="mt-3 flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={String(row[ROW_KEY])} className="rounded-md border border-border p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-text">{cap(noun)} {i + 1}</span>
              <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${noun} ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                <Trash2 size={14} /> Remove
              </Button>
            </div>
            <FieldGrid fields={itemFields} state={row} onField={(key, v) => update(i, key, v)} />
          </div>
        ))}
        {rows.length === 0 && <p className="text-[12.5px] text-text-faint">No {noun}s added.</p>}
        <div>
          <Button type="button" size="sm" variant="secondary" onClick={add}><Plus size={14} /> Add {noun}</Button>
        </div>
      </div>
    </fieldset>
  );
}
