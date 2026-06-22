import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import Link from "next/link";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Prismatic Config Wizard Example",
  description: "Barebones embedded Prismatic marketplace + config wizard demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <header className="border-b border-white/10">
            <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
              <Link href="/" className="font-semibold">
                Config Wizard Demo
              </Link>
              <div className="flex gap-4 text-sm text-white/70">
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
                <Link href="/integrations" className="hover:text-white">
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
