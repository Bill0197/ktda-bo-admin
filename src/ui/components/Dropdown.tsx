import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";

export type DropdownOption = { value: string; label: string; description?: string };

/** Custom-built select replacement — a button + popover listbox styled to the
 * design tokens, instead of the browser-native <select> chrome. Supports
 * click-outside, Escape, Arrow/Home/End + Enter keyboard navigation. */
export function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  size = "md",
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  /** sm = compact filter chrome (h-9); md = form field (h-11). */
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlight(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  useEffect(() => {
    if (open && highlight >= 0) {
      listRef.current?.children[highlight]?.scrollIntoView({ block: "nearest" });
    }
  }, [open, highlight]);

  const commit = (idx: number) => {
    const opt = options[idx];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlight((h) => Math.min(options.length - 1, h + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
        break;
      case "Home":
        e.preventDefault();
        setHighlight(0);
        break;
      case "End":
        e.preventDefault();
        setHighlight(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(highlight);
        break;
    }
  };

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        className={clsx(
          "w-full inline-flex items-center justify-between gap-2 rounded-md border border-border bg-surface text-left transition-colors outline-none",
          "focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20",
          "disabled:opacity-50 disabled:bg-surface-sunken disabled:pointer-events-none",
          open && "border-primary-500 ring-2 ring-primary-500/20",
          size === "sm" ? "h-9 px-2.5 text-[13px]" : "h-11 px-3.5 text-sm",
        )}
      >
        <span className={clsx("truncate", selected ? "text-text" : "text-text-faint")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={size === "sm" ? 14 : 16} className={clsx("shrink-0 text-text-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-30 mt-1.5 w-full min-w-[160px] max-h-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-md p-1 animate-fade-in"
        >
          {options.map((o, idx) => {
            const isSelected = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => commit(idx)}
                  onMouseEnter={() => setHighlight(idx)}
                  className={clsx(
                    "w-full flex items-start gap-2 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors",
                    idx === highlight ? "bg-surface-sunken text-text" : "text-text-soft",
                  )}
                >
                  <span className="flex-1 min-w-0">
                    <span className={clsx("block truncate", isSelected && "font-medium text-text")}>{o.label}</span>
                    {o.description && <span className="block text-[11px] text-text-faint truncate">{o.description}</span>}
                  </span>
                  {isSelected && <Check size={14} className="shrink-0 mt-0.5 text-primary-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
