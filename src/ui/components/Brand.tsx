import clsx from "clsx";
import { LOCKUP_W, LOCKUP_WORD_PATH, LOGO_BOX, MARK_PATH, TAGLINE_PATH, WORD_PATH } from "./logoPaths";

/* The Investcent logo, per the IIB brand guidelines and letterhead. This app
 * is light: IC Slate Blue mark with an IC Blue wordmark (the guidelines' logo
 * on white). `tone="white"` is for a brand fill. Same outlines as
 * investor-web's Brand.tsx. */

const SLATE = "#003A5D";
const BLUE = "#00A7E1";

/** The mark alone: two linked loops and a rising arrow. `size` is its height. */
export function InvestcentMark({ size = 36, tone = "auto", className }: { size?: number; tone?: "auto" | "white"; className?: string }) {
  return (
    <svg viewBox={`0 0 ${LOGO_BOX.markW} ${LOGO_BOX.h}`} height={size} width={(size * LOGO_BOX.markW) / LOGO_BOX.h} className={clsx("shrink-0", className)} role="img" aria-label="Investcent">
      <path fill={tone === "white" ? "#fff" : SLATE} d={MARK_PATH} />
    </svg>
  );
}

/** The mark with the INVESTCENT wordmark. `size` is the mark's height. */
export function InvestcentLogo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox={`0 0 ${LOGO_BOX.fullW} ${LOGO_BOX.h}`} height={size} width={(size * LOGO_BOX.fullW) / LOGO_BOX.h} className={clsx("shrink-0", className)} role="img" aria-label="Investcent">
      <path fill={SLATE} d={MARK_PATH} />
      <path fill={BLUE} d={WORD_PATH} />
    </svg>
  );
}

/** The letterhead lockup: mark, INVESTCENT, and INVESTMENT BANK beneath. */
export function InvestcentLockup({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox={`0 0 ${LOCKUP_W} ${LOGO_BOX.h}`} height={size} width={(size * LOCKUP_W) / LOGO_BOX.h} className={clsx("shrink-0", className)} role="img" aria-label="Investcent Investment Bank">
      <path fill={SLATE} d={MARK_PATH} />
      <path fill={BLUE} d={LOCKUP_WORD_PATH} />
      <path fill={SLATE} d={TAGLINE_PATH} />
    </svg>
  );
}
