import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

const TIP_WIDTH = 224;
const GAP = 8;
const EDGE = 8;

/** Small "(i)" affordance for explaining jargon inline — hover or tap to
 * reveal a plain-English one-liner. Used next to stat labels and page
 * titles that use terms not everyone in the room will know (NAV, AUM,
 * KYC, gate, etc.) so a live demo doesn't need a side explanation.
 *
 * The tooltip is portalled and fixed-positioned: inside a table's scroll
 * container an absolutely positioned one gets clipped. It opens above the
 * icon, or below when there isn't room. */
export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; arrow: number; below: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      const b = button.current?.getBoundingClientRect();
      const h = tip.current?.offsetHeight ?? 0;
      if (!b) return;
      const center = b.left + b.width / 2;
      const left = Math.min(Math.max(center - TIP_WIDTH / 2, EDGE), window.innerWidth - TIP_WIDTH - EDGE);
      const below = b.top - GAP - h < EDGE;
      setPos({ left, top: below ? b.bottom + GAP : b.top - GAP - h, arrow: center - left, below });
    };
    place();
    // Close rather than chase the icon when the page or a table scrolls.
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, text]);

  return (
    <span className="relative inline-flex">
      <button
        ref={button}
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-label={text}
        className="text-text-faint hover:text-primary-600 transition-colors outline-none focus-visible:text-primary-600"
      >
        <Info size={13} />
      </button>
      {open && createPortal(
        <span
          ref={tip}
          role="tooltip"
          style={{ width: TIP_WIDTH, left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}
          className="fixed z-[1000] rounded-md bg-text text-white text-[11px] leading-relaxed px-2.5 py-2 shadow-lg pointer-events-none normal-case font-normal tracking-normal text-left"
        >
          {text}
          <span
            style={{ left: pos?.arrow ?? TIP_WIDTH / 2 }}
            className={`absolute -translate-x-1/2 border-4 border-transparent ${pos?.below ? "bottom-full border-b-text" : "top-full border-t-text"}`}
          />
        </span>,
        document.body,
      )}
    </span>
  );
}
