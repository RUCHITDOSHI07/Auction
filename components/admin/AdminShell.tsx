"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const navigation = [
  { href: "/admin", label: "Dashboard", icon: "◫" }, { href: "/admin/tournaments", label: "Tournaments", icon: "◈" },
  { href: "/admin/teams", label: "Teams", icon: "⌂" }, { href: "/admin/players", label: "Players", icon: "◌" },
  { href: "/admin/players/import", label: "Import Players", icon: "⇪" }, { href: "/admin/auction", label: "Auction", icon: "↗" },
  { href: "/admin/results", label: "Results", icon: "▤" }, { href: "/admin/results/export", label: "Export Results", icon: "↓" },
  { href: "/admin/settings", label: "Settings", icon: "⚙" },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const [authUser, setAuthUser] = useState<{ userId: string; name?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false); const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/session").then(async (response) => { if (!response.ok) throw new Error("Unauthenticated"); return response.json() as Promise<{ admin: { userId: string; name?: string } }>; })
      .then(({ admin }) => { if (!active) return; setAuthUser(admin); setIsAdmin(true); setAuthReady(true); })
      .catch(() => { if (active) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`); });
    return () => { active = false; };
  }, [pathname, router]);
  if (!authReady || !isAdmin) return <main className="landing"><p>Checking administrator access...</p></main>;
  return (
    <div className="app-shell admin-shell">
      <aside className="sidebar admin-sidebar">
        <Link className="brand" href="/admin"><span className="brand-mark">CA</span><span>CRICKET<br /><b>ADMIN</b></span></Link>
        <div className="sidebar-label">CONTROL ROOM</div>
        <nav className="main-nav" aria-label="Admin navigation">{navigation.map((item) => <Link key={item.href} href={item.href} className={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "nav-item active" : "nav-item"}><span className="nav-icon">{item.icon}</span><span className="nav-label">{item.label}</span></Link>)}</nav>
        <div className="sidebar-bottom">
          <Link className="nav-item" href="/live"><span className="nav-icon">◉</span><span className="nav-label">Public live</span></Link>
          <div className="operator"><span className="avatar avatar-small">AK</span><span><b>{authUser?.name ?? authUser?.userId ?? "Administrator"}</b><small>Administrator · {authUser?.userId}</small></span><span className="operator-more">•••</span></div>
          <button className="nav-item admin-logout" type="button" onClick={() => { void fetch("/api/auth/logout", { method: "POST" }).finally(() => router.replace("/admin/login")); }}><span className="nav-icon">↪</span><span className="nav-label">Sign out</span></button>
        </div>
      </aside>
      <main className="main-content"><header className="topbar"><div className="crumb">2026 SEASON <span>/</span> AUCTION CONTROL ROOM</div><div className="top-actions"><Link className="live-link" href="/live">◉ View public display</Link><button className="icon-button" aria-label="Notifications">♧</button><button className="icon-button" aria-label="Help">?</button></div></header>{children}</main>
    </div>
  );
}