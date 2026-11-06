import { Download } from "lucide-react";
import { Button } from "../../../ui";
import { money, units } from "../../../lib/tokenConsole/format";
import { csvCell } from "../../../lib/bulk-file";
import type { BulkFlow, HeldLine } from "../../../lib/api.bulkLoad";
import { MiniTable } from "./shared";
import { baseName, downloadText } from "./rules";

/* The lines omnichannel set aside on this run, with its reasons: payment
   lines its checks held (never paid), and registration rows that CLASH (the
   phone is already another farmer's). Shown only when omnichannel sends them. */

const SHOWN = 25;

export function RunExceptions({ flow, lines, heldCount, clashCount, currency, sourceName }: {
  flow: BulkFlow;
  lines: HeldLine[] | null | undefined;
  heldCount: number | null | undefined;
  clashCount: number | null | undefined;
  currency: string;
  sourceName: string;
}) {
  const list = lines ?? [];
  const total = (heldCount ?? 0) + (clashCount ?? 0);
  if (list.length === 0 && total === 0) return null;
  const payment = flow === "PAYMENT";
  const title = payment ? "Held by omnichannel" : "Not registered";
  const csv = () => {
    const head = payment ? "LineNo,GrowerNo,Code,Reason,AmountKES" : "LineNo,GrowerNo,Phone,Code,Reason";
    const rows = list.map((l) => (payment
      ? [l.lineNo, l.growerNo ?? "", l.code ?? "", l.reason, l.amount != null ? l.amount.toFixed(2) : ""]
      : [l.lineNo, l.growerNo ?? "", l.phone ?? "", l.code ?? "", l.reason]).map(csvCell).join(","));
    downloadText(`${baseName(sourceName)}.${payment ? "held" : "clashes"}.csv`, `${[head, ...rows].join("\n")}\n`);
  };
  return (
    <div className="mt-4 space-y-3" data-testid="run-exceptions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {list.length > 0 && <Button size="sm" variant="outline" onClick={csv}><Download size={13} /> Download ({units(list.length)})</Button>}
      </div>
      {list.length === 0 ? (
        <p className="text-[12.5px] text-text-soft">
          Omnichannel {payment ? `held ${units(heldCount ?? 0)} line${heldCount === 1 ? "" : "s"}` : `refused ${units(clashCount ?? 0)} row${clashCount === 1 ? "" : "s"} as clashes`} but did not list them; its message above has the detail.
        </p>
      ) : (
        <>
          <MiniTable testId="run-exceptions-table" caption={title} head={payment
            ? [{ label: "Line" }, { label: "Grower" }, { label: "Reason" }, { label: "Net", right: true }]
            : [{ label: "Line" }, { label: "Grower" }, { label: "Phone" }, { label: "Reason" }]}>
            {list.slice(0, SHOWN).map((l) => (
              <tr key={`${l.lineNo}-${l.code ?? ""}`} className="border-t border-border/60">
                <td className="px-3 py-2 tabular text-text-soft">{l.lineNo}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px]">{l.growerNo ?? "—"}</td>
                {!payment && <td className="whitespace-nowrap px-3 py-2 tabular">{l.phone ?? "—"}</td>}
                <td className="px-3 py-2 text-danger [overflow-wrap:anywhere]">{l.code === "CLASH" ? <><span className="font-semibold">Clash</span>: {l.reason}</> : l.reason}</td>
                {payment && <td className="whitespace-nowrap px-3 py-2 text-right tabular">{l.amount != null ? money(l.amount, currency) : "—"}</td>}
              </tr>
            ))}
          </MiniTable>
          {(list.length > SHOWN || total > list.length) && (
            <p className="text-[12px] text-text-faint">
              Showing {units(Math.min(SHOWN, list.length))} of {units(Math.max(total, list.length))}{total > list.length ? "; omnichannel sent the first " + units(list.length) : ""}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
