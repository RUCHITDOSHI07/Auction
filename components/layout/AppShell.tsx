"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: "◫" },
  { href: "/teams", label: "Teams", icon: "⌂" },
  { href: "/players", label: "Players", icon: "◌" },
  { href: "/auction", label: "Auctions", icon: "↗" },
  { href: "/results", label: "Results", icon: "▤" },
  { href: "/history", label: "History", icon: "◷" },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard"><span className="brand-mark">CA</span><span>CRICKET<br /><b>AUCTION</b></span></Link>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => <Link className={pathname.startsWith(item.href) ? "nav-item active" : "nav-item"} href={item.href} key={item.href}><span className="nav-icon">{item.icon}</span>{item.label}</Link>)}
        </nav>
        <div className="sidebar-bottom"><Link className="nav-item" href="/settings"><span className="nav-icon">⚙</span>Settings</Link><div className="operator"><span className="avatar avatar-small">AK</span><span><b>Arjun Kapoor</b><small>Administrator</small></span><span className="operator-more">•••</span></div></div>
      </aside>
      <main className="main-content"><header className="topbar"><div className="crumb">2026 SEASON <span>/</span> CONTROL ROOM</div><div className="top-actions"><Link className="live-link" href="/live">◉ View live display</Link><button className="icon-button" aria-label="Notifications">♧</button><button className="icon-button" aria-label="Help">?</button></div></header>{children}</main>
    </div>
  );
}
