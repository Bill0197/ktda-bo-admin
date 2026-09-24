import type { ReactNode } from "react";

/** One labelled fact in a record's detail panel. Wrap several in a
 *  `<dl className="grid …">`. */
export function DetailItem({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-faint">{term}</dt>
      <dd className="mt-1 text-sm text-text">{children}</dd>
    </div>
  );
}
