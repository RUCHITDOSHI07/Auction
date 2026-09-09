"use client";

import { useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { getPlayer, getTeam, players, teams } from "@/mock/data";
import { PageHeader, SectionHeading, StatusBadge } from "@/components/ui/Primitives";

export default function AdminAuctionPage() {
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
