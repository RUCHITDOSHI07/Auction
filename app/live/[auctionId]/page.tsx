"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { StatusBadge } from "@/components/ui/Primitives";
import AuctionResultFeedback from "@/components/auction/AuctionResultFeedback";
import PlayerPortrait from "@/components/auction/PlayerPortrait";

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
    categoryPhase: "premium" | "general" | null;
    awaitingAdvance: boolean;
    playerCount: number;
    remainingPlayerCount: number;
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
    photoUrl?: string;
    basePrice: number;
    status: string;
  };
  highestTeam: null | { id: string; name: string; shortName: string };
  teams: {
    id: string;
    name: string;
    shortName: string;
    remainingBudget: number;
    playersCount: number;
    premiumPlayersCount: number;
    premiumPlayersLimit?: number;
    squadSize: number;
    playersNeeded: number;
    maximumAffordableBid: number;
    status?: string;
    players: { id: string; name: string; role?: string; category?: string; photoUrl?: string; amount: number; iconPurchase: boolean }[];
    emptySpots: number;
  }[];
  result: null | {
    eventId: string;
    outcome: "sold" | "unsold";
    playerId: string;
    playerName: string;
    playerInitials: string;
    playerPhotoUrl?: string;
    teamId?: string;
    teamName?: string;
    teamShortName?: string;
    amount?: number;
    createdAt: string;
    displayUntil: string;
  };
};

const pollIntervalMs = 1500;

function addPollJitter(delay: number) {
  return Math.round(delay * (0.9 + Math.random() * 0.2));
}

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
    let consecutiveFailures = 0;
    let inFlight = false;
    let refreshWhenSettled = false;
    let etag: string | null = null;
    const controller = new AbortController();

    async function poll() {
      if (!active || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      let nextDelay = pollIntervalMs;
      try {
        const headers = new Headers();
        if (etag) headers.set("If-None-Match", etag);
        const response = await fetch(`/api/public/auctions/${encodeURIComponent(auctionId)}`, {
          cache: "no-store",
          headers,
          signal: controller.signal,
        });
        if (response.status === 304) {
          consecutiveFailures = 0;
          if (active) startTransition(() => { setError(null); setLoading(false); });
          return;
        }
        const result = await response.json() as { auction?: PublicAuction; error?: string };
        if (!response.ok || !result.auction) throw new Error(result.error ?? "Auction is unavailable.");
        etag = response.headers.get("ETag") ?? etag;
        consecutiveFailures = 0;
        if (active) startTransition(() => { setData(result.auction ?? null); setError(null); setLoading(false); });
      } catch (pollError) {
        consecutiveFailures += 1;
        nextDelay = Math.min(pollIntervalMs * 2 ** Math.min(consecutiveFailures - 1, 4), 60000);
        if (active) startTransition(() => {
          setError(pollError instanceof Error ? pollError.message : "Unable to refresh auction.");
          setLoading(false);
        });
      } finally {
        inFlight = false;
        if (active) {
          timer = setTimeout(() => {
            void poll();
          }, refreshWhenSettled ? 0 : addPollJitter(nextDelay));
          refreshWhenSettled = false;
        }
      }
    }

    function refreshOnReturn() {
      if (document.visibilityState !== "visible" || !active) return;
      if (timer) clearTimeout(timer);
      if (inFlight) {
        refreshWhenSettled = true;
      } else {
        void poll();
      }
    }

    document.addEventListener("visibilitychange", refreshOnReturn);
    timer = setTimeout(() => { void poll(); }, Math.random() * 750);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", refreshOnReturn);
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [auctionId, retryCount]);

  if (loading && !data) return <main className="public-live"><section className="public-empty-state"><p>Loading persisted auction...</p><div className="public-skeleton" /></section></main>;
  if (!data) return <main className="public-live"><section className="public-empty-state"><h1>Auction unavailable</h1><p>{error ?? "This share link does not match a configured tournament auction."}</p><button className="button button-outline" type="button" onClick={() => { setLoading(true); setRetryCount((value) => value + 1); }}>Retry</button><Link href="/live" className="button button-dark">All live auctions</Link></section></main>;

  const { auction, currentPlayer, highestTeam, teams } = data;
  const genderLabel = auction.gender === "female" ? "WOMEN'S" : "MEN'S";
  const currentPlayerIsPremium = ["A", "B", "C"].includes((currentPlayer?.category ?? "").trim().toUpperCase());
  const statusTone = auction.status === "live" ? "live" : auction.status === "completed" ? "success" : "warning";
  const stateMessage = auction.status === "paused" ? "Auction paused" : auction.status === "completed" ? "Auction completed" : auction.status === "ready" ? "Auction ready to start" : auction.awaitingAdvance ? `${currentPlayer?.status === "sold" ? "Sale confirmed" : "Player marked unsold"} · waiting for admin to advance` : null;

  return (
    <main className="public-live public-live-room">
      <header className="public-header"><Link className="live-brand" href="/live"><span className="brand-mark">PN</span><span>{auction.tournamentName}<br /><b>LIVE DISPLAY</b></span></Link><nav className="public-tournament-nav" aria-label="Tournament information"><Link href={`/players?tournamentId=${encodeURIComponent(auction.tournamentId)}&gender=${auction.gender}`}>Players</Link><Link href={`/results?tournamentId=${encodeURIComponent(auction.tournamentId)}&gender=${auction.gender}`}>Results</Link></nav><div className="public-meta"><StatusBadge tone={statusTone}>{auction.status.toUpperCase()}</StatusBadge><span>{genderLabel} · {auction.season ?? "SEASON"} · ROUND {auction.currentRound ?? "-"}</span></div></header>
      {error && <div className="public-refresh-error" role="status">Live refresh delayed: {error}</div>}
      <AuctionResultFeedback variant="public" result={data.result} storageKey={`public-auction-${auction.id}`} />
      {stateMessage && <div className="public-auction-state"><StatusBadge tone={statusTone}>{stateMessage}</StatusBadge></div>}
      <div className="public-live-grid">
        <section className="public-player-stage">
          {currentPlayer ? <>
            <PlayerPortrait className="public-player-portrait" name={currentPlayer.name} initials={currentPlayer.initials} photoUrl={currentPlayer.photoUrl} />
            <div className="public-player-details"><span className="eyebrow">CURRENT PLAYER · {currentPlayer.id}</span><h1>{currentPlayer.name}</h1><p>{[currentPlayer.role, currentPlayer.category, currentPlayer.age ? `${currentPlayer.age} years` : null].filter(Boolean).join(" · ")}</p><div className="public-details"><span><small>BASE PRICE</small><b>{money(currentPlayer.basePrice)}</b></span><span><small>BATTING</small><b>{currentPlayer.batting ?? "Not provided"}</b></span><span><small>BOWLING</small><b>{currentPlayer.bowling ?? "Not provided"}</b></span></div></div>
          </> : <div className="public-round-complete"><span className="eyebrow">ROUND {auction.currentRound ?? "-"}</span><h1>{auction.status === "completed" ? "Auction complete" : "Round complete"}</h1><p>{auction.roundSoldCount} sold · {auction.roundUnsoldCount} unsold</p></div>}
        </section>
        <section className="public-current-bid"><span className="eyebrow">CURRENT BID</span><strong>{money(auction.currentBid)}</strong><div className="public-winner"><span className="team-logo">{highestTeam?.shortName ?? "--"}</span><div><small>LEADING TEAM</small><b>{highestTeam?.name ?? "No bids yet"}</b></div></div><span className="public-increment">Bid increment · {money(auction.bidIncrement)}</span>{currentPlayerIsPremium && <p className="public-category-bid-note">A/B/C player · teams at their {teams[0]?.premiumPlayersLimit ?? 2}-player category limit cannot bid.</p>}</section>
      </div>
      <section className="public-squad-section"><div className="public-section-title"><span className="eyebrow">TEAM STATUS · {teams.length} TEAMS · {auction.remainingPlayerCount} PLAYERS REMAINING{auction.categoryPhase ? ` · ${auction.categoryPhase === "premium" ? "A/B/C" : "GENERAL"} PHASE` : ""}</span><h2>Squads and purse</h2><p>Select a team to view its players and remaining squad spots.</p></div><div className="public-team-grid">{teams.map((team) => {const categoryLimitReached=team.premiumPlayersLimit!==undefined&&team.premiumPlayersCount>=team.premiumPlayersLimit;return <details className={`public-team${team.id === highestTeam?.id ? " public-team-leading" : ""}`} key={team.id}><summary className="public-team-summary"><div className="public-team-heading"><span className="team-logo">{team.shortName}</span><strong>{team.name}</strong>{team.id === highestTeam?.id && <StatusBadge tone="live">LEADING</StatusBadge>}</div><div className="public-team-metrics"><span><small>REMAINING PURSE</small><b>{money(team.remainingBudget)}</b></span><span><small>SQUAD</small><b>{team.playersCount}/{team.squadSize}</b></span><span><small>A/B/C PLAYERS</small><b>{team.premiumPlayersCount}{team.premiumPlayersLimit === undefined ? "" : `/${team.premiumPlayersLimit}`}</b></span><span className="public-max-bid"><small>MAX BID</small><b>{money(team.maximumAffordableBid)}</b></span></div>{categoryLimitReached&&<span className={`public-category-limit${currentPlayerIsPremium?" blocked":""}`}>A/B/C LIMIT REACHED{currentPlayerIsPremium?" · CANNOT BID ON THIS PLAYER":""}</span>}<div className="public-squad-track"><span style={{ width: `${team.squadSize > 0 ? Math.min(100, team.playersCount / team.squadSize * 100) : 0}%` }} /></div><small className="public-players-needed">{team.playersNeeded} minimum slots needed · max bid reserves for those slots</small><span className="public-team-expand-hint">View players and open spots {team.playersCount}/{team.squadSize}</span></summary><div className="public-team-roster"><h3>Selected players</h3>{team.players.length ? <ul>{team.players.map((player) => <li key={player.id}><span><strong>{player.name}</strong><small>{[player.iconPurchase ? "Icon player" : "Auction purchase", player.category, player.role].filter(Boolean).join(" · ")}</small></span><b>{money(player.amount)}</b></li>)}</ul> : <p>No players selected yet.</p>}<h3>Open spots</h3>{team.emptySpots ? <ul className="public-empty-spots">{Array.from({length:team.emptySpots},(_,index)=><li key={index}>Open squad spot {index+1}</li>)}</ul> : <p>Squad is full.</p>}</div></details>})}</div></section>
      <footer className="public-live-footer"><span>READ-ONLY DISPLAY</span><span>Updated from persisted auction state · polling about every 1.5 seconds</span><Link href="/live">All auctions</Link></footer>
    </main>
  );
}