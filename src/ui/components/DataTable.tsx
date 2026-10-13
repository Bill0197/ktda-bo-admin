import { useMemo, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Columns3 } from "lucide-react";
import { Pagination, usePagination } from "./Pagination";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
  /** Start hidden — still listed in the column picker, so wide tables can
   * carry every available field without overwhelming the default view. */
  defaultHidden?: boolean;
};

/** Renders a real <table> on tablet+ and collapses to stacked cards on
 * mobile — data tables are where "mobile friendly" usually breaks first.
 * With `columnPicker`, users can toggle any declared column on or off.
 * The rows are shown a page at a time with the pager below, unless `paged`
 * is turned off; `newest` lists them newest first. */

/** Newest first by the date `at` picks; rows without one go last, in the
 *  order they came. */
function newestFirst<T>(rows: T[], at: (row: T) => string | null | undefined): T[] {
  const time = (r: T) => Date.parse(at(r) ?? "") || -Infinity;
  return [...rows].sort((a, b) => {
    const x = time(a), y = time(b);
    return x === y ? 0 : y > x ? 1 : -1;
  });
}

export function DataTable<T extends { id: string | number }>({
  columns,
  rows: given,
  newest,
  onRowClick,
  emptyLabel = "No records",
  columnPicker = false,
  selectedId,
  paged = true,
  footer,
}: {
  columns: Column<T>[];
  rows: T[];
  /** The date that puts the newest row first. Left out for a list that has
   *  none, or whose page has already ordered it. */
  newest?: (row: T) => string | null | undefined;
  onRowClick?: (row: T) => void;
  emptyLabel?: string;
  columnPicker?: boolean;
  /** Marks one row as the current selection — for master-detail layouts,
   *  where the list drives a panel beside it. */
  selectedId?: string | number | null;
  /** Off for a set that is read whole (the lines of one journal entry), or
   *  one its service pages (the pager then comes in as `footer`). */
  paged?: boolean;
  /** Under the rows — the pager of a list its service pages. */
  footer?: ReactNode;
}) {
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  // `newest` is a new function every render, so the order follows the rows alone.
  const newestRef = useRef(newest);
  newestRef.current = newest;
  const sorted = newest !== undefined;
  const rows = useMemo(() => (sorted && newestRef.current ? newestFirst(given, newestRef.current) : given), [given, sorted]);
  const pagination = usePagination(rows, paged);
  const topRef = useRef<HTMLDivElement>(null);
  // A new page starts at its first row, not wherever the last one was left.
  const toTop = () => {
    const top = topRef.current;
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: "start" });
  };

  const visible = useMemo(() => columns.filter((c) => !hidden.has(c.key)), [columns, hidden]);

  const toggle = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (visible.filter((c) => c.header).length > 1) next.add(key); // never hide the last data column
      return next;
    });
  };

  const picker = columnPicker && (
    <div className="relative flex justify-end mb-2">
      <button
        type="button"
        onClick={() => setPickerOpen((o) => !o)}
        aria-expanded={pickerOpen}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium text-text-soft hover:text-text bg-surface border border-border shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
      >
        <Columns3 size={14} />
        Columns ({visible.filter((c) => c.header).length}/{columns.filter((c) => c.header).length})
      </button>
      {pickerOpen && (
        <>
          <button
            type="button"
            aria-label="Close column picker"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setPickerOpen(false)}
          />
          <div className="absolute right-0 top-9 z-20 w-56 rounded-lg border border-border bg-surface shadow-md p-2 max-h-72 overflow-y-auto">
            {/* Blank-header columns (row actions) aren't data; keep them out of the picker. */}
            {columns.filter((c) => c.header).map((c) => (
              <label key={c.key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-text hover:bg-surface-sunken cursor-pointer">
                <input
                  type="checkbox"
                  checked={!hidden.has(c.key)}
                  onChange={() => toggle(c.key)}
                  className="h-3.5 w-3.5 accent-[var(--primary-600)]"
                />
                {c.header || c.key}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );

  if (rows.length === 0) {
    return (
      <>
        {picker}
        <div className="text-sm text-text-faint text-center py-12">{emptyLabel}</div>
      </>
    );
  }

  return (
    <>
      {paged && <div ref={topRef} className="scroll-mt-24" />}
      {picker}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-strong bg-surface-sunken">
              {visible.map((c) => (
                <th key={c.key} className={clsx("text-left font-semibold text-text-faint text-[11px] uppercase tracking-wider px-4 py-3", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagination.pageRows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                aria-selected={selectedId !== undefined ? row.id === selectedId : undefined}
                className={clsx(
                  "group relative border-b border-border last:border-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-primary-500/[0.05]",
                  selectedId !== undefined && row.id === selectedId && "bg-primary-500/[0.07]",
                )}
              >
                {visible.map((c, i) => (
                  <td key={c.key} className={clsx("relative px-4 py-3.5 align-middle", c.className)}>
                    {i === 0 && onRowClick && (
                      <span className={clsx(
                        "absolute left-0 top-0 bottom-0 w-[2px] bg-primary-500 group-hover:scale-y-100 transition-transform origin-center",
                        selectedId !== undefined && row.id === selectedId ? "scale-y-100" : "scale-y-0",
                      )} />
                    )}
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden flex flex-col gap-2.5">
        {pagination.pageRows.map((row) => (
          <div
            key={row.id}
            onClick={() => onRowClick?.(row)}
            className={clsx(
              "rounded-lg border bg-surface p-4 flex flex-col gap-2",
              selectedId !== undefined && row.id === selectedId ? "border-primary-500" : "border-border",
              onRowClick && "cursor-pointer active:bg-surface-sunken",
            )}
          >
            {visible
              .filter((c) => !c.hideOnMobile)
              .map((c, i) => (
                <div key={c.key} className={clsx("flex items-center justify-between gap-3", i === 0 && "text-sm font-medium text-text")}>
                  {i !== 0 && <span className="text-xs text-text-faint">{c.header}</span>}
                  <span className={clsx(i !== 0 && "text-sm text-text")}>{c.render(row)}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
      {paged && (
        <Pagination
          className="px-3 pt-3 pb-2"
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={rows.length}
          onPage={(p) => { pagination.setPage(p); toTop(); }}
          onPageSize={(n) => { pagination.setPageSize(n); toTop(); }}
        />
      )}
      {footer}
    </>
  );
}
