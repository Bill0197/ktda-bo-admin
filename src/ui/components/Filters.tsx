import type { ReactNode } from "react";
import clsx from "clsx";
import { Search, X } from "lucide-react";
import { Dropdown } from "./Dropdown";

/** Compact filter controls for list/table pages. Deliberately h-9 (vs the
 * h-11 form fields) so a filter row reads as chrome, not a form. Styles are
 * self-contained — not composed from Form.tsx's fieldBase — because two
 * same-property Tailwind classes resolve by stylesheet order, not intent. */

const controlBase =
  "h-9 rounded-md border border-border bg-surface text-[13px] text-text placeholder:text-text-faint outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20";

/** Wrap page filters in one responsive row; children wrap on small screens. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("flex flex-wrap items-center gap-2.5 mb-4", className)}>{children}</div>;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={clsx("relative", className ?? "w-56")}>
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={clsx(controlBase, "w-full pl-8 pr-7")}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 inline-flex items-center justify-center rounded text-text-faint hover:text-text"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

export function SelectFilter({
  value,
  onChange,
  options,
  allLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Option list; an "all" sentinel is prepended automatically via allLabel. */
  options: { value: string; label: string }[];
  /** Label for the match-everything option, e.g. "All statuses". */
  allLabel: string;
  className?: string;
}) {
  return (
    <Dropdown
      size="sm"
      value={value}
      onChange={onChange}
      options={[{ value: "all", label: allLabel }, ...options]}
      ariaLabel={allLabel}
      className={className ?? "w-auto min-w-[130px]"}
    />
  );
}

/** From/to date pair. Values are yyyy-mm-dd strings ("" = unbounded). */
export function DateRangeFilter({
  from,
  to,
  onChange,
  className,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center gap-1.5", className)}>
      <input
        type="date"
        value={from}
        max={to || undefined}
        onChange={(e) => onChange({ from: e.target.value, to })}
        aria-label="From date"
        className={clsx(controlBase, "px-2.5 tabular")}
      />
      <span className="text-xs text-text-faint">–</span>
      <input
        type="date"
        value={to}
        min={from || undefined}
        onChange={(e) => onChange({ from, to: e.target.value })}
        aria-label="To date"
        className={clsx(controlBase, "px-2.5 tabular")}
      />
      {(from || to) && (
        <button
          type="button"
          onClick={() => onChange({ from: "", to: "" })}
          className="text-xs text-text-faint hover:text-text underline-offset-2 hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}

/** ISO-timestamp vs yyyy-mm-dd range check, inclusive on both ends. */
export function inDateRange(iso: string, from: string, to: string): boolean {
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}
