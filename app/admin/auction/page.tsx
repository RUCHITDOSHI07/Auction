"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getPlayer, getTeam, players, teams } from "@/mock/data";
import { PageHeader, SectionHeading, StatusBadge } from "@/components/ui/Primitives";

function AdminAuctionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tournamentId = searchParams.get("tournamentId");
  const gender = searchParams.get("gender");
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkConfiguration() {
      if (!tournamentId || (gender !== "male" && gender !== "female")) {
        router.replace("/admin/tournaments");
        return;
      }
      try {
        const response = await fetch(`/api/auction-config?tournamentId=${encodeURIComponent(tournamentId)}&gender=${gender}`);
        const data = await response.json() as { config?: unknown; error?: string };
        if (!response.ok || !data.config) {
          if (!cancelled) router.replace(`/admin/tournaments/${tournamentId}/auction-config?gender=${gender}`);
          return;
        }
        if (!cancelled) {
          setConfigured(true);
          setCheckingConfig(false);
        }
      } catch {
        if (!cancelled) router.replace(`/admin/tournaments/${tournamentId}/auction-config?gender=${gender}`);
      }
    }
    void checkConfiguration();
    return () => { cancelled = true; };
  }, [gender, router, tournamentId]);

  const [bid, setBid] = useState(55);\n  const [status, setStatus] = useState<"LIVE" | "SOLD" | "UNSOLD">("LIVE");\n\n  if (checkingConfig || !configured) {
    return <AdminShell><div className="content-wrap"><div className="panel"><p>Checking auction configuration...</p></div></div></AdminShell>;
  }

  const activePlayer = getPlayer("dev-patel");
  const winningTeam = getTeam("city-lions");
  const [bid, setBid] = useState(55);
  const [status, setStatus] = useState<"LIVE" | "SOLD" | "UNSOLD">("LIVE");

  return (
    <AdminShell>
      <div className="content-wrap auction-room">
        <PageHeader
          eyebrow="MEN'S PREMIER · ROUND 2"
          title="Auction room"
          action={
            <div className="room-actions">
              <StatusBadge tone={status === "LIVE" ? "live" : status === "SOLD" ? "success" : "warning"}>{status}</StatusBadge>
              <button className="button button-quiet" type="button">
                Pause room
              </button>
            </div>
          }
        />

        <div className="auction-layout">
          <section className="current-player-panel">
            <div className="player-stage" style={{ background: activePlayer.accent }}>
              <span className="stage-number">PLAYER 05</span>
              <span className="stage-initials">{activePlayer.initials}</span>
              <span className="stage-role">{activePlayer.role.toUpperCase()}</span>
            </div>
            <div className="player-stage-info">
              <div>
                <span className="eyebrow">
                  {activePlayer.category} · {activePlayer.age} YEARS
                </span>
                <h2>{activePlayer.name}</h2>
                <p>
                  {activePlayer.batting} · {activePlayer.bowling}
                </p>
              </div>
              <div className="base-price">
                <small>BASE PRICE</small>
                <b>₹{activePlayer.basePrice}L</b>
              </div>
            </div>
          </section>

          <section className="bid-panel">
            <div className="bid-panel-top">
              <span className="eyebrow">CURRENT BID</span>
              <span className="round-label">ROUND 2 · LOT 05/32</span>
            </div>
            <strong className="big-bid">
              ₹{bid}L
            </strong>
            <div className="winning-team">
              <span className="team-logo" style={{ background: winningTeam.color }}>{winningTeam.shortName}</span>
              <div>
                <small>HIGHEST BIDDER</small>
                <b>{winningTeam.name}</b>
              </div>
              <span className="winning-mark">✓</span>
            </div>

            <div className="bid-history">
              {players.slice(0, 5).map((player) => (
                <div className="bid-history-row" key={player.id}>
                  <span className="team-logo team-logo-small" style={{ background: player.accent }}>
                    {player.initials}
                  </span>
                  <b>{player.name}</b>
                  <span>₹{player.basePrice}L</span>
                </div>
              ))}
            </div>
          </section>

          <aside className="panel team-board">
            <SectionHeading title="Teams" />
            {teams.map((team) => (
              <div className="team-board-row" key={team.id}>
                <span className="team-logo" style={{ background: team.color }}>{team.shortName}</span>
                <div>
                  <b>{team.name}</b>
                  <small>{team.purse} cr remaining</small>
                </div>
              </div>
            ))}
          </aside>
        </div>

        <div className="room-lower">
          <button className="button button-dark" type="button" onClick={() => setBid((value) => value + 5)}>
            Bid ₹{bid + 5}L
          </button>
          <button className="button button-sold" type="button" onClick={() => setStatus("SOLD")}>
            Sold
          </button>
          <button className="button button-unsold" type="button" onClick={() => setStatus("UNSOLD")}>
            Unsold
          </button>
          <button className="button button-outline" type="button">
            Next player
          </button>
        </div>
      </div>
    </AdminShell>
  );
}


export default function AdminAuctionPage() {
  return (
    <Suspense fallback={<AdminShell><div className="content-wrap"><div className="panel"><p>Loading auction room...</p></div></div></AdminShell>}>
      <AdminAuctionContent />
    </Suspense>
  );
}
