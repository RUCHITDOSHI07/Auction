"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { StatusBadge } from "@/components/ui/Primitives";

type PublicAuction = {
  auction: {
    id: string;
    tournamentId: string;
    tournamentName: string;
    season: number | null;
    gender: "male" | "female";
    status: string;
    currentRound: number | null;
    roundStatus: string | null;
    currentBid: number;
    bidIncrement: number;
    currentPlayerId: string | null;
    highestTeamId: string | null;
    awaitingAdvance: boolean;
    playerCount: number;
    roundTotal: number;
    roundSoldCount: number;
    roundUnsoldCount: number;
  };
  currentPlayer: null | {
    id: string;
    name: string;
    initials: string;
    role?: string;
    category?: string;
    age?: number;
    batting?: string;
    bowling?: string;
    basePrice: number;
    status: string;
  };
  highestTeam: null | { id: string; name: string; shortName: string };
  teams: { id: string; name: string; shortName: string; remainingBudget: number; playersCount: number; squadSize: number; playersNeeded: number; maximumAffordableBid: number; status?: string }[];
};

function money(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export default function PublicLivePage() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const [data, setData] = useState<PublicAuction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const response = await fetch(`/api/public/auctions/${encodeURIComponent(auctionId)}`, { cache: "no-store" });
        const result = await response.json() as { auction?: PublicAuction; error?: string };
        if (!response.ok || !result.auction) throw new Error(result.error ?? "Auction is unavailable.");
        if (active) startTransition(() => { setData(result.auction ?? null); setError(null); setLoading(false); });
      } catch (pollError) {
        if (active) startTransition(() => {
          setError(pollError instanceof Error ? pollError.message : "Unable to refresh auction.");
          setLoading(false);
        });
      } finally {
        if (active) timer = setTimeout(() => { void poll(); }, 2500);
      }
    }
    void poll();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [auctionId, retryCount]);

  if (loading && !data) return <main className="public-live"><section className="public-empty-state"><p>Loading persisted auction...</p><div className="public-skeleton" /></section></main>;
  if (!data) return <main className="public-live"><section className="public-empty-state"><h1>Auction unavailable</h1><p>{error ?? "This share link does not match a configured tournament auction."}</p><button className="button button-outline" type="button" onClick={() => { setLoading(true); setRetryCount((value) => value + 1); }}>Retry</button><Link href="/live" className="button button-dark">All live auctions</Link></section></main>;

  const { auction, currentPlayer, highestTeam, teams } = data;
  const genderLabel = auction.gender === "female" ? "WOMEN'S" : "MEN'S";
  const statusTone = auction.status === "live" ? "live" : auction.status === "completed" ? "success" : "warning";
  const stateMessage = auction.status === "paused" ? "Auction paused" : auction.status === "completed" ? "Auction completed" : auction.status === "ready" ? "Auction ready to start" : auction.awaitingAdvance ? `${currentPlayer?.status === "sold" ? "Sale confirmed" : "Player marked unsold"} · waiting for admin to advance` : null;

  return (
    <main className="public-live public-live-room">
      <header className="public-header"><Link className="live-brand" href="/live"><span className="brand-mark">PN</span><span>{auction.tournamentName}<br /><b>LIVE DISPLAY</b></span></Link><div className="public-meta"><StatusBadge tone={statusTone}>{auction.status.toUpperCase()}</StatusBadge><span>{genderLabel} · {auction.season ?? "SEASON"} · ROUND {auction.currentRound ?? "-"}</span></div></header>
      {error && <div className="public-refresh-error" role="status">Live refresh delayed: {error}</div>}
      {stateMessage && <div className="public-auction-state"><StatusBadge tone={statusTone}>{stateMessage}</StatusBadge></div>}
      <div className="public-live-grid">
        <section className="public-player-stage">
          {currentPlayer ? <>
            <div className="public-player-initials" aria-hidden="true">{currentPlayer.initials}</div>
            <div className="public-player-details"><span className="eyebrow">CURRENT PLAYER · {currentPlayer.id}</span><h1>{currentPlayer.name}</h1><p>{[currentPlayer.role, currentPlayer.category, currentPlayer.age ? `${currentPlayer.age} years` : null].filter(Boolean).join(" · ")}</p><div className="public-details"><span><small>BASE PRICE</small><b>{money(currentPlayer.basePrice)}</b></span><span><small>BATTING</small><b>{currentPlayer.batting ?? "Not provided"}</b></span><span><small>BOWLING</small><b>{currentPlayer.bowling ?? "Not provided"}</b></span></div></div>
          </> : <div className="public-round-complete"><span className="eyebrow">ROUND {auction.currentRound ?? "-"}</span><h1>{auction.status === "completed" ? "Auction complete" : "Round complete"}</h1><p>{auction.roundSoldCount} sold · {auction.roundUnsoldCount} unsold</p></div>}
        </section>
        <section className="public-current-bid"><span className="eyebrow">CURRENT BID</span><strong>{money(auction.currentBid)}</strong><div className="public-winner"><span className="team-logo">{highestTeam?.shortName ?? "--"}</span><div><small>LEADING TEAM</small><b>{highestTeam?.name ?? "No bids yet"}</b></div></div><span className="public-increment">Bid increment · {money(auction.bidIncrement)}</span></section>
      </div>
      <section className="public-squad-section"><div className="public-section-title"><span className="eyebrow">TEAM STATUS · {teams.length} TEAMS</span><h2>Squads and purse</h2></div><div className="public-team-grid">{teams.map((team) => <article className={`public-team${team.id === highestTeam?.id ? " public-team-leading" : ""}`} key={team.id}><div className="public-team-heading"><span className="team-logo">{team.shortName}</span><strong>{team.name}</strong>{team.id === highestTeam?.id && <StatusBadge tone="live">LEADING</StatusBadge>}</div><div className="public-team-metrics"><span><small>REMAINING PURSE</small><b>{money(team.remainingBudget)}</b></span><span><small>SQUAD</small><b>{team.playersCount}/{team.squadSize}</b></span><span className="public-max-bid"><small>MAX BID</small><b>{money(team.maximumAffordableBid)}</b></span></div><div className="public-squad-track"><span style={{ width: `${team.squadSize > 0 ? Math.min(100, team.playersCount / team.squadSize * 100) : 0}%` }} /></div><small className="public-players-needed">{team.playersNeeded} minimum slots needed · max bid reserves for those slots</small></article>)}</div></section>
      <footer className="public-live-footer"><span>READ-ONLY DISPLAY</span><span>Updated from persisted auction state · polling every 2.5 seconds</span><Link href="/live">All auctions</Link></footer>
    </main>
  );
}