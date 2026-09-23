import clsx from "clsx";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { shortId } from "../../lib/tokenConsole/format";

export interface PickerOption {
  id: string;
  label: string;
  meta?: string;
  /** Set to keep an option visible but unselectable, with the reason shown. */
  disabledReason?: string;
}

/**
 * Searchable entity selector (ported from tokenization-web).
 *
 * Adds the two things a plain <select> cannot do at scale: search (a native
 * select of several hundred investors is unnavigable), and showing an
 * ineligible option greyed WITH its reason rather than omitting it — an
 * operator who cannot find the record they want otherwise assumes the
 * console is broken.
 */
export function EntityPicker({
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled,
  loading,
  id,
  emptyLabel = "No matches",
}: {
  options: PickerOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  id?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  // Closing always clears the filter, so reopening never shows a stale search.
  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // Match the id too: an operator holding a UUID from a log can paste it.
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.meta?.toLowerCase().includes(q) || o.id.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    // Capture phase, and stop there: Escape closes the open list, not the
    // dialog the picker sits in.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled || loading}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(
          "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3.5 text-left text-sm",
          "outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20",
          (disabled || loading) && "opacity-50",
        )}
      >
        <span className={clsx("truncate", selected ? "text-text" : "text-text-faint")}>
          {loading ? "Loading…" : (selected?.label ?? placeholder)}
        </span>
        <ChevronDown size={15} className="shrink-0 text-text-faint" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1.5 max-h-72 w-full overflow-hidden rounded-md border border-border bg-surface-raised shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search size={14} className="shrink-0 text-text-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or id…"
              className="w-full bg-transparent text-[13px] text-text placeholder:text-text-faint focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {value !== null && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    close();
                  }}
                  className="w-full px-3 py-2 text-left text-[13px] text-text-faint hover:bg-surface-sunken"
                >
                  Clear selection
                </button>
              </li>
            )}
            {filtered.length === 0 && <li className="px-3 py-4 text-center text-[13px] text-text-faint">{emptyLabel}</li>}
            {filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  disabled={!!o.disabledReason}
                  title={o.disabledReason}
                  onClick={() => {
                    onChange(o.id);
                    close();
                  }}
                  className={clsx(
                    "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
                    o.disabledReason ? "cursor-not-allowed opacity-45" : "hover:bg-surface-sunken",
                  )}
                >
                  <Check size={14} className={clsx("shrink-0", o.id === value ? "text-primary-600" : "opacity-0")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-text">{o.label}</span>
                    <span className="tabular block truncate text-[11.5px] text-text-soft">
                      {o.meta ?? shortId(o.id)}
                      {o.disabledReason && ` · ${o.disabledReason}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
