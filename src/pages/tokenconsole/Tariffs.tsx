import { Badge, PageHeader } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { calendarDate, label, percent } from "../../lib/tokenConsole/format";
import type { TariffDomain, TariffType, TariffValue } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable } from "../../components/tokenconsole/ConsoleTable";

/** Values are effective-dated and never edited: a new rate is a new row, so
 * past periods still resolve to the rate that was in force. The console this
 * page came from listed values without their rate or dates; they are the
 * point of the table, so they are shown here. */
export default function TokenConsoleTariffs() {
  const domains = useAsyncData(tokenConsole.tariffDomains);
  const types = useAsyncData(tokenConsole.tariffTypes);
  const values = useAsyncData(tokenConsole.tariffValues);

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="Tariffs"
        subtitle="Fee and rate definitions: a domain groups types, and a value is what a type actually charges, from a date."
      />

      <ConsoleTable<TariffValue>
        what="tariff values"
        source={values}
        rowId={(r) => r.tariffValueId}
        title="Values"
        emptyLabel="No values"
        columns={[
          { key: "type", header: "Type", render: (r) => (
            <div>
              <Code>{r.tariffTypeId}</Code>
              <div className="text-xs text-text-faint">{r.tariffDomainId ?? ""}</div>
            </div>
          ) },
          { key: "rate", header: "Rate", className: "tabular text-right whitespace-nowrap", render: (r) => (
            <div>
              <div className="text-text">{percent(r.rate)}</div>
              <div className="text-[11px] text-text-faint">{r.currency ?? ""} · {label(r.dayCount)}</div>
            </div>
          ) },
          { key: "effective", header: "Effective", render: (r) => (
            <span className="tabular text-xs text-text-soft">
              {calendarDate(r.effectiveFrom)}{r.effectiveTo ? ` – ${calendarDate(r.effectiveTo)}` : " onward"}
            </span>
          ), hideOnMobile: true },
          { key: "approved", header: "Approved", render: (r) => (
            <Badge tone={r.approved ? "success" : "warning"} className="whitespace-nowrap">{r.approved ? "Approved" : "Pending"}</Badge>
          ) },
        ]}
      />

      <ConsoleTable<TariffType>
        what="tariff types"
        source={types}
        rowId={(r) => r.tariffTypeId}
        title="Types"
        emptyLabel="No types"
        columns={[
          { key: "id", header: "Type", render: (r) => <Code>{r.tariffTypeId}</Code> },
          { key: "name", header: "Name", render: (r) => r.name ?? "—" },
          { key: "kind", header: "Kind", render: (r) => label(r.valueKind), hideOnMobile: true },
        ]}
      />

      <ConsoleTable<TariffDomain>
        what="tariff domains"
        source={domains}
        rowId={(r) => r.tariffDomainId}
        title="Domains"
        emptyLabel="No domains"
        columns={[
          { key: "id", header: "Domain", render: (r) => <Code>{r.tariffDomainId}</Code> },
          { key: "name", header: "Name", render: (r) => r.name ?? "—" },
          { key: "category", header: "Category", render: (r) => r.domainCategory ?? "—", hideOnMobile: true },
          { key: "parent", header: "Parent", render: (r) => <Code>{r.parentDomainId}</Code>, hideOnMobile: true },
        ]}
      />
    </div>
  );
}
