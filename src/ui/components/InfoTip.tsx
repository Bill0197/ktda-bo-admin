import { useState } from "react";
import { Info } from "lucide-react";

/** Small "(i)" affordance for explaining jargon inline — hover or tap to
 * reveal a plain-English one-liner. Used next to stat labels and page
 * titles that use terms not everyone in the room will know (NAV, AUM,
 * KYC, gate, etc.) so a live demo doesn't need a side explanation. */
export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        aria-label={text}
        className="text-text-faint hover:text-primary-600 transition-colors outline-none focus-visible:text-primary-600"
      >
        <Info size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 rounded-md bg-text text-white text-[11px] leading-relaxed px-2.5 py-2 shadow-lg pointer-events-none normal-case font-normal tracking-normal"
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-text" />
        </span>
      )}
    </span>
  );
}
