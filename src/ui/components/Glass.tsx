import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import { InfoTip } from "./InfoTip";

/** Glass surface kit for the internal apps.
 *
 * Borrows the investor app's visual language — layered translucency, a lit
 * top edge, depth from stacking rather than from borders — but built entirely
 * on this app's own tokens (tokens.css) — the investor palette isn't part of
 * this app at all.
 *
 * Used for summary and hero regions. Dense tables stay on plain `Card`:
 * translucency behind a long scrolling grid buys nothing and costs frames. */

/** The elevated panel: glass ground, inner sheen, hairline top rim. */
export function GlassPanel({
  className,
  sheen = true,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { sheen?: boolean }) {
  return (
    <div
      className={clsx(
        "glass-panel rounded-[var(--radius-lg)] overflow-hidden",
        sheen && "glass-sheen glass-rim",
        className,
      )}
      {...props}
    >
      {/* Content sits above the ::before sheen without needing a wrapper
          stacking context on every child. */}
      <div className="relative">{children}</div>
    </div>
  );
}

export type StatTone = "neutral" | "primary" | "success" | "warning" | "danger" | "accent";

const TONE_CHIP: Record<StatTone, string> = {
  neutral: "bg-surface-sunken text-text-soft ring-1 ring-border",
  primary: "bg-primary-50 text-primary-600 ring-1 ring-primary-500/20",
  success: "bg-success-bg text-success ring-1 ring-success/20",
  warning: "bg-warning-bg text-warning ring-1 ring-warning/20",
  danger: "bg-danger-bg text-danger ring-1 ring-danger/20",
  accent: "bg-accent-300/25 text-accent-700 ring-1 ring-accent-500/20",
};

const TONE_VALUE: Record<StatTone, string> = {
  neutral: "text-text",
  primary: "text-text",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  accent: "text-accent-700",
};

/** A KPI tile on glass.
 *
 * `tone` colours the icon chip and, for the three status tones, the figure
 * itself — a count of breaches should read as a breach without needing the
 * label. `emphasis={false}` keeps the number neutral where the tone is only
 * categorical. */
export function GlassStat({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  emphasis = true,
  tooltip,
  footer,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  emphasis?: boolean;
  tooltip?: string;
  footer?: ReactNode;
  className?: string;
}) {
  const coloured = emphasis && (tone === "success" || tone === "warning" || tone === "danger");
  return (
    <GlassPanel className={clsx("p-5 lift", className)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-faint">
          {label}
          {tooltip && <InfoTip text={tooltip} />}
        </span>
        {icon && (
          <span className={clsx("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", TONE_CHIP[tone])}>
            {icon}
          </span>
        )}
      </div>
      <div className={clsx("text-[26px] leading-none font-display font-semibold tabular", coloured ? TONE_VALUE[tone] : "text-text")}>
        {value}
      </div>
      {hint && <div className="mt-2 text-xs text-text-faint leading-snug">{hint}</div>}
      {footer && <div className="mt-3 pt-3 border-t border-border">{footer}</div>}
    </GlassPanel>
  );
}

/** Responsive tile row. Defaults to four across, which is what every summary
 * strip in this app actually wants. */
export function StatRail({
  columns = 4,
  className,
  children,
}: {
  columns?: 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "grid gap-4",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Section heading + one line of context. The pair appears above almost every
 * table in this app and was being hand-rolled with slightly different spacing
 * each time. */
export function SectionTitle({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-wrap items-end justify-between gap-3 mb-3", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {description && <p className="text-[13px] text-text-soft mt-1 max-w-3xl leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

/** An explanatory panel: the "why this screen works the way it does" note that
 * sits above several of these tables. Glass with a tone rail down the left, so
 * it reads as guidance rather than as a warning banner. */
export function NotePanel({
  tone = "neutral",
  icon,
  title,
  children,
  className,
}: {
  tone?: "neutral" | "info" | "warning" | "danger" | "success";
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const rail = {
    neutral: "before:bg-border-strong",
    info: "before:bg-info",
    warning: "before:bg-warning",
    danger: "before:bg-danger",
    success: "before:bg-success",
  }[tone];

  return (
    <div
      className={clsx(
        "relative glass-panel rounded-[var(--radius-lg)] p-4 pl-5 overflow-hidden",
        "before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1",
        rail,
        className,
      )}
    >
      <div className="flex gap-2.5">
        {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
        <div className="min-w-0 text-[13px] text-text-soft leading-relaxed">
          {title && <div className="text-text font-semibold mb-1">{title}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}

/** Horizontal proportion bar — the "book by segment" / distribution readout
 * that three of these pages need. Rows carry their own tone so a warning slice
 * (unsegmented, unattributed) is visible without a legend. */
export function DistributionBars({
  rows,
  className,
}: {
  rows: { label: string; value: number; tone?: "primary" | "warning" | "success" | "danger" | "accent" }[];
  className?: string;
}) {
  // Guard the empty and all-zero cases: dividing by a zero total would render
  // every bar as NaN% and collapse the component silently.
  const total = rows.reduce((s, r) => s + r.value, 0);
  const fill = {
    primary: "bg-primary-500",
    warning: "bg-warning",
    success: "bg-success",
    danger: "bg-danger",
    accent: "bg-accent-500",
  };

  if (!rows.length) return <p className="text-[13px] text-text-faint">Nothing to show yet.</p>;

  return (
    <div className={clsx("flex flex-col gap-2.5", className)}>
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-xs mb-1.5">
            <span className={r.tone === "warning" ? "text-warning" : "text-text-soft"}>{r.label}</span>
            <span className="tabular text-text font-medium">{r.value}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-sunken overflow-hidden">
            <div
              className={clsx("h-full rounded-full transition-[width] duration-500", fill[r.tone ?? "primary"])}
              style={{ width: total > 0 ? `${(r.value / total) * 100}%` : "0%" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
