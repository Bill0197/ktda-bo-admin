export function formatMoney(amount: number, currency: "KES" | "USD" = "KES", opts?: { compact?: boolean }) {
  const formatter = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: opts?.compact ? 0 : 2,
    maximumFractionDigits: opts?.compact ? 1 : 2,
    notation: opts?.compact ? "compact" : "standard",
  });
  return formatter.format(amount);
}

export function Money({
  amount,
  currency = "KES",
  compact,
  className,
  signed,
}: {
  amount: number;
  currency?: "KES" | "USD";
  compact?: boolean;
  className?: string;
  signed?: boolean;
}) {
  const formatted = formatMoney(Math.abs(amount), currency, { compact });
  const sign = signed ? (amount > 0 ? "+" : amount < 0 ? "−" : "") : "";
  return (
    <span className={`tabular ${className ?? ""}`}>
      {sign}
      {formatted}
    </span>
  );
}

export function formatUnits(units: number) {
  return new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(units);
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-KE", opts ?? { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-KE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
