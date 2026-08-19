"use client";

// Presentational frame — no Prismatic knowledge. The modal chrome the wizard
// renders inside; safe to restyle freely without touching wizard state.

import Link from "next/link";
import { X } from "lucide-react";

/**
 * The modal frame: no header bar — just a floating close button in the top
 * corner. The step's own "Step N: …" heading (rendered by the wizard body) is the visible title;
 * the instance title stays for screen readers.
 */
export function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-neutral-200 bg-surface shadow-xl shadow-neutral-900/5">
      <h1 className="sr-only">{title}</h1>
      <Link
        href="/integrations"
        aria-label="Close"
        className="absolute right-5 top-5 z-10 text-neutral-400 hover:text-neutral-900"
      >
        <X size={20} />
      </Link>
      {children}
    </div>
  );
}
