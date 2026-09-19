import clsx from "clsx";

/** A soft blurred glow orb — sits behind hero/auth content as an ambient
 * accent, never behind data-dense screens (tables don't get glows). */
export function Glow({ className, tone = "primary" }: { className?: string; tone?: "primary" | "accent" }) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "pointer-events-none absolute rounded-full blur-[90px] animate-glow-pulse",
        tone === "primary" ? "bg-[radial-gradient(circle,var(--glow-primary),transparent_65%)]" : "bg-[radial-gradient(circle,var(--glow-accent),transparent_65%)]",
        className,
      )}
    />
  );
}

/** Soft ambient backdrop for marketing/hero panels only (auth screens,
 * Welcome): a spotlight wash plus two large offset glows. No grid — the
 * light SaaS reference set this app follows uses smooth gradient washes,
 * not the grid-line texture. Drop it as the first child of a `relative`
 * container and layer content with `z-10`. */
export function AmbientBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-spotlight" aria-hidden="true" />
      <Glow tone="primary" className="w-[560px] h-[560px] -top-56 -left-56" />
      <Glow tone="accent" className="w-[460px] h-[460px] top-1/4 -right-56 opacity-80" />
    </>
  );
}
