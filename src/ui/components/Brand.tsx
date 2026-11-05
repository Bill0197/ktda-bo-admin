import clsx from "clsx";

/* Placeholder KTDA brand until the real assets arrive: a plain wordmark, no
 * logo artwork. Every colour comes from tokens.css (--brand-*), so swapping in
 * the real brand is a change there plus this file's outlines.
 * public/favicon.svg carries the same placeholder and needs its own swap. */

const INK = "var(--brand-ink)";
const LEAF = "var(--brand-leaf)";

/** The square mark: "K" on the brand fill. `size` is its height. */
export function BrandMark({ size = 36, tone = "auto", className }: { size?: number; tone?: "auto" | "white"; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" height={size} width={size} className={clsx("shrink-0", className)} role="img" aria-label="KTDA">
      <rect width="40" height="40" rx="9" fill={tone === "white" ? "#fff" : LEAF} />
      <text x="20" y="28" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="22" fill={tone === "white" ? LEAF : "#fff"}>K</text>
    </svg>
  );
}

/** The mark with the KTDA wordmark. `size` is the mark's height. */
export function BrandLogo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 120 40" height={size} width={(size * 120) / 40} className={clsx("shrink-0", className)} role="img" aria-label="KTDA">
      <rect width="40" height="40" rx="9" fill={LEAF} />
      <text x="20" y="28" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="22" fill="#fff">K</text>
      <text x="50" y="28" fontFamily="var(--font-display)" fontWeight="700" fontSize="22" letterSpacing="1" fill={INK}>KTDA</text>
    </svg>
  );
}

/** The lockup: mark, KTDA, and BACK OFFICE beneath. */
export function BrandLockup({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 150 40" height={size} width={(size * 150) / 40} className={clsx("shrink-0", className)} role="img" aria-label="KTDA Back Office">
      <rect width="40" height="40" rx="9" fill={LEAF} />
      <text x="20" y="28" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="22" fill="#fff">K</text>
      <text x="50" y="21" fontFamily="var(--font-display)" fontWeight="700" fontSize="19" letterSpacing="1" fill={INK}>KTDA</text>
      <text x="50" y="35" fontFamily="var(--font-sans)" fontWeight="500" fontSize="9" letterSpacing="2" fill={LEAF}>BACK OFFICE</text>
    </svg>
  );
}
