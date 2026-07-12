const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "2026-06-12T18:04:00Z" → "Jun 12, 2026". */
export function formatShortDate(iso: string): string {
  return SHORT_DATE.format(new Date(iso));
}
