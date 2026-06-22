"use client";

// Presentational frame — no Prismatic knowledge. The dark modal chrome the wizard
// renders inside; safe to restyle freely without touching wizard state.

import Link from "next/link";
import { X } from "lucide-react";

/** The dark modal frame: header bar with title + close, bordered body. */
export function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-surface shadow-2xl">
      <div className="flex items-center justify-between bg-surface-header px-6 py-4">
        <h1 className="text-base font-semibold">{title}</h1>
        <Link href="/integrations" aria-label="Close" className="text-white/50 hover:text-white">
          <X size={20} />
        </Link>
      </div>
      {children}
    </div>
  );
}
