import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif display face for the wordmark and headings.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

import Link from "next/link";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Acme Integrations",
  description: "Acme's embedded Prismatic marketplace + config wizard demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <header className="border-b border-neutral-200">
            <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
              <Link href="/" className="font-serif text-xl">
                Acme
              </Link>
              <div className="flex gap-4 text-sm text-neutral-500">
                <Link href="/" className="hover:text-neutral-900">
                  Home
                </Link>
                <Link href="/integrations" className="hover:text-neutral-900">
                  Integrations
                </Link>
              </div>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
