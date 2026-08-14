export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MS_PER_HOUR = 60 * 60 * 1000;

// JS Date.getUTCDay(): 0=Sunday ... 6=Saturday
export const UTC_DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

// Monday (00:00 UTC) of the UTC week containing `nowMs`.
export function weekMondayUtc(nowMs: number): number {
  const d = new Date(nowMs);
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday);
}

// Deterministic weekly tab label: "Week of 2026-08-10" (the Monday of the week, UTC).
export function formatWeekLabel(mondayMs: number): string {
  const d = new Date(mondayMs);
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `Week of ${d.getUTCFullYear()}-${month}-${day}`;
}

// Google Sheets tab names: unique, max 100 chars, must not contain these.
export const TAB_NAME_MAX_LENGTH = 100;
const FORBIDDEN_TAB_CHARS = /[:\\/?*[\]]/g;

// Optional admin tab prefix keeps determinism: "<prefix> - Week of 2026-08-10".
// The prefix is sanitized (forbidden chars stripped, leading/trailing quotes
// removed) and clamped so the full tab name never exceeds 100 characters.
export function formatTabName(prefix: string | null | undefined, mondayMs: number): string {
  const label = formatWeekLabel(mondayMs);
  const cleaned = (prefix ?? '').replace(FORBIDDEN_TAB_CHARS, '').replace(/^'+|'+$/g, '').trim();
  if (!cleaned) return label;
  const maxPrefix = Math.max(0, TAB_NAME_MAX_LENGTH - label.length - ' - '.length);
  const clipped = Array.from(cleaned).slice(0, maxPrefix).join('');
  return `${clipped} - ${label}`;
}

// Map a getUTCDay() value (0=Sun..6=Sat) to a week-grid index (0=Mon..6=Sun).
export function dayIndexWithinWeek(utcDay: number): number {
  return (utcDay + 6) % 7;
}

// Inverse of dayIndexWithinWeek.
export function utcDayForGridIndex(gridIndex: number): number {
  return (gridIndex + 1) % 7;
}

export function utcDayName(utcDay: number): string {
  return UTC_DAY_NAMES[utcDay] ?? 'Unknown';
}

export const dayNameFromUtc = utcDayName;

export function formatHhMm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

// Parse "HH:MM" to milliseconds-of-day (UTC semantics).
export function hhMmToMs(time: string): number {
  const [hours, minutes] = time.split(':').map((v) => parseInt(v, 10));
  return (hours ?? 0) * MS_PER_HOUR + (minutes ?? 0) * 60 * 1000;
}

export interface UtcInstantLabels {
  utc: string;
  ist: string;
}

// Human-readable instant in UTC and IST (UTC+5:30) for logs/audits.
export function describeUtcInstant(nowMs: number): UtcInstantLabels {
  const utc = new Date(nowMs);
  const ist = new Date(nowMs + 5.5 * MS_PER_HOUR);
  const fmt = (d: Date) => d.toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d{3}/, '');
  return { utc: fmt(utc), ist: fmt(ist) };
}
