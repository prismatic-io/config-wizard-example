import { CircleCheck, CircleDashed, CirclePause } from "lucide-react";
import type { InstanceDisplayStatus } from "@/lib/marketplace";

/** The per-instance status glyph used by the card rows and the detail page. */
export function InstanceStatusIcon({
  status,
  size = 16,
}: {
  status: InstanceDisplayStatus;
  size?: number;
}) {
  if (status.tone === "active") {
    return (
      <CircleCheck
        size={size}
        aria-label={status.label}
        className="shrink-0 text-green-600 dark:text-green-400"
      />
    );
  }
  if (status.tone === "paused") {
    return (
      <CirclePause
        size={size}
        aria-label={status.label}
        className="shrink-0 text-black/40 dark:text-white/40"
      />
    );
  }
  return (
    <CircleDashed
      size={size}
      aria-label={status.label}
      className="shrink-0 text-amber-600 dark:text-amber-400"
    />
  );
}
