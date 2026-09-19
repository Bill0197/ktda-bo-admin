import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";

/* Chart kit — hand-rolled SVG, no charting dependency.
 *
 * Why not a library: these render inside six apps that share one token file,
 * and every library we tried needed a theme adapter to stop hardcoding its own
 * colours. Drawing the marks ourselves keeps light/dark on `tokens.css` alone.
 *
 * Rules baked in here rather than left to each call site, because a chart that
 * breaks them is wrong regardless of who drew it:
 *   - series colours come from `--chart-1..6` in fixed order, never cycled;
 *   - a 9th series is not a generated hue — the caller folds the tail into
 *     "Other" before passing data in;
 *   - grid and axis ink stay recessive, values wear text tokens, and the mark
 *     beside a label carries identity;
 *   - every plotted chart ships a hover read-out, since a rendered chart the
 *     reader cannot interrogate hides the number they came for;
 *   - `ChartFrame` can show the same data as a table, so identity and value are
 *     available without colour perception at all.
 */

export const CHART_SERIES_COUNT = 6;

/** Fixed categorical slot. Colour follows the entity, never its rank, so the
 * caller passes a stable index — filtering a series out must not repaint the
 * survivors. */
export function chartColor(index: number): string {
  return `var(--chart-${(index % CHART_SERIES_COUNT) + 1})`;
}

export type Series = {
  /** Stable identity — also the legend label. */
  label: string;
  values: number[];
  /** Categorical slot. Defaults to the series' position, which is only correct
   * when the caller never filters the list. */
  colorIndex?: number;
};

/* ---------------------------------------------------------------- sizing --- */

/** Charts draw at real pixel size rather than a scaled viewBox: a stretched
 * viewBox distorts stroke widths and text, which is exactly what makes
 * hand-rolled SVG charts look cheap. */
function useWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  /* A callback ref rather than a mount effect: a chart whose data arrives late
     renders `null` first, so the element attaches on a later render. An effect
     with `[]` deps has already run by then and would leave the width at 0 —
     the chart then never draws at all. */
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    observer.current = ro;
    setWidth(el.getBoundingClientRect().width);
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  return [ref, width] as const;
}

/* ------------------------------------------------------------- utilities --- */

function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/* ---------------------------------------------------------------- legend --- */

export function ChartLegend({
  items,
  className,
}: {
  items: { label: string; colorIndex: number; value?: ReactNode }[];
  className?: string;
}) {
  return (
    <ul className={clsx("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5 text-xs text-text-soft">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-[3px] shrink-0"
            style={{ backgroundColor: chartColor(it.colorIndex) }}
          />
          <span>{it.label}</span>
          {it.value != null && <span className="tabular font-medium text-text">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------------------- frame --- */

/** Card chrome for a chart: title, optional action, legend, and a table view.
 *
 * The table is not decoration — it is how the same figures stay readable
 * without colour perception, in print, and to a screen reader, so any chart
 * with more than one series should pass `table`. */
export function ChartFrame({
  title,
  subtitle,
  action,
  legend,
  table,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  legend?: { label: string; colorIndex: number; value?: ReactNode }[];
  table?: { columns: string[]; rows: (ReactNode)[][] };
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section
      className={clsx(
        "rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-sm)] p-5 flex flex-col min-w-0",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {subtitle && <p className="text-xs text-text-faint mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action}
          {table && (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="text-[11px] font-medium text-text-faint hover:text-text transition-colors rounded-md px-1.5 py-0.5"
              aria-pressed={showTable}
            >
              {showTable ? "Chart" : "Table"}
            </button>
          )}
        </div>
      </header>

      {legend && legend.length > 1 && <ChartLegend items={legend} className="mt-2 mb-1" />}

      <div className="mt-3 flex-1 min-w-0 flex flex-col justify-center">
        {showTable && table ? (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-faint">
                  {table.columns.map((c) => (
                    <th key={c} className="font-medium py-1.5 pr-4 whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {table.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className={clsx("py-1.5 pr-4 whitespace-nowrap", j === 0 ? "text-text" : "tabular text-text-soft")}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- tooltip ---- */

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  // Flips to the left of the cursor near the right edge so the read-out never
  // leaves the card.
  const flip = x > width - 150;
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-1.5 shadow-[var(--shadow-md)] text-xs whitespace-nowrap"
      style={{ left: flip ? undefined : x + 12, right: flip ? width - x + 12 : undefined, top: Math.max(0, y - 8) }}
      role="status"
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------- time-series (area) --- */

export function TimeSeriesChart({
  series,
  labels,
  height = 200,
  formatValue = compactNumber,
  yTicks = 4,
  fill = true,
  baselineZero = false,
}: {
  series: Series[];
  /** One label per point — used on the x axis and in the hover read-out. */
  labels: string[];
  height?: number;
  formatValue?: (v: number) => string;
  yTicks?: number;
  fill?: boolean;
  /** Anchor the y axis at zero. Right for volumes; wrong for a NAV price,
   * where the interesting movement is a fraction of the absolute level. */
  baselineZero?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const padL = 44;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = Math.max(0, height - padT - padB);
  const n = labels.length;

  const flat = series.flatMap((s) => s.values).filter(Number.isFinite);
  const rawMin = flat.length ? Math.min(...flat) : 0;
  const rawMax = flat.length ? Math.max(...flat) : 1;
  const pad = (rawMax - rawMin) * 0.12 || Math.abs(rawMax) * 0.05 || 1;
  const min = baselineZero ? Math.min(0, rawMin) : rawMin - pad;
  const max = rawMax + pad;
  const ticks = niceTicks(min, max, yTicks);

  const xAt = (i: number) => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - ((v - min) / (max - min || 1)) * plotH;

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const rel = e.clientX - rect.left - padL;
      const i = Math.round((rel / (plotW || 1)) * (n - 1));
      setHover(Math.max(0, Math.min(n - 1, i)));
    },
    [n, plotW],
  );

  if (!n) return null;

  return (
    <div
      ref={ref}
      className="relative w-full touch-pan-y"
      style={{ height }}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={series.map((s) => s.label).join(", ")}>
          <defs>
            {series.map((s, si) => (
              <linearGradient key={s.label} id={`${gradId}-${si}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor(s.colorIndex ?? si)} stopOpacity="0.22" />
                <stop offset="100%" stopColor={chartColor(s.colorIndex ?? si)} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* grid + y axis: recessive by design, so the marks stay the figure */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={padL + plotW} y1={yAt(t)} y2={yAt(t)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={padL - 8} y={yAt(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--chart-axis)" className="tabular">
                {formatValue(t)}
              </text>
            </g>
          ))}

          {/* x labels: first, middle, last only — a label per point is noise */}
          {[0, Math.floor((n - 1) / 2), n - 1]
            .filter((i, idx, arr) => arr.indexOf(i) === idx && labels[i])
            .map((i) => (
              <text
                key={i}
                x={Math.min(Math.max(xAt(i), padL + 12), padL + plotW - 12)}
                y={height - 6}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                fontSize={10}
                fill="var(--chart-axis)"
              >
                {labels[i]}
              </text>
            ))}

          {series.map((s, si) => {
            const color = chartColor(s.colorIndex ?? si);
            const pts = s.values.map((v, i) => [xAt(i), yAt(v)] as const);
            const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
            const area = `${line} L${padL + plotW},${padT + plotH} L${padL},${padT + plotH} Z`;
            return (
              <g key={s.label}>
                {fill && series.length <= 2 && <path d={area} fill={`url(#${gradId}-${si})`} />}
                <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {/* Last point gets a marker: it is the number people look for. */}
                <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
              </g>
            );
          })}

          {hover != null && (
            <g>
              <line x1={xAt(hover)} x2={xAt(hover)} y1={padT} y2={padT + plotH} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="3 3" />
              {series.map((s, si) => (
                <circle
                  key={s.label}
                  cx={xAt(hover)}
                  cy={yAt(s.values[hover])}
                  r={4.5}
                  fill={chartColor(s.colorIndex ?? si)}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>
      )}

      {hover != null && (
        <Tooltip x={xAt(hover)} y={padT} width={width}>
          <div className="text-text-faint mb-0.5">{labels[hover]}</div>
          {series.map((s, si) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: chartColor(s.colorIndex ?? si) }} />
              <span className="text-text-soft">{s.label}</span>
              <span className="tabular font-medium text-text ml-auto pl-3">{formatValue(s.values[hover])}</span>
            </div>
          ))}
        </Tooltip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- columns ----- */

export function ColumnChart({
  series,
  labels,
  height = 200,
  stacked = false,
  formatValue = compactNumber,
  yTicks = 4,
}: {
  series: Series[];
  labels: string[];
  height?: number;
  /** Stacked answers "what is the total, and of what"; grouped answers
   * "how do these compare". Picking the wrong one hides the question. */
  stacked?: boolean;
  formatValue?: (v: number) => string;
  yTicks?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const padL = 44;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = Math.max(0, height - padT - padB);
  const n = labels.length;

  const totals = labels.map((_, i) =>
    stacked ? series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0) : Math.max(...series.map((s) => s.values[i] ?? 0)),
  );
  const max = Math.max(...totals, 1);
  const ticks = niceTicks(0, max, yTicks);
  const scale = (v: number) => (v / (ticks[ticks.length - 1] || max)) * plotH;

  const slot = n ? plotW / n : 0;
  /* Label density is a function of the space available, not of the number of
     categories: a fixed "every other one" rule still collides in a narrow
     column and wastes a wide one. Roughly 6.2px per character at 10px type. */
  const longestLabel = labels.reduce((m, l) => Math.max(m, l.length), 0);
  const charsThatFit = Math.max(3, Math.floor((slot - 4) / 6.2));
  /* Dropping labels is only acceptable on a dense axis. With a handful of
     categories every bar must keep its name — an unlabelled bar with a value
     in it is worse than a shortened label — so those are clipped, not culled. */
  const denseAxis = n > 6;
  const labelStep = denseAxis ? Math.max(1, Math.ceil((longestLabel * 6.2 + 10) / Math.max(slot, 1))) : 1;
  const labelAt = (label: string) =>
    denseAxis || label.length <= charsThatFit ? label : `${label.slice(0, Math.max(1, charsThatFit - 1))}…`;
  const barGap = 2; // the 2px surface gap that keeps adjacent fills readable
  const groupW = Math.max(4, slot * 0.62);
  const barW = stacked ? groupW : Math.max(3, (groupW - barGap * (series.length - 1)) / series.length);

  if (!n) return null;

  return (
    <div
      ref={ref}
      className="relative w-full"
      style={{ height }}
      onPointerLeave={() => setHover(null)}
    >
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={series.map((s) => s.label).join(", ")}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={padL + plotW} y1={padT + plotH - scale(t)} y2={padT + plotH - scale(t)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={padL - 8} y={padT + plotH - scale(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--chart-axis)" className="tabular">
                {formatValue(t)}
              </text>
            </g>
          ))}

          {labels.map((label, i) => {
            const cx = padL + slot * i + slot / 2;
            let stackTop = padT + plotH;
            return (
              <g key={label}>
                {/* Hit target spans the whole slot — bars are too thin to aim at. */}
                <rect
                  x={padL + slot * i}
                  y={padT}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                />
                {hover === i && (
                  <rect x={padL + slot * i} y={padT} width={slot} height={plotH} fill="var(--surface-sunken)" opacity={0.7} />
                )}
                {series.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  const h = Math.max(v > 0 ? 2 : 0, scale(v));
                  const color = chartColor(s.colorIndex ?? si);
                  if (stacked) {
                    const y = stackTop - h;
                    stackTop = y - barGap;
                    return (
                      <rect key={s.label} x={cx - groupW / 2} y={y} width={groupW} height={h} rx={3} fill={color} />
                    );
                  }
                  const x = cx - groupW / 2 + si * (barW + barGap);
                  return <rect key={s.label} x={x} y={padT + plotH - h} width={barW} height={h} rx={3} fill={color} />;
                })}
                {i % labelStep === 0 && (
                  <text x={cx} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--chart-axis)">
                    {labelAt(label)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}

      {hover != null && (
        <Tooltip x={padL + slot * hover + slot / 2} y={padT} width={width}>
          <div className="text-text-faint mb-0.5">{labels[hover]}</div>
          {series.map((s, si) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: chartColor(s.colorIndex ?? si) }} />
              <span className="text-text-soft">{s.label}</span>
              <span className="tabular font-medium text-text ml-auto pl-3">{formatValue(s.values[hover] ?? 0)}</span>
            </div>
          ))}
        </Tooltip>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- donut ---- */

export function DonutChart({
  segments,
  size = 168,
  thickness = 22,
  centerLabel,
  centerValue,
  formatValue = compactNumber,
}: {
  segments: { label: string; value: number; colorIndex?: number }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: ReactNode;
  formatValue?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  // 2px of surface between segments, expressed as a dash gap.
  const gap = total > 0 && segments.length > 1 ? 2 : 0;

  let offset = 0;
  const arcs = segments.map((seg, i) => {
    const frac = total > 0 ? seg.value / total : 0;
    const len = Math.max(0, frac * circumference - gap);
    const arc = { seg, i, len, offset, color: chartColor(seg.colorIndex ?? i) };
    offset += frac * circumference;
    return arc;
  });

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative shrink-0" style={{ width: size, height: size }} onPointerLeave={() => setHover(null)}>
        <svg width={size} height={size} role="img" aria-label={segments.map((s) => `${s.label} ${formatValue(s.value)}`).join(", ")}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={thickness} />
          {arcs.map(({ seg, i, len, offset: off, color }) => (
            <circle
              key={seg.label}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={hover === i ? thickness + 4 : thickness}
              strokeDasharray={`${len} ${circumference - len}`}
              strokeDashoffset={-off}
              transform={`rotate(-90 ${c} ${c})`}
              onPointerEnter={() => setHover(i)}
              style={{ transition: "stroke-width 120ms ease" }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
          <span className="font-display text-xl font-semibold tabular text-text leading-none">
            {hover != null ? formatValue(segments[hover].value) : centerValue}
          </span>
          <span className="text-[11px] text-text-faint mt-1 leading-tight">
            {hover != null ? segments[hover].label : centerLabel}
          </span>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
        {segments.map((seg, i) => (
          <li
            key={seg.label}
            className={clsx("flex items-center gap-2 text-xs", hover === i ? "text-text" : "text-text-soft")}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: chartColor(seg.colorIndex ?? i) }} />
            <span className="truncate">{seg.label}</span>
            <span className="tabular font-medium text-text ml-auto pl-2">{formatValue(seg.value)}</span>
            {total > 0 && <span className="tabular text-text-faint w-9 text-right">{Math.round((seg.value / total) * 100)}%</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- gauge ---- */

/** Utilisation against a threshold — one number, its ceiling, and how close the
 * two are. A bar would answer the first; the marker is what makes the second
 * readable at a glance. */
export function GaugeArc({
  value,
  label,
  caption,
  tone = "primary",
  markerAt,
  size = 132,
}: {
  /** 0–1. Values above 1 clamp, and the tone is the caller's signal for that. */
  value: number;
  label: ReactNode;
  caption?: ReactNode;
  tone?: "primary" | "warning" | "danger" | "success";
  /** Optional threshold marker, 0–1 — e.g. the point a policy limit sits at. */
  markerAt?: number;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = size / 2;
  // 240° arc — an open bottom reads as a gauge rather than a broken donut.
  const sweep = 240;
  const circumference = 2 * Math.PI * r;
  const arcLen = (sweep / 360) * circumference;
  const color =
    tone === "danger" ? "var(--danger)" : tone === "warning" ? "var(--warning)" : tone === "success" ? "var(--success)" : "var(--chart-1)";

  const markerAngle = markerAt != null ? -210 + Math.max(0, Math.min(1, markerAt)) * sweep : null;

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size * 0.78 }}>
        <svg width={size} height={size} className="absolute inset-0" role="img" aria-label={typeof label === "string" ? label : "gauge"}>
          <g transform={`rotate(-210 ${c} ${c})`}>
            <circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke="var(--surface-sunken)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${arcLen} ${circumference}`}
            />
            <circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${arcLen * clamped} ${circumference}`}
              style={{ transition: "stroke-dasharray 400ms ease" }}
            />
          </g>
          {markerAngle != null && (
            <g transform={`rotate(${markerAngle} ${c} ${c})`}>
              <line x1={c} y1={c - r - stroke / 2 - 2} x2={c} y2={c - r + stroke / 2 + 2} stroke="var(--text-faint)" strokeWidth={2} />
            </g>
          )}
        </svg>
        <div className="absolute inset-x-0 top-[38%] flex flex-col items-center">
          <span className="font-display text-xl font-semibold tabular text-text leading-none">{label}</span>
        </div>
      </div>
      {caption && <div className="text-[11px] text-text-faint text-center leading-snug -mt-1">{caption}</div>}
    </div>
  );
}

/* ------------------------------------------------------------ sparkline ---- */

/** Trend shape only — no axes, no hover. Belongs inside a stat tile, where the
 * number carries the value and this carries the direction. */
export function TrendSpark({
  points,
  colorIndex = 0,
  height = 34,
  tone,
}: {
  points: number[];
  colorIndex?: number;
  height?: number;
  /** Overrides the categorical slot when the shape's meaning is status
   * (a rising break count is not "series 1"). */
  tone?: "success" | "danger" | "warning";
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const gradId = useId();
  if (points.length < 2) return <div style={{ height }} />;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const color = tone ? `var(--${tone})` : chartColor(colorIndex);
  const stepX = width / (points.length - 1);
  const coords = points.map((p, i) => [i * stepX, height - ((p - min) / range) * (height - 6) - 3] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

  return (
    <div ref={ref} className="w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${gradId})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={coords[coords.length - 1][0] - 1.5} cy={coords[coords.length - 1][1]} r={2.5} fill={color} />
        </svg>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- share bar --- */

/** Parts of one whole, on one row. Right where a donut would be wrong — a
 * composition with a 95% slice reads as a ring with a nick in it, while a share
 * bar still shows the small parts and their order. */
export function ShareBar({
  segments,
  formatValue = compactNumber,
  height = 12,
}: {
  segments: { label: string; value: number; colorIndex?: number }[];
  formatValue?: (v: number) => string;
  height?: number;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div>
      <div className="flex w-full overflow-hidden rounded-full gap-[2px]" style={{ height }} onPointerLeave={() => setHover(null)}>
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            className="h-full first:rounded-l-full last:rounded-r-full transition-opacity"
            style={{
              width: `${total > 0 ? Math.max(0.6, (Math.max(0, seg.value) / total) * 100) : 0}%`,
              backgroundColor: chartColor(seg.colorIndex ?? i),
              opacity: hover == null || hover === i ? 1 : 0.45,
            }}
            onPointerEnter={() => setHover(i)}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {segments.map((seg, i) => (
          <li
            key={seg.label}
            className={clsx("flex items-center gap-2 text-xs", hover === i ? "text-text" : "text-text-soft")}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: chartColor(seg.colorIndex ?? i) }} />
            <span className="truncate">{seg.label}</span>
            <span className="tabular font-medium text-text ml-auto pl-2">{formatValue(seg.value)}</span>
            {total > 0 && (
              <span className="tabular text-text-faint w-11 text-right">
                {((Math.max(0, seg.value) / total) * 100).toFixed(seg.value / total < 0.01 ? 2 : 1)}%
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ bullet bar --- */

/** A labelled proportion inside a list — queue mix, risk bands, channel share.
 * Reads left to right like the rows around it, which a donut does not. */
export function BulletBar({
  rows,
  formatValue = compactNumber,
}: {
  rows: { label: string; value: number; colorIndex?: number; tone?: "success" | "warning" | "danger" | "info"; hint?: string }[];
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-xs text-text-soft truncate">{r.label}</span>
            <span className="text-xs tabular font-semibold text-text shrink-0">{formatValue(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-sunken overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.max(r.value > 0 ? 3 : 0, (r.value / max) * 100)}%`,
                backgroundColor: r.tone ? `var(--${r.tone})` : chartColor(r.colorIndex ?? i),
              }}
            />
          </div>
          {r.hint && <div className="text-[11px] text-text-faint mt-1">{r.hint}</div>}
        </li>
      ))}
    </ul>
  );
}
