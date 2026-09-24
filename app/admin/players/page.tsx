"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import type { Player } from "@/types/firestore";
import { PageHeader, StatusBadge } from "@/components/ui/Primitives";

type PlayerRecord = Player & { gender?: string };
type GenderFilter = "all" | "male" | "female";

const roleOptions = ["All roles", "Batter", "Bowler", "All-rounder", "Wicketkeeper"];

function getGender(player: PlayerRecord) {
  const gender = player.gender?.trim().toLowerCase();
  return gender === "male" || gender === "female" ? gender : "other";
}

function getPlayerName(player: PlayerRecord) {
  return player.name ?? player.fullName ?? "Unnamed player";
}

function getInitials(player: PlayerRecord) {
  const name = getPlayerName(player);
  return player.initials ?? name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatPrice(value: number) {
  return `${value.toLocaleString("en-IN")} cr`;
}

function roleMatches(playerRole: string, selectedRole: string) {
  if (selectedRole === "All roles") return true;
  const normalizedRole = playerRole.toLowerCase();
  return selectedRole === "Wicketkeeper"
    ? normalizedRole.includes("wicket") || normalizedRole.includes("keeper")
    : normalizedRole.includes(selectedRole.toLowerCase().replace("-", "-"));
}

function PlayerPhoto({ player }: { player: PlayerRecord }) {
  const [imageFailed, setImageFailed] = useState(false);
  const photoUrl = player.photoUrl?.trim();

  if (!photoUrl || imageFailed) {
    return <div className="player-card-photo player-card-photo-fallback" style={{ background: player.accent ?? "#d9ef75" }}>{getInitials(player)}</div>;
  }

  return (
    <div className="player-card-photo">
      <img src={photoUrl} alt={`${getPlayerName(player)} portrait`} onError={() => setImageFailed(true)} />
    </div>
  );
}

function PlayerSkeleton() {
  return (
    <div className="player-card player-card-skeleton" aria-hidden="true">
      <div className="skeleton-photo" />
      <div className="skeleton-line skeleton-line-short" />
      <div className="skeleton-line" />
      <div className="skeleton-line skeleton-line-small" />
    </div>
  );
}

export default function AdminPlayersPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [priceFilter, setPriceFilter] = useState("All prices");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/players");
      const result = await response.json() as { players?: PlayerRecord[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load players.");
      setPlayers(result.players ?? []);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load players.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(() => void loadPlayers(), 0);
    return () => window.clearTimeout(request);
  }, [loadPlayers]);

  const maleCount = players.filter((player) => getGender(player) === "male").length;
  const femaleCount = players.filter((player) => getGender(player) === "female").length;
  const averageBasePrice = players.length ? players.reduce((sum, player) => sum + (player.basePrice || 0), 0) / players.length : 0;
  const hasActiveFilters = Boolean(query || statusFilter !== "All statuses" || roleFilter !== "All roles" || priceFilter !== "All prices" || genderFilter !== "all");
  const filtered = players.filter((player) => {
    const searchable = [getPlayerName(player), player.role, player.category, player.battingStyle, player.bowlingStyle, player.phoneNumber].filter(Boolean).join(" ").toLowerCase();
    const priceMatches = priceFilter === "All prices" || (priceFilter === "Under 5 cr" ? player.basePrice < 5 : priceFilter === "5–10 cr" ? player.basePrice >= 5 && player.basePrice <= 10 : player.basePrice > 10);
    return searchable.includes(query.toLowerCase()) && roleMatches(player.role, roleFilter) && priceMatches && (statusFilter === "All statuses" || player.status.toUpperCase() === statusFilter) && (genderFilter === "all" || getGender(player) === genderFilter);
  });

  function resetFilters() {
    setQuery("");
    setStatusFilter("All statuses");
    setRoleFilter("All roles");
    setPriceFilter("All prices");
    setGenderFilter("all");
  }

  return (
    <AdminShell>
      <div className="content-wrap">
        <PageHeader
          eyebrow="PLAYER POOL"
          title="Players"
          description="Manage your tournament player pool"
          action={
            <Link className="button button-dark players-import-button" href="/admin/players/import">
              <span aria-hidden="true">⇪</span>
              Import players
            </Link>
          }
        />

        <section className="player-stats-grid" aria-label="Player statistics">
          <div className="player-stat-card player-stat-card-lime"><span className="player-stat-icon">◌</span><span className="player-stat-label">Total players</span><strong>{players.length}</strong><small>Registered in pool</small></div>
          <div className="player-stat-card player-stat-card-blue"><span className="player-stat-icon">♂</span><span className="player-stat-label">Male players</span><strong>{maleCount}</strong><small>Men&apos;s pool</small></div>
          <div className="player-stat-card player-stat-card-orange"><span className="player-stat-icon">♀</span><span className="player-stat-label">Female players</span><strong>{femaleCount}</strong><small>Women&apos;s pool</small></div>
          <div className="player-stat-card player-stat-card-lavender"><span className="player-stat-icon">₹</span><span className="player-stat-label">Average base price</span><strong>{formatPrice(Math.round(averageBasePrice))}</strong><small>Across all players</small></div>
        </section>

        <div className="player-tabs" role="tablist" aria-label="Filter players by gender">
          {([["all", "All players", players.length], ["male", "Male", maleCount], ["female", "Female", femaleCount]] as const).map(([value, label, count]) => (
            <button key={value} className={genderFilter === value ? "player-tab active" : "player-tab"} type="button" role="tab" aria-selected={genderFilter === value} onClick={() => setGenderFilter(value)}>
              {label}<span>{count}</span>
            </button>
          ))}
        </div>

        <div className="players-filter-bar">
          <div className="players-search-box">
            <span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player..." aria-label="Search players" />
          </div>
          <select className="players-filter-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role">
            {roleOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
          <select className="players-filter-select" value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)} aria-label="Filter by base price">
            <option>All prices</option><option>Under 5 cr</option><option>5–10 cr</option><option>Above 10 cr</option>
          </select>
          <select className="players-filter-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
            <option>All statuses</option>
            <option>AVAILABLE</option>
            <option>ON_AUCTION</option>
            <option>SOLD</option>
            <option>UNSOLD</option>
          </select>
          {hasActiveFilters && <button className="players-clear-button" type="button" onClick={resetFilters}>Clear filters</button>}
        </div>

        {loading && <div className="players-grid">{Array.from({ length: 6 }, (_, index) => <PlayerSkeleton key={index} />)}</div>}
        {!loading && error && <div className="players-empty-state"><span className="players-empty-icon">!</span><h2>Unable to load players</h2><p>Please try again.</p><button className="button button-dark" type="button" onClick={() => void loadPlayers()}>Retry</button></div>}
        {!loading && !error && filtered.length === 0 && <div className="players-empty-state"><span className="players-empty-icon">⌁</span><h2>{players.length ? "No players found" : "No players yet"}</h2><p>{players.length ? "Try changing your search or filters." : "Import your player Excel file to get started."}</p>{players.length ? <button className="button button-outline" type="button" onClick={resetFilters}>Clear filters</button> : <Link className="button button-dark" href="/admin/players/import">Import players</Link>}</div>}
        {!loading && !error && filtered.length > 0 && <div className="players-grid">
          {filtered.map((player) => {
            const playerStatus = player.status.toUpperCase();
            return <Link className="player-card" href={`/admin/players/${player.id}`} key={player.id}>
              <PlayerPhoto player={player} />
              <div className="player-card-content">
                <div className="player-card-topline"><span className="player-category">{player.category ?? "Uncategorized"}</span><StatusBadge tone={playerStatus === "SOLD" ? "success" : playerStatus === "ON_AUCTION" ? "live" : playerStatus === "UNSOLD" ? "warning" : "neutral"}>{playerStatus.replace("_", " ")}</StatusBadge></div>
                <h2>{getPlayerName(player)}</h2>
                <div className="player-card-meta"><span className="role-badge">{player.role}</span>{player.age ? <span>{player.age} years</span> : null}<span>{getGender(player) === "other" ? "Gender not set" : getGender(player)}</span></div>
                <div className="player-card-footer"><div><small>Base price</small><strong>{formatPrice(player.basePrice || 0)}</strong></div><span className="player-card-arrow" aria-hidden="true">↗</span></div>
              </div>
            </Link>;
          })}
        </div>
        }
      </div>
    </AdminShell>
  );
}
