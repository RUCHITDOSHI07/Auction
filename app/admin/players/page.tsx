"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { getPlayers } from "@/lib/firebase/services/players";
import type { Player } from "@/types/firestore";
import { PageHeader, StatusBadge } from "@/components/ui/Primitives";

export default function AdminPlayersPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All players");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getPlayers()
      .then((loadedPlayers) => {
        if (active) setPlayers(loadedPlayers);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load players.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filtered = players.filter(
    (player) =>
      ((player.name ?? player.fullName ?? "").toLowerCase().includes(query.toLowerCase()) ||
        player.role.toLowerCase().includes(query.toLowerCase())) &&
      (filter === "All players" || player.status.toUpperCase() === filter),
  );

  return (
    <AdminShell>
      <div className="content-wrap">
        <PageHeader
          eyebrow={`PLAYER POOL · ${players.length} TRACKED`}
          title="Players"
          description="Imported talent, auction order, and status tracking are ready for the live room."
          action={
            <Link className="button button-dark" href="/admin/players/import">
              Import players
            </Link>
          }
        />

        <div className="toolbar">
          <div className="search-box">
            ⌕ <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or role" />
          </div>
          <select className="filter-button" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option>All players</option>
            <option>AVAILABLE</option>
            <option>ON_AUCTION</option>
            <option>SOLD</option>
            <option>UNSOLD</option>
          </select>
          <button className="filter-button" type="button">
            Category · All
          </button>
        </div>

        <div className="table-panel">
          <div className="table-head">
            <span>PLAYER</span>
            <span>ROLE</span>
            <span>CATEGORY</span>
            <span>BASE PRICE</span>
            <span>STATUS</span>
            <span />
          </div>

          {loading && <div className="empty-state compact"><p>Loading players...</p></div>}
          {!loading && error && <div className="empty-state compact"><p>{error}</p></div>}
          {!loading && !error && filtered.length === 0 && <div className="empty-state compact"><p>No players found.</p></div>}
          {!loading && !error && filtered.map((player) => {
            const playerName = player.name ?? player.fullName ?? "Unnamed player";
            const playerStatus = player.status.toUpperCase();
            const initials = player.initials ?? playerName.slice(0, 2).toUpperCase();
            return (
            <Link className="table-row" href={`/players/${player.id}`} key={player.id}>
              <div className="player-cell">
                <div className="player-portrait" style={{ background: player.accent ?? "#d9ef75" }}>{initials}</div>
                <div>
                  <b>{playerName}</b>
                  <small>{player.age ?? "—"} years · {player.battingStyle ?? player.batting ?? "—"}</small>
                </div>
              </div>
              <span>{player.role}</span>
              <span className="category-text">{player.category ?? "—"}</span>
              <strong>{player.basePrice} cr</strong>
              <StatusBadge
                tone={
                  playerStatus === "SOLD"
                    ? "success"
                    : playerStatus === "ON_AUCTION"
                      ? "live"
                      : playerStatus === "UNSOLD"
                        ? "warning"
                        : "neutral"
                }
              >
                {playerStatus.replace("_", " ")}
              </StatusBadge>
              <span className="row-arrow">↗</span>
            </Link>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
