"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { refreshAuthenticatedUserClaims, subscribeToAuthState } from "@/lib/firebase/auth";
import type { User } from "firebase/auth";

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
  const router = useRouter();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = subscribeToAuthState((user) => {
        if (!user) {
          if (active) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        void refreshAuthenticatedUserClaims(user)
          .then((claims) => {
            if (!active) return;
            if (claims.admin !== true) {
              router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
              return;
            }
            setAuthUser(user);
            setIsAdmin(true);
            setAuthReady(true);
          })
          .catch(() => {
            if (active) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
          });
      });
    } catch {
      router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [pathname, router]);

  if (!authReady || !isAdmin) {
    return <main className="landing"><p>Checking administrator access...</p></main>;
  }

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
              <b>{authUser?.displayName ?? authUser?.email ?? "Administrator"}</b>
              <small>Administrator · {authUser?.uid.slice(0, 8)}</small>
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
