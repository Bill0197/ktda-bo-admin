import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Checkbox, Field, Input, NotePanel, PageHeader, Select, useToast } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { calendarDate, dateTime, label, percent } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import type {
  AccrualPolicyResponse, CreateScheduleRequest, DistributionPolicyResponse, ScheduleResponse,
} from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { ActionModal, blankToUndefined, isNumber, todayIso } from "../../components/tokenconsole/ActionModal";
import { OfferingPicker, ProductPicker } from "../../components/tokenconsole/Pickers";

type Scope = "OFFERING" | "PRODUCT" | "GLOBAL";
const DAY_COUNTS = ["ACTUAL_365", "ACTUAL_360", "THIRTY_360"] as const;
const JOB_TYPES = ["ACCRUAL", "DISTRIBUTION", "FEE", "TAX_REMITTANCE", "NAV"] as const;
const ZONE = "Africa/Nairobi";
/** Spring cron: second minute hour day month weekday. */
const CRON_HINT = "Six fields — second minute hour day month weekday. 0 0 1 * * * is 01:00 every day.";
const cronLooksValid = (c: string) => c.trim().split(/\s+/).length === 6;

/** A policy only acts when it is both approved and active; either alone is
 * inert, so the two are shown as one state rather than two yes/no columns. */
function PolicyState({ approved, active }: { approved?: boolean; active?: boolean }) {
  if (!approved) return <Badge tone="warning" className="whitespace-nowrap">Unapproved</Badge>;
  if (active === false) return <Badge tone="neutral" className="whitespace-nowrap">Inactive</Badge>;
  return <Badge tone="success" className="whitespace-nowrap">In force</Badge>;
}

/** Where and from when a policy applies — one question, so one cell. */
const scope = (s?: string, ref?: string, from?: string, to?: string) => (
  <div className="whitespace-nowrap">
    <div className="text-text">{label(s)}</div>
    <div className="text-xs text-text-faint tabular">{ref ?? (s === "GLOBAL" ? "all products" : "—")}</div>
    <div className="tabular text-xs text-text-soft">{calendarDate(from)}{to ? ` – ${calendarDate(to)}` : " onward"}</div>
  </div>
);

export default function TokenConsolePolicies() {
  const toast = useToast();
  const accrual = useAsyncData(tokenConsole.accrualPolicies);
  const distribution = useAsyncData(tokenConsole.distributionPolicies);
  const schedules = useAsyncData(tokenConsole.schedules);
  const [creating, setCreating] = useState<"accrual" | "distribution" | "schedule" | null>(null);
  const [editingCron, setEditingCron] = useState<AccrualPolicyResponse | null>(null);

  /* Switches flip at once — each is undone by flipping it back — so they need
     no confirmation, just a clear result. */
  const toggle = useAction(async (what: "accrualActive" | "accrualSchedule" | "distributionActive" | "schedule", id: string, value: boolean) => {
    if (what === "accrualActive") await tokenConsole.setAccrualPolicyActive(id, value);
    else if (what === "accrualSchedule") await tokenConsole.setAccrualPolicySchedule(id, value);
    else if (what === "distributionActive") await tokenConsole.setDistributionPolicyActive(id, value);
    else await tokenConsole.setScheduleEnabled(id, value);
    return what;
  });
  const flip = async (what: Parameters<typeof toggle.run>[0], id: string | undefined, value: boolean, message: string) => {
    if (!id) return;
    const done = await toggle.run(what, id, value);
    if (!done) return;
    toast.push(message);
    if (what === "schedule") void schedules.reload();
    else if (what === "distributionActive") void distribution.reload();
    else {
      void accrual.reload();
      void schedules.reload();
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="Accrual & distribution policies"
        subtitle="What the batch runs do when they execute. An unapproved or inactive policy is inert: the run finds nothing to act on."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setCreating("accrual")}><Plus size={14} /> Accrual policy</Button>
            <Button size="sm" variant="outline" onClick={() => setCreating("distribution")}><Plus size={14} /> Distribution policy</Button>
            <Button size="sm" onClick={() => setCreating("schedule")}><Plus size={14} /> Schedule</Button>
          </div>
        }
      />
      {toggle.error && <NotePanel tone="danger" className="mb-4">{toggle.error}</NotePanel>}

      <ConsoleTable<AccrualPolicyResponse>
        what="accrual policies"
        source={accrual}
        rowId={(r) => r.policyId}
        title="Accrual policies"
        emptyLabel="No accrual policies"
        columns={[
          { key: "scope", header: "Applies to · effective", className: "whitespace-nowrap", render: (r) => scope(r.scope, r.scopeRef, r.effectiveFrom, r.effectiveTo) },
          { key: "rate", header: "Rate", className: "whitespace-nowrap", render: (r) => (
            <div className="text-xs">
              <div className="text-text">{r.rateSource === "FIXED" ? percent(r.fixedRate) : "From tariff"}</div>
              <div className="text-text-faint">{label(r.method)}</div>
              <div className="text-text-faint">{label(r.dayCount)}</div>
            </div>
          ) },
          { key: "schedule", header: "Schedule", render: (r) => (
            <div className="text-xs">
              <div className="text-text-soft">{r.scheduleEnabled ? <Code>{r.cron}</Code> : "Not scheduled"}</div>
              {/* Two short lines rather than one long one that wraps mid-date. */}
              {r.lastRunAt && (
                <div className="text-text-faint whitespace-nowrap">
                  <div>last {dateTime(r.lastRunAt)}</div>
                  <div>accrued to {calendarDate(r.lastAccruedTo)}</div>
                </div>
              )}
            </div>
          ), hideOnMobile: true },
          { key: "state", header: "State", render: (r) => <PolicyState approved={r.approved} active={r.active} /> },
          { key: "actions", header: "", className: "text-right", render: (r) => (
            <div className="flex flex-wrap justify-end gap-1 xl:flex-nowrap">
              <Button size="sm" variant="ghost" disabled={toggle.pending}
                onClick={() => void flip("accrualActive", r.policyId, !r.active, r.active ? "Accrual policy deactivated." : "Accrual policy activated.")}>
                {r.active ? "Deactivate" : "Activate"}
              </Button>
              <Button size="sm" variant="ghost" disabled={toggle.pending || (!r.scheduleEnabled && !r.cron)}
                title={!r.scheduleEnabled && !r.cron ? "Set a schedule first" : undefined}
                onClick={() => void flip("accrualSchedule", r.policyId, !r.scheduleEnabled, r.scheduleEnabled ? "Schedule turned off." : "Schedule turned on.")}>
                {r.scheduleEnabled ? "Unschedule" : "Schedule"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingCron(r)}>Edit schedule</Button>
            </div>
          ) },
        ]}
      />

      <ConsoleTable<DistributionPolicyResponse>
        what="distribution policies"
        source={distribution}
        rowId={(r) => r.policyId}
        title="Distribution policies"
        emptyLabel="No distribution policies"
        columns={[
          { key: "scope", header: "Applies to · effective", className: "whitespace-nowrap", render: (r) => scope(r.scope, r.scopeRef, r.effectiveFrom, r.effectiveTo) },
          { key: "mode", header: "Mode", className: "whitespace-nowrap", render: (r) => (
            <div className="text-xs">
              <div className="text-text">{label(r.mode)}</div>
              <div className="text-text-faint">withholding {percent(r.whtRate)}</div>
            </div>
          ) },
          { key: "state", header: "State", render: (r) => <PolicyState approved={r.approved} active={r.active} /> },
          { key: "actions", header: "", className: "text-right", render: (r) => (
            <Button size="sm" variant="ghost" disabled={toggle.pending}
              onClick={() => void flip("distributionActive", r.policyId, !r.active, r.active ? "Distribution policy deactivated." : "Distribution policy activated.")}>
              {r.active ? "Deactivate" : "Activate"}
            </Button>
          ) },
        ]}
      />

      <ConsoleTable<ScheduleResponse>
        what="schedules"
        source={schedules}
        rowId={(r) => r.scheduleId}
        title="Schedules"
        emptyLabel="No schedules"
        columns={[
          { key: "job", header: "Job", className: "min-w-[180px]", render: (r) => (
            <div>
              <div className="text-text">{label(r.jobType)}</div>
              {r.description && <div className="text-xs text-text-faint line-clamp-2" title={r.description}>{r.description}</div>}
            </div>
          ) },
          { key: "cron", header: "When", className: "whitespace-nowrap", render: (r) => (
            <div className="text-xs">
              <Code>{r.cron}</Code>
              <div className="text-text-faint">{r.zone ?? ""}</div>
            </div>
          ) },
          { key: "runs", header: "Last / next", className: "whitespace-nowrap", render: (r) => (
            <div className="text-xs tabular text-text-soft">
              <div>{dateTime(r.lastRunAt)} {r.lastStatus && <StatusBadge status={r.lastStatus} />}</div>
              <div className="text-text-faint">next {dateTime(r.nextRunAt)}</div>
            </div>
          ), hideOnMobile: true },
          { key: "enabled", header: "Enabled", render: (r) => <Badge tone={r.enabled ? "success" : "neutral"} className="whitespace-nowrap">{r.enabled ? "On" : "Off"}</Badge> },
          { key: "actions", header: "", className: "text-right", render: (r) => (
            <Button size="sm" variant="ghost" disabled={toggle.pending}
              onClick={() => void flip("schedule", r.scheduleId, !r.enabled, r.enabled ? "Schedule turned off." : "Schedule turned on.")}>
              {r.enabled ? "Turn off" : "Turn on"}
            </Button>
          ) },
        ]}
      />

      {creating === "accrual" && <AccrualPolicyModal onClose={() => setCreating(null)} onDone={() => { setCreating(null); toast.push("Accrual policy created."); void accrual.reload(); void schedules.reload(); }} />}
      {creating === "distribution" && <DistributionPolicyModal onClose={() => setCreating(null)} onDone={() => { setCreating(null); toast.push("Distribution policy created."); void distribution.reload(); }} />}
      {creating === "schedule" && <ScheduleModal onClose={() => setCreating(null)} onDone={() => { setCreating(null); toast.push("Schedule created."); void schedules.reload(); }} />}
      {editingCron && (
        <CronModal
          policy={editingCron}
          onClose={() => setEditingCron(null)}
          onDone={() => { setEditingCron(null); toast.push("Schedule saved."); void accrual.reload(); void schedules.reload(); }}
        />
      )}
    </div>
  );
}

/** Where a policy applies: everything, one product, or one offering. */
function ScopeFields({ scope, setScope, scopeRef, setScopeRef }: {
  scope: Scope; setScope: (s: Scope) => void; scopeRef: string; setScopeRef: (s: string) => void;
}) {
  return (
    <>
      <Field label="Applies to" required>
        <Select value={scope} onChange={(e) => { setScope(e.target.value as Scope); setScopeRef(""); }}>
          <option value="GLOBAL">All products</option>
          <option value="PRODUCT">One product</option>
          <option value="OFFERING">One offering</option>
        </Select>
      </Field>
      {scope === "PRODUCT" && <Field label="Product" required group><ProductPicker value={scopeRef} onChange={setScopeRef} /></Field>}
      {scope === "OFFERING" && <Field label="Offering" required group><OfferingPicker value={scopeRef} onChange={setScopeRef} /></Field>}
    </>
  );
}

/* `approved` and `scheduleEnabled` are always sent: the service fills an
   absent one with false and silently creates an inert policy (spec-deviations §5). */
function AccrualPolicyModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const create = useAction(tokenConsole.createAccrualPolicy);
  const [scope, setScope] = useState<Scope>("GLOBAL");
  const [scopeRef, setScopeRef] = useState("");
  const [rateSource, setRateSource] = useState<"TARIFF" | "FIXED">("TARIFF");
  const [fixedRate, setFixedRate] = useState("");
  const [dayCount, setDayCount] = useState<(typeof DAY_COUNTS)[number]>("ACTUAL_365");
  const [currency, setCurrency] = useState("");
  const [effectiveFrom, setFrom] = useState(todayIso());
  const [effectiveTo, setTo] = useState("");
  const [approved, setApproved] = useState(false);
  const [cron, setCron] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const problem = scope !== "GLOBAL" && !scopeRef ? "Pick what it applies to."
    : rateSource === "FIXED" && !isNumber(fixedRate) ? "Enter the fixed rate as a fraction, e.g. 0.1 for 10%."
    : !effectiveFrom ? "An effective-from date is required."
    : effectiveTo && effectiveTo < effectiveFrom ? "It ends before it starts."
    : currency && !/^[A-Za-z]{3}$/.test(currency) ? "Currency is a three-letter code."
    : scheduleEnabled && !cronLooksValid(cron) ? "A scheduled policy needs a six-field cron." : undefined;
  const submit = async () => {
    const r = await create.run({
      scope, scopeRef: scope === "GLOBAL" ? undefined : scopeRef, method: "SIMPLE_DAILY", rateSource,
      fixedRate: rateSource === "FIXED" ? Number(fixedRate) : undefined, dayCount,
      currency: blankToUndefined(currency)?.toUpperCase(), effectiveFrom, effectiveTo: effectiveTo || undefined,
      approved, cron: blankToUndefined(cron), zone: cron ? ZONE : undefined, scheduleEnabled,
    });
    if (r) onDone();
  };
  return (
    <ActionModal title="New accrual policy" description="How interest accrues for what it applies to, and when it runs by itself."
      submitLabel="Create policy" problem={problem} pending={create.pending} error={create.error}
      onSubmit={() => void submit()} onClose={onClose} size="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <ScopeFields scope={scope} setScope={setScope} scopeRef={scopeRef} setScopeRef={setScopeRef} />
        <Field label="Rate source" required>
          <Select value={rateSource} onChange={(e) => setRateSource(e.target.value as "TARIFF" | "FIXED")}>
            <option value="TARIFF">From the tariff</option>
            <option value="FIXED">Fixed rate</option>
          </Select>
        </Field>
        {rateSource === "FIXED" && (
          <Field label="Fixed rate" required hint="A fraction: 0.1 means 10%.">
            <Input type="number" inputMode="decimal" step="any" value={fixedRate} onChange={(e) => setFixedRate(e.target.value)} />
          </Field>
        )}
        <Field label="Day count">
          <Select value={dayCount} onChange={(e) => setDayCount(e.target.value as (typeof DAY_COUNTS)[number])}>
            {DAY_COUNTS.map((d) => <option key={d} value={d}>{label(d)}</option>)}
          </Select>
        </Field>
        <Field label="Currency" hint="Blank applies to every currency.">
          <Input value={currency} maxLength={3} className="uppercase placeholder:normal-case" onChange={(e) => setCurrency(e.target.value)} placeholder="KES" />
        </Field>
        <Field label="Effective from" required><Input type="date" value={effectiveFrom} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Effective to"><Input type="date" value={effectiveTo} min={effectiveFrom} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Schedule (cron)" hint={CRON_HINT}><Input value={cron} onChange={(e) => setCron(e.target.value)} placeholder="0 0 1 * * *" /></Field>
        <div className="flex flex-col justify-end gap-2.5 pb-1">
          <Checkbox checked={scheduleEnabled} onChange={setScheduleEnabled}>Run on the schedule</Checkbox>
          <Checkbox checked={approved} onChange={setApproved}>Approved — it acts from its effective date</Checkbox>
        </div>
      </div>
    </ActionModal>
  );
}

function DistributionPolicyModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const create = useAction(tokenConsole.createDistributionPolicy);
  const [scope, setScope] = useState<Scope>("GLOBAL");
  const [scopeRef, setScopeRef] = useState("");
  const [mode, setMode] = useState<"INCOME" | "GROWTH">("INCOME");
  const [whtRate, setWht] = useState("");
  const [currency, setCurrency] = useState("");
  const [effectiveFrom, setFrom] = useState(todayIso());
  const [effectiveTo, setTo] = useState("");
  const [approved, setApproved] = useState(false);
  const problem = scope !== "GLOBAL" && !scopeRef ? "Pick what it applies to."
    : whtRate && (!isNumber(whtRate) || Number(whtRate) < 0 || Number(whtRate) > 1) ? "Withholding is a fraction between 0 and 1, e.g. 0.15."
    : !effectiveFrom ? "An effective-from date is required."
    : effectiveTo && effectiveTo < effectiveFrom ? "It ends before it starts."
    : currency && !/^[A-Za-z]{3}$/.test(currency) ? "Currency is a three-letter code." : undefined;
  const submit = async () => {
    const r = await create.run({
      scope, scopeRef: scope === "GLOBAL" ? undefined : scopeRef, mode, whtRate: whtRate ? Number(whtRate) : undefined,
      currency: blankToUndefined(currency)?.toUpperCase(), effectiveFrom, effectiveTo: effectiveTo || undefined, approved,
    });
    if (r) onDone();
  };
  return (
    <ActionModal title="New distribution policy" description="What a distribution does for what it applies to: pay out as cash (income) or reinvest as units (growth), and the tax it withholds."
      submitLabel="Create policy" problem={problem} pending={create.pending} error={create.error}
      onSubmit={() => void submit()} onClose={onClose} size="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <ScopeFields scope={scope} setScope={setScope} scopeRef={scopeRef} setScopeRef={setScopeRef} />
        <Field label="Mode" required>
          <Select value={mode} onChange={(e) => setMode(e.target.value as "INCOME" | "GROWTH")}>
            <option value="INCOME">Income — pay out</option>
            <option value="GROWTH">Growth — reinvest</option>
          </Select>
        </Field>
        <Field label="Withholding tax" hint="A fraction: 0.15 means 15%.">
          <Input type="number" inputMode="decimal" step="any" value={whtRate} onChange={(e) => setWht(e.target.value)} />
        </Field>
        <Field label="Currency" hint="Blank applies to every currency.">
          <Input value={currency} maxLength={3} className="uppercase placeholder:normal-case" onChange={(e) => setCurrency(e.target.value)} placeholder="KES" />
        </Field>
        <Field label="Effective from" required><Input type="date" value={effectiveFrom} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Effective to"><Input type="date" value={effectiveTo} min={effectiveFrom} onChange={(e) => setTo(e.target.value)} /></Field>
        <div className="flex items-end pb-2.5">
          <Checkbox checked={approved} onChange={setApproved}>Approved — it acts from its effective date</Checkbox>
        </div>
      </div>
    </ActionModal>
  );
}

function ScheduleModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const create = useAction(tokenConsole.createSchedule);
  const [jobType, setJobType] = useState<CreateScheduleRequest["jobType"]>("NAV");
  const [cron, setCron] = useState("");
  const [zone, setZone] = useState(ZONE);
  const [enabled, setEnabled] = useState(true);
  const [description, setDescription] = useState("");
  const problem = !cronLooksValid(cron) ? "Enter a six-field cron." : undefined;
  const submit = async () => {
    const r = await create.run({ jobType, cron: cron.trim(), zone: blankToUndefined(zone), enabled, description: blankToUndefined(description) });
    if (r) onDone();
  };
  return (
    <ActionModal title="New schedule" description="Runs a batch job by itself at the times the cron names."
      submitLabel="Create schedule" problem={problem} showProblem={!!cron} pending={create.pending} error={create.error}
      onSubmit={() => void submit()} onClose={onClose}>
      <div className="grid gap-4">
        <Field label="Job" required>
          <Select value={jobType} onChange={(e) => setJobType(e.target.value as CreateScheduleRequest["jobType"])}>
            {JOB_TYPES.map((j) => <option key={j} value={j}>{label(j)}</option>)}
          </Select>
        </Field>
        <Field label="Cron" required hint={CRON_HINT}><Input value={cron} onChange={(e) => setCron(e.target.value)} placeholder="0 0 1 * * *" /></Field>
        <Field label="Time zone"><Input value={zone} onChange={(e) => setZone(e.target.value)} /></Field>
        <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Checkbox checked={enabled} onChange={setEnabled}>Turn it on now</Checkbox>
      </div>
    </ActionModal>
  );
}

function CronModal({ policy, onClose, onDone }: { policy: AccrualPolicyResponse; onClose: () => void; onDone: () => void }) {
  const save = useAction(tokenConsole.configureAccrualSchedule);
  const [cron, setCron] = useState(policy.cron ?? "");
  const [zone, setZone] = useState(policy.zone ?? ZONE);
  const [enabled, setEnabled] = useState(policy.scheduleEnabled ?? false);
  const problem = !cronLooksValid(cron) ? "Enter a six-field cron." : undefined;
  const submit = async () => {
    const r = await save.run(policy.policyId ?? "", { cron: cron.trim(), zone: blankToUndefined(zone), enabled });
    if (r) onDone();
  };
  return (
    <ActionModal title="Accrual schedule" description="When this policy's accrual runs by itself."
      submitLabel="Save schedule" problem={problem} showProblem={!!cron} pending={save.pending} error={save.error}
      onSubmit={() => void submit()} onClose={onClose}>
      <div className="grid gap-4">
        <Field label="Cron" required hint={CRON_HINT}><Input value={cron} onChange={(e) => setCron(e.target.value)} placeholder="0 0 1 * * *" /></Field>
        <Field label="Time zone"><Input value={zone} onChange={(e) => setZone(e.target.value)} /></Field>
        <Checkbox checked={enabled} onChange={setEnabled}>Run on the schedule</Checkbox>
      </div>
    </ActionModal>
  );
}
