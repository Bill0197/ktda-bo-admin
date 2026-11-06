import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserRound } from "lucide-react";
import clsx from "clsx";
import { NAV_DEFS } from "../lib/navConfig";

/* The top bar's search: pages by name, and a grower number straight to the
   farmer. Ctrl+K (Cmd+K on a Mac) or "/" focuses it from anywhere. */

type Result = { key: string; label: string; hint: string; to: string; farmer?: boolean };

/** A grower number: one token with at least three digits ("GN-104233", "104233"). */
const looksLikeGrowerNo = (q: string) => /^[A-Za-z0-9/-]+$/.test(q) && (q.match(/\d/g)?.length ?? 0) >= 3;

/** Where a grower number goes: this institution's Farmers list, searched for it. */
const farmerSearchPath = (growerNo: string) => `/farmers?q=${encodeURIComponent(growerNo)}`;

const isMac = typeof navigator !== "undefined" && /Mac|iP(hone|ad)/.test(navigator.platform);

export function GlobalSearch() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  // The close that follows a blur waits a moment (so a click on a result lands
  // first). Any focus or typing cancels it, or it would hide the new results.
  const closing = useRef<number | null>(null);
  const cancelClose = () => {
    if (closing.current !== null) window.clearTimeout(closing.current);
    closing.current = null;
  };
  useEffect(() => cancelClose, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const term = q.trim();
  const results = useMemo<Result[]>(() => {
    if (!term) return [];
    const t = term.toLowerCase();
    const pages: Result[] = NAV_DEFS
      .filter((n) => n.label.toLowerCase().includes(t) || (n.section ?? "").toLowerCase().includes(t))
      .slice(0, 8)
      .map((n) => ({ key: n.to, label: n.label, hint: n.section ?? "Page", to: n.to }));
    const farmer: Result[] = looksLikeGrowerNo(term)
      ? [{ key: "farmer", label: `Farmer ${term}`, hint: "Grower number", to: farmerSearchPath(term), farmer: true }]
      : [];
    return [...farmer, ...pages];
  }, [term]);

  const go = (r: Result | undefined) => {
    if (!r) return;
    navigate(r.to);
    setQ("");
    setOpen(false);
    input.current?.blur();
  };

  const showList = open && term.length > 0;
  return (
    <div className="relative">
      <Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none" />
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-label="Search farmers, runs, pages"
        aria-expanded={showList}
        aria-controls="global-search-results"
        aria-autocomplete="list"
        placeholder="Search farmers, runs, pages"
        value={q}
        onChange={(e) => { cancelClose(); setQ(e.target.value); setCursor(0); setOpen(true); }}
        onFocus={() => { cancelClose(); setOpen(true); }}
        onBlur={() => { cancelClose(); closing.current = window.setTimeout(() => setOpen(false), 120); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); go(results[cursor]); }
          else if (e.key === "Escape") { setQ(""); input.current?.blur(); }
        }}
        className="w-full h-9 pl-9 pr-14 rounded-lg border border-border bg-surface-sunken text-sm text-text placeholder:text-text-faint outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="hidden sm:block absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border px-1.5 text-[10.5px] font-medium text-text-faint pointer-events-none">
        {isMac ? "⌘K" : "Ctrl K"}
      </kbd>
      {showList && (
        <ul
          id="global-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-surface shadow-lg p-1.5"
        >
          {results.length === 0 && <li className="px-2.5 py-2 text-sm text-text-faint">No page or farmer matches "{term}".</li>}
          {results.map((r, i) => (
            <li
              key={r.key}
              role="option"
              aria-selected={i === cursor}
              onMouseDown={(e) => { e.preventDefault(); go(r); }}
              onMouseEnter={() => setCursor(i)}
              className={clsx(
                "flex items-center gap-2.5 px-2.5 h-9 rounded-md text-sm cursor-pointer",
                i === cursor ? "bg-primary-50 text-primary-700" : "text-text",
              )}
            >
              {r.farmer && <UserRound size={15} aria-hidden="true" className="shrink-0 text-text-faint" />}
              <span className="truncate font-medium">{r.label}</span>
              <span className="ml-auto shrink-0 text-xs text-text-faint">{r.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
