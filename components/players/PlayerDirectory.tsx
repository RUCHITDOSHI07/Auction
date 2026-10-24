"use client";

import { useState } from "react";
import type { PublicTournamentPlayer } from "@/lib/services/public-tournament-players";
import { StatusBadge } from "@/components/ui/Primitives";

function formatMoney(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export default function PlayerDirectory({
  players,
}: {
  players: PublicTournamentPlayer[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = players
    .filter((player) =>
      (player.name ?? player.fullName ?? "").toLowerCase().includes(normalizedQuery)
      || player.role.toLowerCase().includes(normalizedQuery),
    )
    .filter((player) => filter === "ALL" || player.status.toUpperCase() === filter);

  return (
    <>
      <div className="toolbar">
        <div className="search-box">⌕ <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or role" /></div>
        <select className="filter-button" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter players by status">
          <option value="ALL">All players</option>
          <option value="AVAILABLE">Available</option>
          <option value="ON_AUCTION">On auction</option>
          <option value="SOLD">Sold</option>
          <option value="UNSOLD">Unsold</option>
        </select>
      </div>
      <div className="table-panel">
        <div className="table-head"><span>PLAYER</span><span>ROLE</span><span>CATEGORY</span><span>BASE PRICE</span><span>STATUS</span></div>
        {filtered.map((player) => (
          <div className="table-row" key={player.id}>
            <div className="player-cell">
              <div className="player-portrait" style={{ background: player.accent ?? "#d9ef75" }}>
                {player.initials ?? player.name.slice(0, 2).toUpperCase()}
              </div>
              <div><b>{player.name}</b><small>{player.age ?? "—"} years · {player.battingStyle ?? player.batting ?? "—"}</small></div>
            </div>
            <span>{player.role}</span>
            <span className="category-text">{player.category}</span>
            <strong>{formatMoney(player.basePrice)}</strong>
            <StatusBadge tone={player.status === "sold" ? "success" : player.status === "on_auction" ? "live" : player.status === "unsold" ? "warning" : "neutral"}>
              {player.status.toUpperCase().replace("_", " ")}
            </StatusBadge>
          </div>
        ))}
        {filtered.length === 0 && <p className="public-filter-empty">No players match these filters in this competition.</p>}
      </div>
    </>
  );
}
