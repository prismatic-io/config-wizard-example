"use client";

// Presentational frame — no Prismatic knowledge.

/** Red-tinted panel for surfacing a load/action/page error message. */
export function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">
      {children}
    </div>
  );
}
