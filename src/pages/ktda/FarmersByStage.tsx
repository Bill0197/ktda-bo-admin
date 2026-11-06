import { useEffect, useState, type ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Badge, Button, Field, FilterBar, Input, Modal, NotePanel, PageHeader, SearchInput, Skeleton, Tabs } from "../../ui";
import { useAsyncData } from "../../lib/useAsyncData";
import { useAction } from "../../lib/tokenConsole/useAction";
import { calendarDate, units } from "../../lib/tokenConsole/format";
import { farmersApi } from "../../lib/api.farmers";
import {
  FARMER_STATES, NOT_AVAILABLE, STATE_LABEL, STATE_MEANS,
  type Farmer, type FarmerState, type RegisterFarmer, type RegisteredFarmer,
} from "../../lib/journeyContract";
import { SourceError } from "../../components/tokenconsole/ConsoleTable";

/* This institution's farmers and where each is in the journey (registered,
   activated, funded), from omnichannel, which answers only for this back
   office's institution. Search by grower number, name or phone; filter by
   stage. "Register farmer" creates one record (no wallet, no PIN) through the
   single-farmer endpoint, never the bulk one. Both endpoints are proposals
   (journeyContract.ts); where they are missing the page says so. */

const SIZE = 20;
const STATE_TONE: Record<FarmerState, "neutral" | "info" | "success"> = { REGISTERED: "neutral", ACTIVATED: "info", FUNDED: "success" };
const isState = (v: string | null): v is FarmerState => !!v && (FARMER_STATES as string[]).includes(v);

const NotAvailable = () => (
  <div data-testid="not-available">
    <NotePanel tone="info" title="Not available on this environment yet">{NOT_AVAILABLE.replace(/^Not available on this environment yet: /, "")}</NotePanel>
  </div>
);

export default function FarmersByStage() {
  const [params, setParams] = useSearchParams();
  const state = isState(params.get("state")) ? (params.get("state") as FarmerState) : null;
  const q = params.get("q") ?? "";
  const [typed, setTyped] = useState(q);
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [registering, setRegistering] = useState(false);

  const set = (next: { state?: FarmerState | null; q?: string; page?: number }) => {
    const p = new URLSearchParams(params);
    const put = (k: string, v: string | null | undefined) => (v ? p.set(k, v) : p.delete(k));
    if ("state" in next) put("state", next.state ?? null);
    if ("q" in next) put("q", next.q?.trim() || null);
    put("page", next.page && next.page > 1 ? String(next.page) : null);
    setParams(p, { replace: true });
  };

  // Search as the operator stops typing.
  useEffect(() => {
    if (typed.trim() === q.trim()) return;
    const t = setTimeout(() => set({ q: typed }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed]);

  const list = useAsyncData(() => farmersApi.list({ state, q, page, size: SIZE }));
  const { reload } = list;
  useEffect(() => { void reload(); }, [state, q, page, reload]);

  const result = list.data;
  const data = result?.available ? result.page : null;
  const pages = data ? Math.max(1, Math.ceil(data.total / (data.size || SIZE))) : 1;
  const counts = data?.counts;
  const all = counts ? FARMER_STATES.reduce((n, s) => n + (counts[s] ?? 0), 0) : undefined;

  return (
    <div>
      <PageHeader
        eyebrow="KTDA"
        title="Farmers by stage"
        subtitle="This institution's farmers and where each is: registered (still has to onboard), activated (wallet open) or funded."
        actions={
          <div className="flex items-center gap-3">
            <Link to="/journey" className="text-sm font-medium text-primary-600 hover:text-primary-700">Farmer journey →</Link>
            <Button onClick={() => setRegistering(true)}><UserPlus size={14} /> Register farmer</Button>
          </div>
        }
      />

      {list.error ? (
        <SourceError what="the farmers" error={list.error} onRetry={list.reload} />
      ) : result && !result.available ? (
        <NotAvailable />
      ) : (
        <>
          <Tabs
            className="mb-4"
            active={state ?? "ALL"}
            onChange={(k) => set({ state: isState(k) ? k : null })}
            tabs={[{ key: "ALL", label: "All", count: all }, ...FARMER_STATES.map((s) => ({ key: s, label: STATE_LABEL[s], count: counts?.[s] }))]}
          />
          <FilterBar>
            <SearchInput value={typed} onChange={setTyped} placeholder="Grower number, name or phone" className="w-72" />
            {state && <span className="text-[12.5px] text-text-soft">{STATE_MEANS[state]}.</span>}
          </FilterBar>

          {!data ? <Skeleton className="h-48" /> : data.items.length === 0 ? (
            <p className="rounded-[var(--radius-lg)] border border-border p-6 text-center text-sm text-text-soft" data-testid="farmers-empty">
              {q || state ? "No farmer matches." : "No farmers registered yet. Run step 1 of the farmer journey, or register one."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border">
              <table className="w-full text-[13px]" data-testid="farmers-table">
                <thead className="bg-surface-sunken text-left text-[12px] text-text-soft">
                  <tr>
                    <th className="px-3 py-2 font-medium">Grower no.</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Factory</th>
                    <th className="px-3 py-2 font-medium">Stage</th>
                    <th className="px-3 py-2 font-medium">Since</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((f) => (
                    <tr key={f.growerNo} className="border-t border-border/60" data-grower={f.growerNo}>
                      <td className="px-3 py-2 font-mono text-[12.5px]">{f.growerNo}</td>
                      <td className="px-3 py-2">{f.fullName ?? "—"}</td>
                      <td className="px-3 py-2 tabular">{f.phone ?? "—"}</td>
                      <td className="px-3 py-2">{f.factory ?? "—"}</td>
                      <td className="px-3 py-2"><Badge tone={STATE_TONE[f.state]}>{STATE_LABEL[f.state]}</Badge></td>
                      <td className="px-3 py-2 tabular text-text-soft">{since(f)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && pages > 1 && (
            <div className="mt-3 flex items-center justify-between text-[12.5px] text-text-soft">
              <span>{units(data.total)} farmers · page {page} of {pages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => set({ page: page - 1 })}>Previous</Button>
                <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => set({ page: page + 1 })}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      <RegisterFarmerModal open={registering} onClose={() => setRegistering(false)} onDone={() => void list.reload()} />
    </div>
  );
}

/** When the farmer reached the stage they are at. */
function since(f: Farmer): string {
  const at = f.state === "FUNDED" ? f.lastFundedAt : f.state === "ACTIVATED" ? f.activatedAt : f.registeredAt;
  return at ? calendarDate(at) : "—";
}

const EMPTY: RegisterFarmer = { growerNo: "", nationalId: "", fullName: "", phone: "", factory: "" };
/** A Kenyan mobile in international form: 254 then 9 digits. */
const PHONE = /^\+?254\d{9}$/;

function RegisterFarmerModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState<RegisterFarmer>(EMPTY);
  const [done, setDone] = useState<RegisteredFarmer | null>(null);
  const register = useAction((body: RegisterFarmer) => farmersApi.register(body));

  const close = () => { setForm(EMPTY); setDone(null); register.reset(); onClose(); };
  const field = (k: keyof RegisterFarmer) => ({
    value: form[k],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });
  const trimmed: RegisterFarmer = {
    growerNo: form.growerNo.trim(), nationalId: form.nationalId.trim(), fullName: form.fullName.trim(),
    phone: form.phone.trim().replace(/^\+/, ""), factory: form.factory.trim(),
  };
  const problem = !trimmed.growerNo || !trimmed.nationalId || !trimmed.fullName || !trimmed.phone || !trimmed.factory
    ? "Every field is needed."
    : !PHONE.test(trimmed.phone) ? "Phone must be a Kenyan mobile in international form: 254 then 9 digits." : null;

  const submit = async () => {
    const r = await register.run(trimmed);
    if (!r) return;
    setDone(r);
    onDone();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Register farmer"
      footer={done ? <Button onClick={close}>Done</Button> : (
        <>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button disabled={!!problem || register.pending} onClick={() => void submit()}>{register.pending ? "Registering…" : "Register"}</Button>
        </>
      )}
    >
      {done ? (
        <div data-testid="registered">
          <NotePanel tone="success" title="Registered">
            Farmer {done.growerNo} is registered and awaiting activation: no wallet and no PIN until they finish onboarding.
          </NotePanel>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-[12.5px] text-text-soft">Creates the farmer's record only. The farmer then finishes onboarding in the app or on the web, which opens their wallet.</p>
          <Field label="Grower number"><Input aria-label="Grower number" {...field("growerNo")} /></Field>
          <Field label="National ID"><Input aria-label="National ID" {...field("nationalId")} /></Field>
          <Field label="Full name"><Input aria-label="Full name" {...field("fullName")} /></Field>
          <Field label="Phone"><Input aria-label="Phone" inputMode="tel" placeholder="2547XXXXXXXX" {...field("phone")} /></Field>
          <Field label="Factory"><Input aria-label="Factory" {...field("factory")} /></Field>
          {form !== EMPTY && problem && <p className="text-[12.5px] text-text-soft" data-testid="form-problem">{problem}</p>}
          {register.error === NOT_AVAILABLE ? <NotAvailable /> : register.error && <p role="alert" className="text-[13px] text-danger">{register.error}</p>}
        </div>
      )}
    </Modal>
  );
}
