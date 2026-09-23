import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../../ui";
import { tokenConsole } from "../../../lib/api";
import { label } from "../../../lib/tokenConsole/format";
import { useSharedSource } from "../../../lib/tokenConsole/sharedList";
import type { ChartOfAccount, ClassifierType, ClassifierValue, ContractSubtype } from "../../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, type Source } from "../../../components/tokenconsole/ConsoleTable";
import { EntityCreateFlow } from "../../../components/tokenconsole/EntityCreate";

export function ChartTab({ chart }: { chart: Source<ChartOfAccount> }) {
  return (
    <ConsoleTable<ChartOfAccount>
      title="Chart of accounts"
      description="Every code a posting can land on. Read-only here."
      what="the chart of accounts"
      source={chart}
      rowId={(r) => r.accountCode}
      emptyLabel="No chart loaded"
      columns={[
        { key: "code", header: "Code", render: (r) => <Code>{r.accountCode}</Code> },
        { key: "name", header: "Account", render: (r) => r.accountName ?? "—" },
        { key: "type", header: "Type", render: (r) => label(r.accountType) },
        { key: "normal", header: "Normal balance", render: (r) => label(r.normalBalance), hideOnMobile: true },
      ]}
    />
  );
}

export function SubtypesTab({ subtypes }: { subtypes: Source<ContractSubtype> }) {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <ConsoleTable<ContractSubtype>
        title="Contract subtypes"
        description="What kind of contract subscribing to a product creates."
        actions={<Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> New subtype</Button>}
        what="contract subtypes"
        source={subtypes}
        rowId={(r) => r.contractSubtypeId}
        emptyLabel="No contract subtypes yet"
        columns={[
          { key: "id", header: "ID", render: (r) => <Code>{r.contractSubtypeId}</Code> },
          { key: "name", header: "Name", render: (r) => r.subtypeName ?? "—" },
        ]}
      />
      {creating && (
        <EntityCreateFlow entityKey="contractSubtype" originLabel="Configuration" onCreated={() => {}} onClose={() => setCreating(false)} />
      )}
    </>
  );
}

export function ClassifiersTab({ types }: { types: Source<ClassifierType> }) {
  const values = useSharedSource("tok:classifierValue", tokenConsole.classifierValues);
  const [picked, setPicked] = useState<string | null>(null);
  // Until someone picks, show the first type rather than an empty panel.
  const active = picked ?? types.data?.[0]?.classifierTypeId ?? null;
  const valuesOf = (typeId?: string) => (values.data ?? []).filter((v) => v.classifierTypeId === typeId);
  const activeValues = [...valuesOf(active ?? undefined)].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <ConsoleTable<ClassifierType>
        className=""
        title="Classifier types"
        description="Select one to see its values."
        what="classifier types"
        source={types}
        rowId={(r) => r.classifierTypeId}
        selectedId={active}
        onRowClick={(r) => setPicked(r.classifierTypeId ?? null)}
        emptyLabel="No classifier types"
        columns={[
          { key: "type", header: "Type", render: (r) => <Code>{r.classifierTypeId}</Code> },
          { key: "name", header: "Name", render: (r) => r.name ?? "—" },
          { key: "applies", header: "Applies to", render: (r) => label(r.appliesTo), hideOnMobile: true },
          { key: "values", header: "Values", className: "tabular text-right", render: (r) => valuesOf(r.classifierTypeId).length || "—" },
        ]}
      />
      <ConsoleTable<ClassifierValue>
        className=""
        title="Values"
        description={active ? `Belonging to ${active}.` : undefined}
        what="classifier values"
        source={values}
        rows={active ? activeValues : []}
        rowId={(r) => r.valueId ?? `${r.classifierTypeId}-${r.code}`}
        emptyLabel={active ? "No values for this type" : "Pick a type"}
        columns={[
          { key: "code", header: "Code", render: (r) => <Code>{r.code ?? "—"}</Code> },
          { key: "name", header: "Name", render: (r) => r.name ?? "—" },
        ]}
      />
    </div>
  );
}
