import type { ReactNode } from "react";

export function KeyValue({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {rows.map((r, i) => (
        <div key={i} className="flex items-baseline justify-between sm:justify-start sm:gap-2 border-b border-border/60 sm:border-none pb-2 sm:pb-0">
          <dt className="text-xs text-text-faint">{r.label}</dt>
          <dd className="text-sm font-medium text-text tabular">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
