"use client";

// Presentational frame — no Prismatic knowledge.

/** Red-tinted panel for surfacing a load/action/page error message. */
export function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {children}
    </div>
  );
}
