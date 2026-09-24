"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import type { Player } from "@/types/firestore";
import { PageHeader, StatusBadge } from "@/components/ui/Primitives";

type PlayerRecord = Player & {
  gender?: string;
  tournament?: {
    basePrice?: number;
    status?: string;
  };
};

type GenderFilter = "all" | "male" | "female";

const roleOptions = [
  "All roles",
  "Batter",
  "Bowler",
  "All-rounder",
  "Wicketkeeper",
];

function getGender(player: PlayerRecord) {
  const gender = player.gender?.trim().toLowerCase();

  return gender === "male" || gender === "female" ? gender : "other";
}

function getPlayerName(player: PlayerRecord) {
  return player.name ?? player.fullName ?? "Unnamed player";
}

function getInitials(player: PlayerRecord) {
  return (
    player.initials ??
    getPlayerName(player)
      .split(" ")
      .map(function (p) {
        return p[0];
      })
      .join("")
      .slice(0, 2)
      .toUpperCase()
  );
}

function formatPrice(value: number) {
  return value.toLocaleString("en-IN") + " cr";
}

function roleMatches(role: string, selected: string) {
  if (selected === "All roles") return true;

  const normalized = role.toLowerCase();

  return selected === "Wicketkeeper"
    ? normalized.includes("wicket") || normalized.includes("keeper")
    : normalized.includes(selected.toLowerCase());
}

function PlayerPhoto({ player }: { player: PlayerRecord }) {
  const [failed, setFailed] = useState(false);
  const url = player.photoUrl?.trim();

  if (!url || failed) {
    return (
      <div
        className="player-card-photo player-card-photo-fallback"
        style={{ background: player.accent ?? "#d9ef75" }}
      >
        {getInitials(player)}
      </div>
    );
  }

  return (
    <div className="player-card-photo">
      <img
        src={url}
        alt={getPlayerName(player) + " portrait"}
        onError={function () {
          setFailed(true);
        }}
      />
    </div>
  );
}

function AdminPlayersContent() {
  const search = useSearchParams();

  const tournamentId = search.get("tournamentId");

  const initialGender = (
    search.get("gender") === "female" || search.get("gender") === "male"
      ? search.get("gender")
      : "all"
  ) as GenderFilter;

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [genderFilter, setGenderFilter] =
    useState<GenderFilter>(initialGender);

  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = tournamentId
        ? "/api/tournament-players?tournamentId=" +
          encodeURIComponent(tournamentId)
        : "/api/players";

      const response = await fetch(endpoint);

      const result = (await response.json()) as {
        players?: PlayerRecord[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load players.");
      }

      setPlayers(result.players ?? []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load players."
      );
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(
    function () {
      void loadPlayers();
    },
    [loadPlayers]
  );

  const maleCount = players.filter(function (p) {
    return getGender(p) === "male";
  }).length;

  const femaleCount = players.filter(function (p) {
    return getGender(p) === "female";
  }).length;

  const filtered = players.filter(function (player) {
    const searchable = [
      getPlayerName(player),
      player.role,
      player.category,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      searchable.includes(query.toLowerCase()) &&
      roleMatches(player.role, roleFilter) &&
      (genderFilter === "all" || getGender(player) === genderFilter)
    );
  });

  const title = tournamentId ? "Tournament player pool" : "Players";

  const importHref = tournamentId
    ? "/admin/tournaments/" + tournamentId + "/players/import"
    : "/admin/players/import";

  return (
    <AdminShell>
      <div className="content-wrap">
        <PageHeader
          eyebrow={tournamentId ? "TOURNAMENT PLAYER POOL" : "PLAYER POOL"}
          title={title}
          description={
            tournamentId
              ? "Players imported for this tournament. Men's and women's players are filtered by the Gender column."
              : "Manage your player master pool."
          }
          action={
            <Link
              className="button button-dark players-import-button"
              href={importHref}
            >
              ⇪ Import players
            </Link>
          }
        />

        {tournamentId && (
          <div className="player-tabs" role="tablist">
            <button
              className={
                genderFilter === "male"
                  ? "player-tab active"
                  : "player-tab"
              }
              onClick={function () {
                setGenderFilter("male");
              }}
              type="button"
            >
              Men <span>{maleCount}</span>
            </button>

            <button
              className={
                genderFilter === "female"
                  ? "player-tab active"
                  : "player-tab"
              }
              onClick={function () {
                setGenderFilter("female");
              }}
              type="button"
            >
              Women <span>{femaleCount}</span>
            </button>

            <Link
              className="player-tab"
              href={"/admin/tournaments/" + tournamentId}
            >
              ← Tournament
            </Link>
          </div>
        )}

        <div className="players-filter-bar">
          <div className="players-search-box">
            <span>⌕</span>

            <input
              value={query}
              onChange={function (e) {
                setQuery(e.target.value);
              }}
              placeholder="Search player..."
            />
          </div>

          <select
            className="players-filter-select"
            value={roleFilter}
            onChange={function (e) {
              setRoleFilter(e.target.value);
            }}
          >
            {roleOptions.map(function (o) {
              return <option key={o}>{o}</option>;
            })}
          </select>
        </div>

        {loading && (
          <div className="players-empty-state">
            <p>Loading players...</p>
          </div>
        )}

        {!loading && error && (
          <div className="players-empty-state">
            <h2>Unable to load players</h2>

            <p>{error}</p>

            <button
              className="button button-dark"
              type="button"
              onClick={function () {
                void loadPlayers();
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="players-empty-state">
            <h2>No players found</h2>

            <p>
              {players.length
                ? "Try another filter."
                : "Import the tournament player Excel file to get started."}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="players-grid">
            {filtered.map(function (player) {
              const status = (
                player.tournament?.status ?? player.status
              ).toUpperCase();

              const basePrice =
                player.tournament?.basePrice ?? player.basePrice;

              return (
                <Link
                  className="player-card"
                  href={"/admin/players/" + player.id}
                  key={player.id}
                >
                  <PlayerPhoto player={player} />

                  <div className="player-card-content">
                    <div className="player-card-topline">
                      <span className="player-category">
                        {player.category ?? "Uncategorized"}
                      </span>

                      <StatusBadge
                        tone={
                          status === "SOLD"
                            ? "success"
                            : status === "ON_AUCTION"
                              ? "live"
                              : status === "UNSOLD"
                                ? "warning"
                                : "neutral"
                        }
                      >
                        {status.replace("_", " ")}
                      </StatusBadge>
                    </div>

                    <h2>{getPlayerName(player)}</h2>

                    <div className="player-card-meta">
                      <span className="role-badge">{player.role}</span>

                      <span>{getGender(player)}</span>

                      {player.age ? (
                        <span>{player.age} years</span>
                      ) : null}
                    </div>

                    <div className="player-card-footer">
                      <div>
                        <small>Base price</small>

                        <strong>
                          {formatPrice(basePrice || 0)}
                        </strong>
                      </div>

                      <span className="player-card-arrow">↗</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}

export default function AdminPlayersPage() {
  return (
    <Suspense
      fallback={
        <AdminShell>
          <div className="content-wrap">
            <div className="panel">
              <p>Loading players...</p>
            </div>
          </div>
        </AdminShell>
      }
    >
      <AdminPlayersContent />
    </Suspense>
  );
}