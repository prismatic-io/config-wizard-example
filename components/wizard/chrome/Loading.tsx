"use client";

// Presentational frame — no Prismatic knowledge.

import { Loader2 } from "lucide-react";

/** Centered spinner + message at the wizard body's resting height, so the modal doesn't resize. */
export function Loading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[28rem] flex-col items-center justify-center gap-3 text-neutral-500">
      <Loader2 size={28} className="animate-spin text-neutral-400" />
      <p className="text-sm">{children}</p>
    </div>
  );
}
