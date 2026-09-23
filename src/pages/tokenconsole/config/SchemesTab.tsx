import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Checkbox, Field, GlassPanel, Modal, NotePanel, Select, useToast } from "../../../ui";
import { tokenConsole } from "../../../lib/api";
import { label } from "../../../lib/tokenConsole/format";
import { useSharedSource } from "../../../lib/tokenConsole/sharedList";
import { useAction } from "../../../lib/tokenConsole/useAction";
import { useAsyncData } from "../../../lib/useAsyncData";
import type { AccountTemplate, AccountingScheme, CreateAccountTemplateRequest } from "../../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, type Source } from "../../../components/tokenconsole/ConsoleTable";
import { EntityCreateFlow, EntityRefField } from "../../../components/tokenconsole/EntityCreate";

type Role = CreateAccountTemplateRequest["accountRole"];
type Scope = NonNullable<CreateAccountTemplateRequest["scope"]>;

const ACCOUNT_ROLES: readonly Role[] = [
  "PRINCIPAL", "ACCRUED_INTEREST", "TAX_WITHHELD", "SETTLEMENT_CASH", "BANK_CASH", "UNALLOCATED",
  "FEE_INCOME", "LIQUIDITY_EXPENSE", "INVESTOR_EXPENSE", "REALIZED_GAIN_LOSS",
  "LOAN_PRINCIPAL", "LOAN_INTEREST_RECEIVABLE", "INTEREST_INCOME", "PENALTY_INCOME",
];
const SCOPES: readonly Scope[] = ["PER_CONTRACT", "PER_INSTITUTION"];

/** Schemes on the left; the selected scheme's account templates on the right. */
export function SchemesTab({ schemes }: { schemes: Source<AccountingScheme> }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Until someone picks, show the first scheme rather than an empty panel.
  const active = picked ?? schemes.data?.[0]?.schemeId ?? null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <ConsoleTable<AccountingScheme>
        className=""
        title="Accounting schemes"
        description="Select one to see its account templates."
        actions={<Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> New scheme</Button>}
        what="accounting schemes"
        source={schemes}
        rowId={(r) => r.schemeId}
        selectedId={active}
        onRowClick={(r) => setPicked(r.schemeId ?? null)}
        emptyLabel="No schemes yet — a product needs one before it can be created"
        columns={[
          { key: "scheme", header: "Scheme", render: (r) => <Code>{r.schemeId}</Code> },
          { key: "name", header: "Name", render: (r) => r.name ?? "—" },
        ]}
      />

      <GlassPanel className="p-4" sheen={false}>
        {active ? (
          <TemplatesPanel key={active} schemeId={active} schemeName={schemes.data?.find((s) => s.schemeId === active)?.name} />
        ) : (
          <p className="py-6 text-center text-[13px] text-text-soft">Create a scheme to map its account roles.</p>
        )}
      </GlassPanel>

      {creating && (
        <EntityCreateFlow entityKey="scheme" originLabel="Configuration" onCreated={(id) => setPicked(id)} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}

function TemplatesPanel({ schemeId, schemeName }: { schemeId: string; schemeName?: string }) {
  const templates = useAsyncData(() => tokenConsole.schemeTemplates(schemeId));
  const chart = useSharedSource("tok:chartOfAccount", tokenConsole.chart);
  const [adding, setAdding] = useState(false);
  const accountName = (code?: string) => chart.data?.find((a) => a.accountCode === code)?.accountName;

  return (
    <>
      <ConsoleTable<AccountTemplate>
        className=""
        title={schemeName ? `Templates · ${schemeName}` : "Templates"}
        description="Which chart-of-accounts code each account role posts to."
        actions={<Button size="sm" onClick={() => setAdding(true)}><Plus size={14} /> Add template</Button>}
        what="account templates"
        source={templates}
        rowId={(r) => r.templateId ?? `${r.accountRole}-${r.scope}`}
        emptyLabel="No templates on this scheme yet — add one per account role it posts to"
        columns={[
          { key: "role", header: "Role", render: (r) => label(r.accountRole) },
          { key: "account", header: "Account", render: (r) => (
            <span className="flex min-w-0 items-baseline gap-2">
              <Code>{r.accountCode ?? "—"}</Code>
              {accountName(r.accountCode) && <span className="truncate text-xs text-text-soft">{accountName(r.accountCode)}</span>}
            </span>
          ) },
          { key: "scope", header: "Scope", render: (r) => label(r.scope), hideOnMobile: true },
          { key: "avail", header: "Avail. bal", render: (r) => (r.availableBalance ? "Yes" : "No"), hideOnMobile: true },
        ]}
      />
      {adding && (
        <AddTemplateModal
          schemeId={schemeId}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void templates.reload();
          }}
        />
      )}
    </>
  );
}

function AddTemplateModal({ schemeId, onClose, onAdded }: { schemeId: string; onClose: () => void; onAdded: () => void }) {
  const create = useAction(tokenConsole.createAccountTemplate);
  const toast = useToast();
  const [accountRole, setRole] = useState<Role>("PRINCIPAL");
  const [accountCode, setCode] = useState("");
  const [scope, setScope] = useState<Scope>("PER_CONTRACT");
  const [availableBalance, setAvail] = useState(false);

  const submit = async () => {
    const saved = await create.run({ schemeId, accountRole, accountCode: accountCode || undefined, scope, availableBalance });
    if (saved === undefined) return;
    toast.push(`Added ${label(accountRole)} to ${schemeId}.`);
    onAdded();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add account template · ${schemeId}`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={create.pending} onClick={() => void submit()}>{create.pending ? "Adding…" : "Add template"}</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Account role" required>
          <Select value={accountRole} onChange={(e) => setRole(e.target.value as Role)}>
            {ACCOUNT_ROLES.map((v) => <option key={v} value={v}>{label(v)}</option>)}
          </Select>
        </Field>
        <Field label="Account" hint="Leave blank to use the role's default code." group>
          <EntityRefField entityKey="chartOfAccount" value={accountCode} onChange={setCode} placeholder="Role default" />
        </Field>
        <Field label="Scope">
          <Select value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
            {SCOPES.map((v) => <option key={v} value={v}>{label(v)}</option>)}
          </Select>
        </Field>
        <Checkbox checked={availableBalance} onChange={setAvail}>Counts toward available balance</Checkbox>
      </div>
      {create.error && <NotePanel tone="danger" className="mt-4">{create.error}</NotePanel>}
    </Modal>
  );
}
