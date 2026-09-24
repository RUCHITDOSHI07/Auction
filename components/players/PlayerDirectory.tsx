"use client";

import Link from "next/link";
import { useState } from "react";
import PublicHeader from "@/components/public/PublicHeader";
import type { MongoPlayer } from "@/lib/services/players";
import { PageHeader, StatusBadge } from "@/components/ui/Primitives";

export default function PlayerDirectory({ players }: { players: MongoPlayer[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All players");
  const filtered = players.filter((player) => (player.name ?? player.fullName ?? "").toLowerCase().includes(query.toLowerCase()) || player.role.toLowerCase().includes(query.toLowerCase())).filter((player) => filter === "All players" || player.status.toUpperCase() === filter);

  return <main className="public-live"><PublicHeader><StatusBadge tone="live">PUBLIC</StatusBadge><span>THE FOUNDERS CUP · 2026</span></PublicHeader><div className="content-wrap"><PageHeader eyebrow={`DIRECTORY · ${players.length} PLAYERS`} title="Players" description="Your complete talent pool, ready for selection." action={<Link className="button button-outline" href="/">Back to home</Link>} /><div className="toolbar"><div className="search-box">⌕ <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or role" /></div><select className="filter-button" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All players</option><option>AVAILABLE</option><option>ON_AUCTION</option><option>SOLD</option><option>UNSOLD</option></select><button className="filter-button" type="button">Marquee · Capped · Emerging⌄</button></div><div className="table-panel"><div className="table-head"><span>PLAYER</span><span>ROLE</span><span>CATEGORY</span><span>BASE PRICE</span><span>STATUS</span><span /></div>{filtered.map((player) => <Link className="table-row" href={`/players/${player.id}`} key={player.id}><div className="player-cell"><div className="player-portrait" style={{ background: player.accent ?? "#d9ef75" }}>{player.initials ?? (player.name ?? "P").slice(0, 2).toUpperCase()}</div><div><b>{player.name ?? player.fullName}</b><small>{player.age ?? "—"} years · {player.battingStyle ?? player.batting ?? "—"}</small></div></div><span>{player.role}</span><span className="category-text">{player.category}</span><strong>{player.basePrice} cr</strong><StatusBadge tone={player.status.toUpperCase() === "SOLD" ? "success" : player.status.toUpperCase() === "ON_AUCTION" ? "live" : player.status.toUpperCase() === "UNSOLD" ? "warning" : "neutral"}>{player.status.toUpperCase().replace("_", " ")}</StatusBadge><span className="row-arrow">↗</span></Link>)}</div></div></main>;
}