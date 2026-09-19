import type { Metadata } from "next";
import Link from "next/link";
import { Providers } from "@/lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Newton vault demo",
  description: "Shareholders deposit. The curator reallocates only through Newton Shield.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <main>
            <nav>
              <Link href="/">Home</Link>
              <Link href="/shareholder">Shareholder</Link>
              <Link href="/curator">Curator</Link>
            </nav>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
