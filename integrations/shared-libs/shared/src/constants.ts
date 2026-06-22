import type { DeliveryFieldSpec, DeliveryOption } from "./types";

/** {label,value} options where the display string IS the stored value. */
const displayOptions = (labels: string[]): DeliveryOption[] =>
  labels.map((label) => ({ label, value: label }));

/** How a category's alerts are delivered. */
export const DELIVERY_MODES: DeliveryOption[] = displayOptions(["Real-time", "Digest"]);

/** Severity levels, ordered low → high (also the threshold scale for `minLevel`). */
export const SEVERITY_LEVELS: DeliveryOption[] = displayOptions([
  "Info",
  "Warning",
  "Error",
  "Critical",
]);

/**
 * The standard per-category delivery fields shared by every notification category. A category lib can
 * append its own fields, but most reuse this set verbatim. `channels` is injected separately by
 * `buildConfigForm` from the platform `ChannelAdapter`, so it is not listed here.
 *
 * - `mode` — real-time vs batched digest.
 * - `minLevel` — drop anything below this severity (see `evaluateDeliveryRules`).
 * - `quietHoursStart` / `quietHoursEnd` — free-text `HH:MM` window during which alerts are suppressed.
 */
export const DELIVERY_FIELDS: DeliveryFieldSpec[] = [
  { key: "mode", label: "Delivery mode", multi: false, required: true, default: "Real-time", options: DELIVERY_MODES },
  { key: "minLevel", label: "Minimum level", multi: false, default: "Info", options: SEVERITY_LEVELS },
  { key: "quietHoursStart", label: "Quiet hours start (HH:MM)", multi: false, options: [] },
  { key: "quietHoursEnd", label: "Quiet hours end (HH:MM)", multi: false, options: [] },
];
