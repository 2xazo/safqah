export const SAR_SUFFIX = "ر.س";
export const EMPTY_VALUE = "—";

const LOCALE = "ar-SA";
const TIME_ZONE = "Asia/Riyadh";

const moneyFormatter = new Intl.NumberFormat(LOCALE, {
  numberingSystem: "latn",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat(LOCALE, {
  numberingSystem: "latn",
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat(LOCALE, {
  numberingSystem: "latn",
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  numberingSystem: "latn",
  calendar: "gregory",
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  numberingSystem: "latn",
  calendar: "gregory",
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  numberingSystem: "latn",
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

export type NumericInput = number | string | null | undefined;
export type DateInput = Date | string | number | null | undefined;

export function toNumber(value: NumericInput): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatMoney(value: NumericInput): string {
  const amount = toNumber(value);
  if (amount === null) return EMPTY_VALUE;
  return `${moneyFormatter.format(amount)} ${SAR_SUFFIX}`;
}

export function formatNumber(value: NumericInput): string {
  const amount = toNumber(value);
  if (amount === null) return EMPTY_VALUE;
  return integerFormatter.format(amount);
}

export function formatDecimal(value: NumericInput): string {
  const amount = toNumber(value);
  if (amount === null) return EMPTY_VALUE;
  return decimalFormatter.format(amount);
}

export function formatPercent(value: NumericInput): string {
  const amount = toNumber(value);
  if (amount === null) return EMPTY_VALUE;
  return `${decimalFormatter.format(amount)}%`;
}

export function formatQuantity(value: NumericInput, unitLabel?: string | null): string {
  const amount = toNumber(value);
  if (amount === null) return EMPTY_VALUE;
  const formatted = integerFormatter.format(amount);
  return unitLabel ? `${formatted} ${unitLabel}` : formatted;
}

/** Wrap IDs/emails/numbers so RTL punctuation does not reverse them. */
export function ltrIsolate(value: string | null | undefined): string {
  if (!value) return EMPTY_VALUE;
  return `\u2066${value}\u2069`;
}

export function formatDate(value: DateInput, withTime = false): string {
  if (withTime) return formatDateTime(value);
  const date = toDate(value);
  return date ? dateFormatter.format(date) : EMPTY_VALUE;
}

export function formatShortDate(value: DateInput): string {
  const date = toDate(value);
  return date ? shortDateFormatter.format(date) : EMPTY_VALUE;
}

export function formatTime(value: DateInput): string {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : EMPTY_VALUE;
}

export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return EMPTY_VALUE;
  return `${dateFormatter.format(date)}، ${timeFormatter.format(date)}`;
}

export function formatRating(value: NumericInput): string {
  const amount = toNumber(value);
  if (amount === null) return EMPTY_VALUE;
  return `${decimalFormatter.format(amount)} من 5`;
}

export function formatDurationDays(value: NumericInput): string {
  const amount = toNumber(value);
  if (amount === null) return EMPTY_VALUE;
  if (amount === 1) return "يوم واحد";
  if (amount === 2) return "يومان";
  if (amount <= 10) return `${integerFormatter.format(amount)} أيام`;
  return `${integerFormatter.format(amount)} يومًا`;
}

export function formatMonths(value: NumericInput): string {
  const amount = toNumber(value);
  if (amount === null) return EMPTY_VALUE;
  if (amount === 1) return "شهر واحد";
  if (amount === 2) return "شهران";
  if (amount <= 10) return `${integerFormatter.format(amount)} أشهر`;
  return `${integerFormatter.format(amount)} شهرًا`;
}
