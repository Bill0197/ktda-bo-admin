import clsx from "clsx";

export type TabDef = { key: string; label: string; count?: number };

/** Segmented tab strip — page-level view switching (pending/history,
 * users/permissions). Not routing: the active tab is caller state. */
export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  /* The strip scrolls inside its own row rather than widening the page: with
     enough tabs (Reports has ten) an `inline-flex` strip pushed the whole
     document into a horizontal scroll and clipped the last tab. */
  return (
    <div className={clsx("max-w-full overflow-x-auto -mx-1 px-1", className)}>
      <div role="tablist" className="inline-flex items-center gap-1 rounded-lg bg-surface-sunken p-1 border border-border">
      {tabs.map((t) => {
        const selected = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.key)}
            className={clsx(
              "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md text-[13px] font-medium whitespace-nowrap transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
              selected ? "bg-surface text-text shadow-sm" : "text-text-soft hover:text-text",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={clsx(
                  "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold tabular",
                  selected ? "bg-primary-50 text-primary-700" : "bg-border text-text-soft",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
      </div>
    </div>
  );
}
