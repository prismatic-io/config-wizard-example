import type { DeliverySelection } from "./forms";

/** Severity levels ordered low → high; the index is the threshold rank used by `minLevel`. */
export const SEVERITY_ORDER = ["Info", "Warning", "Error", "Critical"] as const;
export type Severity = (typeof SEVERITY_ORDER)[number];

/** An incoming event the integration decides whether to forward. */
export interface NotificationEvent {
  /** One of SEVERITY_ORDER; unknown/missing is treated as the lowest level. */
  level?: string;
  /** Event time; defaults to now when omitted. Used for the quiet-hours check. */
  timestamp?: string | number | Date;
}

const rank = (level: string | undefined): number => {
  const i = SEVERITY_ORDER.indexOf((level ?? "Info") as Severity);
  return i < 0 ? 0 : i;
};

/** Parse an `HH:MM` string into minutes-since-midnight, or null if malformed. */
const toMinutes = (hhmm: string | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

/** True when `date`'s wall-clock time falls inside the [start,end] window (wraps past midnight). */
const inQuietHours = (date: Date, start?: string, end?: string): boolean => {
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin === null || endMin === null) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  // Normal window (e.g. 09:00–17:00) vs. overnight window (e.g. 22:00–07:00).
  return startMin <= endMin
    ? now >= startMin && now < endMin
    : now >= startMin || now < endMin;
};

/**
 * Returns true when an event should be delivered for a category given its saved delivery rules:
 * the event must clear the category's `minLevel` threshold AND fall outside its quiet-hours window.
 * Empty/omitted rules are permissive, so a category with no `minLevel` or quiet hours always delivers.
 */
export function evaluateDeliveryRules(
  selection: DeliverySelection,
  event: NotificationEvent,
): boolean {
  if (rank(event.level) < rank(selection.minLevel)) return false;
  if (selection.quietHoursStart && selection.quietHoursEnd) {
    const when = event.timestamp ? new Date(event.timestamp) : new Date();
    if (inQuietHours(when, selection.quietHoursStart, selection.quietHoursEnd)) {
      return false;
    }
  }
  return true;
}
