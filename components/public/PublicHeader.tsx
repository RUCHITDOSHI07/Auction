import Link from "next/link";
import type { ReactNode } from "react";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function PublicHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="public-header">
      <Link className="live-brand" href="/">
        <span className="brand-mark">CA</span>
        <span>
          THE FOUNDERS CUP
          <br />
          <b>LIVE</b>
        </span>
      </Link>
      <div className="public-meta">
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
