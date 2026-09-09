"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/admin", label: "Dashboard", icon: "◫" },
  { href: "/admin/teams", label: "Teams", icon: "⌂" },
  { href: "/admin/players", label: "Players", icon: "◌" },
  { href: "/admin/players/import", label: "Import Players", icon: "⇪" },
  { href: "/admin/auction", label: "Auction", icon: "↗" },
  { href: "/admin/results", label: "Results", icon: "▤" },
  { href: "/admin/results/export", label: "Export Results", icon: "↓" },
  { href: "/admin/settings", label: "Settings", icon: "⚙" },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell admin-shell">
      <aside className="sidebar admin-sidebar">
        <Link className="brand" href="/admin">
          <span className="brand-mark">CA</span>
          <span>
            CRICKET
            <br />
            <b>ADMIN</b>
          </span>
        </Link>

        <div className="sidebar-label">CONTROL ROOM</div>
        <nav className="main-nav" aria-label="Admin navigation">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "nav-item active" : "nav-item"}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <Link className="nav-item" href="/live">
            <span className="nav-icon">◉</span>
            Public live
          </Link>
          <div className="operator">
            <span className="avatar avatar-small">AK</span>
            <span>
              <b>Arjun Kapoor</b>
              <small>Administrator</small>
            </span>
            <span className="operator-more">•••</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="crumb">
            2026 SEASON <span>/</span> AUCTION CONTROL ROOM
          </div>
          <div className="top-actions">
            <Link className="live-link" href="/live">
              ◉ View public display
            </Link>
            <button className="icon-button" aria-label="Notifications">
              ♧
            </button>
            <button className="icon-button" aria-label="Help">
              ?
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
