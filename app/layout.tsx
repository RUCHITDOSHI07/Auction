import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cricket Auction Platform",
  description: "Admin-controlled cricket auction platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="auction-theme-init" strategy="beforeInteractive">
          {`const savedTheme = document.cookie.split("; ").find((cookie) => cookie.startsWith("auction-theme="))?.slice("auction-theme=".length);
if (savedTheme === "light" || savedTheme === "dark") document.documentElement.dataset.theme = savedTheme;`}
        </Script>
        {children}
      </body>
    </html>
  );
}
