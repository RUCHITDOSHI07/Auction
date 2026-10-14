"use client";

import { Suspense, startTransition, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { PageHeader, SectionHeading, StatusBadge } from "@/components/ui/Primitives";
import AuctionResultFeedback from "@/components/auction/AuctionResultFeedback";
import PlayerPortrait from "@/components/auction/PlayerPortrait";
import type { AuctionConfig } from "@/types/auction-config";
import type { Team } from "@/types/team";
import type { Player } from "@/types/firestore";

type AuctionPlayer = Pick<Player, "id" | "name" | "role" | "category" | "age" | "batting" | "bowling" | "initials" | "accent" | "photoUrl"> & {
  auctionBasePrice: number;
  auctionStatus: "available" | "on_auction" | "sold" | "unsold";
};

type AuctionRoom = {
  auction: AuctionConfig | null;
  currentPlayer: AuctionPlayer | null;
  teams: (Team & { playersNeeded: number; minimumReserve: number | null; maximumAffordableBid: number; minimumNextBid: number; canPlaceNextBid: boolean })[];
  playerCount: number;
  roundTotal: number;
  roundSoldCount: number;
  roundUnsoldCount: number;
};

type CorrectionPreview = {
  eventId: string;
  player: { id: string; name: string; role?: string; category?: string };
  currentTeamId: string;
  currentAmount: number;
  basePrice: number;
  teams: { id: string; name: string; shortName: string; remainingBudget: number; playersCount: number; maximumAffordableBid: number; eligible: boolean }[];
};

type AuctionAction = "initialize" | "start" | "pause" | "resume" | "complete" | "sold" | "unsold" | "next-player" | "next-round";

function formatMoney(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

async function getCorrectionPreview(auctionId: string, saleEventId: string): Promise<CorrectionPreview> {
  const response = await fetch(`/api/auctions/${encodeURIComponent(auctionId)}/corrections?saleEventId=${encodeURIComponent(saleEventId)}`, { cache: "no-store" });
  const result = await response.json() as { preview?: CorrectionPreview; error?: string };
  if (!response.ok || !result.preview) throw new Error(result.error ?? "Unable to preview correction.");
  return result.preview;
}

function AdminAuctionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tournamentId = searchParams.get("tournamentId") ?? "";
  const gender = searchParams.get("gender");
  const [room, setRoom] = useState<AuctionRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingBidTeamId, setPendingBidTeamId] = useState<string | null>(null);
  const bidLock = useRef(false);
  const resultActionLock = useRef(false);
  const [autoAdvanceAttemptedEventId, setAutoAdvanceAttemptedEventId] = useState<string | null>(null);
  const [correctionPreview, setCorrectionPreview] = useState<CorrectionPreview | null>(null);
  const [correctionTeamId, setCorrectionTeamId] = useState("");
  const [correctionAmount, setCorrectionAmount] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionLoading, setCorrectionLoading] = useState(false);
  const [correctionSaving, setCorrectionSaving] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  async function openSaleCorrection(saleEventId: string, auctionId: string) {
    resultActionLock.current = true;
    setCorrectionLoading(true);
    setCorrectionError(null);
    let opened = false;
    try {
      const preview = await getCorrectionPreview(auctionId, saleEventId);
      setCorrectionPreview(preview);
      setCorrectionTeamId(preview.currentTeamId);
      setCorrectionAmount(String(preview.currentAmount));
      setCorrectionReason("");
      opened = true;
    } catch (previewError) {
      setCorrectionError(previewError instanceof Error ? previewError.message : "Unable to preview correction.");
    } finally {
      setCorrectionLoading(false);
      if (!opened) resultActionLock.current = false;
    }
  }

  useEffect(() => {
    if (!tournamentId || (gender !== "male" && gender !== "female")) {
      router.replace("/admin/tournaments");
      return undefined;
    }

    let active = true;
    void fetch(
      `/api/auctions?tournamentId=${encodeURIComponent(tournamentId)}&gender=${gender}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const result = await response.json() as { room?: AuctionRoom; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load auction.");
        if (!result.room?.auction) {
          router.replace(`/admin/tournaments/${encodeURIComponent(tournamentId)}/auction-config?gender=${gender}`);
          return null;
        }
        return result.room;
      })
      .then((loadedRoom) => {
        if (!active || !loadedRoom) return;
        startTransition(() => {
          setRoom(loadedRoom);
          setBidAmount("");
          setLoading(false);
          setError(null);
        });
        const linkedSaleEventId = searchParams.get("saleEventId");
        if (linkedSaleEventId && loadedRoom.auction?.lastSaleEventId === linkedSaleEventId) {
          resultActionLock.current = true;
          setCorrectionLoading(true);
          let opened = false;
          void getCorrectionPreview(loadedRoom.auction.id, linkedSaleEventId)
            .then((preview) => {
              if (!active) return;
              setCorrectionPreview(preview);
              setCorrectionTeamId(preview.currentTeamId);
              setCorrectionAmount(String(preview.currentAmount));
              opened = true;
            })
            .catch((previewError: unknown) => {
              if (active) setCorrectionError(previewError instanceof Error ? previewError.message : "Unable to preview correction.");
            })
            .finally(() => {
              if (active) setCorrectionLoading(false);
              if (!opened) resultActionLock.current = false;
            });
        }
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        startTransition(() => {
          setError(loadError instanceof Error ? loadError.message : "Unable to load auction.");
          setLoading(false);
        });
      });

    return () => { active = false; };
  }, [gender, retryCount, router, searchParams, tournamentId]);

  function retryLoad() {
    setLoading(true);
    setError(null);
    setRetryCount((count) => count + 1);
  }

  async function runAction(action: AuctionAction, expectedResultEventId?: string) {
    if (!room?.auction) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const initialize = action === "initialize";
      const response = await fetch(
        initialize ? "/api/auctions" : `/api/auctions/${encodeURIComponent(room.auction.id)}`,
        {
          method: initialize ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(initialize
            ? { action, tournamentId, gender }
            : { action, ...(expectedResultEventId ? { expectedResultEventId } : {}) }),
        },
      );
      const result = await response.json() as { room?: AuctionRoom; error?: string };
      if (!response.ok || !result.room) throw new Error(result.error ?? "Unable to update auction.");
      setRoom(result.room);
      setBidAmount("");
      if (action === "resume") setAutoAdvanceAttemptedEventId(null);
      setNotice(action === "sold" ? "Sale recorded. Review the result before moving on." : action === "unsold" ? "Player marked unsold. Review before moving on." : action === "next-player" ? "Advanced to the next eligible player." : null);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update auction.");
    } finally {
      setSaving(false);
    }
  }

  const pendingResult = room?.auction?.awaitingAdvance ? room.auction.lastResult : undefined;
  const pendingResultEventId = pendingResult?.eventId;
  const pendingResultDisplayUntil = pendingResult
    ? new Date(pendingResult.displayUntil).getTime()
    : null;

  useEffect(() => {
    const auction = room?.auction;
    const result = auction?.lastResult;
    if (!auction || auction.status !== "live" || !auction.awaitingAdvance || !result || saving || resultActionLock.current) return undefined;
    if (autoAdvanceAttemptedEventId === result.eventId) return undefined;

    const delay = Math.max(0, new Date(result.displayUntil).getTime() - Date.now());
    const timer = window.setTimeout(() => {
      if (autoAdvanceAttemptedEventId === result.eventId) return;
      if (resultActionLock.current) return;
      setAutoAdvanceAttemptedEventId(result.eventId);
      void (async () => {
        setSaving(true);
        setError(null);
        try {
          const response = await fetch(`/api/auctions/${encodeURIComponent(auction.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "next-player", expectedResultEventId: result.eventId }),
          });
          const responseBody = await response.json() as { room?: AuctionRoom; error?: string };
          if (!response.ok || !responseBody.room) throw new Error(responseBody.error ?? "Unable to advance the auction.");
          setRoom(responseBody.room);
          setBidAmount("");
        } catch (advanceError) {
          try {
            const refresh = await fetch(
              `/api/auctions?tournamentId=${encodeURIComponent(tournamentId)}&gender=${gender}`,
              { cache: "no-store" },
            );
            const latest = await refresh.json() as { room?: AuctionRoom };
            if (!refresh.ok || !latest.room) throw advanceError;
            setRoom(latest.room);
          } catch {
            setError(advanceError instanceof Error ? advanceError.message : "Unable to advance the auction.");
          }
        } finally {
          setSaving(false);
        }
      })();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [autoAdvanceAttemptedEventId, correctionLoading, correctionPreview, correctionSaving, gender, pendingResultDisplayUntil, pendingResultEventId, room, saving, tournamentId]);

  async function submitBid(teamId: string, customAmount?: number) {
    if (!room?.auction || saving || bidLock.current) return;
    bidLock.current = true;
    setPendingBidTeamId(teamId);
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/auctions/${encodeURIComponent(room.auction.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: customAmount === undefined ? "bid-next" : "bid",
          teamId,
          ...(customAmount === undefined ? {} : { amount: customAmount }),
          requestId: crypto.randomUUID(),
        }),
      });
      const result = await response.json() as { room?: AuctionRoom; error?: string };
      if (!response.ok || !result.room) throw new Error(result.error ?? "Unable to save bid.");
      setRoom(result.room);
      setBidAmount("");
      setNotice(`Bid accepted for ${result.room.teams.find((team) => team.id === teamId)?.name ?? "team"}.`);
    } catch (bidError) {
      setError(bidError instanceof Error ? bidError.message : "Unable to save bid.");
    } finally {
      bidLock.current = false;
      setSaving(false);
      setPendingBidTeamId(null);
    }
  }

  async function undoSale() {
    if (!room?.auction?.lastSaleEventId) return;
    resultActionLock.current = true;
    if (!window.confirm("Undo this sale? The player will return to this auction position and the team's budget and squad count will be restored.")) {
      resultActionLock.current = false;
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/auctions/${encodeURIComponent(room.auction.id)}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "undo", saleEventId: room.auction.lastSaleEventId, requestId: crypto.randomUUID() }),
      });
      const result = await response.json() as { room?: AuctionRoom; error?: string };
      if (!response.ok || !result.room) throw new Error(result.error ?? "Unable to undo sale.");
      setRoom(result.room);
      setNotice("Sale reversed. The player is back in the current auction position.");
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : "Unable to undo sale.");
    } finally {
      resultActionLock.current = false;
      setSaving(false);
    }
  }

  async function saveSaleCorrection() {
    if (!room?.auction || !correctionPreview || correctionReason.trim().length < 5) return;
    setCorrectionSaving(true);
    setCorrectionError(null);
    try {
      const response = await fetch(`/api/auctions/${encodeURIComponent(room.auction.id)}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "correct",
          saleEventId: correctionPreview.eventId,
          teamId: correctionTeamId,
          amount: Number(correctionAmount),
          reason: correctionReason,
          requestId: crypto.randomUUID(),
        }),
      });
      const result = await response.json() as { room?: AuctionRoom; error?: string };
      if (!response.ok || !result.room) throw new Error(result.error ?? "Unable to correct sale.");
      setRoom(result.room);
      resultActionLock.current = false;
      setCorrectionPreview(null);
      setNotice("Sale corrected and recorded in the audit history.");
    } catch (saveError) {
      setCorrectionError(saveError instanceof Error ? saveError.message : "Unable to correct sale.");
    } finally {
      setCorrectionSaving(false);
    }
  }

  function closeCorrectionPreview() {
    resultActionLock.current = false;
    setCorrectionPreview(null);
  }

  if (loading) {
    return <AdminShell><div className="content-wrap"><section className="panel"><p>Loading auction...</p></section></div></AdminShell>;
  }

  if (!room?.auction) {
    return <AdminShell><div className="content-wrap"><section className="panel"><h2>Unable to load auction</h2><p>{error ?? "Auction configuration was not found."}</p><button className="button button-outline" type="button" onClick={retryLoad}>Retry</button></section></div></AdminShell>;
  }

  const { auction, currentPlayer, teams: auctionTeams } = room;
  const playerIndex = auction.currentPlayerId
    ? (auction.roundPlayerIds ?? auction.playerPoolIds)?.indexOf(auction.currentPlayerId) ?? -1
    : -1;
  const statusTone = auction.status === "live" ? "live" : auction.status === "completed" ? "success" : "warning";
  const highestTeam = auctionTeams.find((team) => team.id === auction.highestTeamId);
  const minimumBid = auctionTeams.find((team) => team.id === auction.highestTeamId)?.minimumNextBid
    ?? auctionTeams.find((team) => team.canPlaceNextBid)?.minimumNextBid
    ?? currentPlayer?.auctionBasePrice
    ?? 0;
  const bidReference = auction.highestTeamId
    ? auction.currentBid ?? minimumBid
    : currentPlayer?.auctionBasePrice ?? minimumBid;
  const bidPresets = [
    ...[5000, 10000, 25000].map((increment) => ({
      label: `+${formatMoney(increment)}`,
      amount: Math.max(minimumBid, bidReference + increment),
    })),
  ];
  const correctionTarget = correctionPreview?.teams.find((team) => team.id === correctionTeamId);
  const correctedPriceValue = Number(correctionAmount);
  const correctionIsValid = Boolean(
    correctionTarget?.eligible &&
    Number.isFinite(correctedPriceValue) &&
    correctedPriceValue >= (correctionPreview?.basePrice ?? 0) &&
    correctedPriceValue <= correctionTarget.remainingBudget &&
    correctedPriceValue <= correctionTarget.maximumAffordableBid,
  );

  return (
    <AdminShell>
      <div className="content-wrap auction-room">
        <PageHeader
          eyebrow={`${gender === "female" ? "WOMEN'S" : "MEN'S"} AUCTION · ROUND ${auction.currentRound ?? 1}`}
          title="Auction room"
          action={
            <div className="room-actions">
              <StatusBadge tone={statusTone}>{auction.status.toUpperCase()}</StatusBadge>
              {auction.status === "live" && <button className="button button-quiet" type="button" disabled={saving} onClick={() => void runAction("pause")}>Pause room</button>}
              {auction.status === "paused" && <button className="button button-dark" type="button" disabled={saving} onClick={() => void runAction("resume")}>Resume room</button>}
            </div>
          }
        />

        {error && <div className="tournament-error" role="alert">{error}</div>}
        {notice && <div className="auction-notice" role="status">{notice}</div>}
        <AuctionResultFeedback
          variant="admin"
          result={auction.lastResult}
          storageKey={`admin-auction-${auction.id}`}
        />

        <div className="auction-layout">
          <section className="current-player-panel">
            {currentPlayer ? (
              <>
                <div className="player-stage" style={{ background: currentPlayer.accent ?? "#d9ef75" }}>
                  <span className="stage-number">PLAYER {playerIndex >= 0 ? playerIndex + 1 : "-"}</span>
                  <PlayerPortrait
                    className="admin-player-portrait"
                    name={currentPlayer.name}
                    initials={currentPlayer.initials ?? currentPlayer.name.slice(0, 2).toUpperCase()}
                    photoUrl={currentPlayer.photoUrl}
                  />
                  <span className="stage-role">{currentPlayer.role.toUpperCase()}</span>
                </div>
                <div className="player-stage-info">
                  <div>
                    <span className="eyebrow">{currentPlayer.id} · {currentPlayer.category}{currentPlayer.age ? ` · ${currentPlayer.age} YEARS` : ""}</span>
                    <h2>{currentPlayer.name}</h2>
                    <p>{currentPlayer.batting ?? "Batting details unavailable"} · {currentPlayer.bowling ?? "Bowling details unavailable"}</p>
                  </div>
                  <div className="base-price"><small>BASE PRICE</small><b>{formatMoney(currentPlayer.auctionBasePrice)}</b></div>
                </div>
              </>
            ) : (
              <div className="panel"><h2>{auction.roundStatus === "complete" ? "Round complete" : "No current player"}</h2><p>{room.playerCount} eligible players were included in this auction.</p></div>
            )}
          </section>

          <section className="bid-panel">
            <div className="bid-panel-top"><span className="eyebrow">CURRENT BID</span><span className="round-label">ROUND {auction.currentRound ?? 1} · LOT {playerIndex >= 0 ? playerIndex + 1 : 0}/{room.roundTotal}</span></div>
            <strong className="big-bid">{formatMoney(auction.currentBid ?? 0)}</strong>
            <div className="winning-team">
              {highestTeam ? <><span className="team-logo">{highestTeam.shortName}</span><div><small>HIGHEST BIDDER</small><b>{highestTeam.name}</b></div><span className="winning-mark">✓</span></> : <div><small>HIGHEST BIDDER</small><b>No bid yet</b></div>}
            </div>
            {auction.status === "live" && currentPlayer && !auction.awaitingAdvance && (
              <div className="auction-bid-controls">
                <div className="team-bid-heading"><div><span className="eyebrow">BID STEP · {formatMoney(auction.bidIncrement)}</span><h2>Choose a team</h2></div><label className="custom-bid-field">Custom amount<input aria-label="Optional custom bid amount" type="number" min={minimumBid} step="1" placeholder={formatMoney(minimumBid)} value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} disabled={saving} /></label></div>
                <p className="bid-turn-note">{highestTeam ? `${highestTeam.name} is leading; another team must raise the bid before they can bid again.` : "Choose any eligible team to open the bidding."}</p>
                <div className="bid-presets" aria-label="Quick bid increments">
                  <span>Quick amount</span>
                  {bidPresets.map((preset, index) => <button
                    className={`bid-preset${bidAmount === String(preset.amount) ? " selected" : ""}`}
                    key={`${preset.amount}-${index}`}
                    type="button"
                    disabled={saving}
                    aria-pressed={bidAmount === String(preset.amount)}
                    onClick={() => setBidAmount(String(preset.amount))}
                  >{preset.label}</button>)}
                </div>
                <div className="team-bid-grid">
                  {auctionTeams.map((team) => {
                    const bid = bidAmount ? Number(bidAmount) : team.minimumNextBid;
                    const canBid = team.canPlaceNextBid && Number.isFinite(bid) && bid >= team.minimumNextBid && bid <= team.remainingBudget && bid <= team.maximumAffordableBid;
                    return <button className={`team-bid-card${team.id === auction.highestTeamId ? " leading" : ""}`} key={team.id} type="button" disabled={saving || !canBid} onClick={() => void submitBid(team.id, bidAmount ? bid : undefined)} aria-label={`${team.name}, bid ${formatMoney(bid)}`}>
                      <span className="team-bid-top"><span className="team-logo">{team.shortName}</span>{team.id === auction.highestTeamId && <StatusBadge tone="live">LEADING</StatusBadge>}</span>
                      <strong>{team.name}</strong>
                      <span className="team-bid-metrics">{formatMoney(team.remainingBudget)} remaining · {team.playersCount}/{auction.maximumSquadSize} players</span>
                      <span className="team-bid-next">{saving && pendingBidTeamId === team.id ? "Saving bid..." : `Bid ${formatMoney(bid)}`}</span>
                      <span className="team-bid-limit"><b>MAX BID</b> {formatMoney(team.maximumAffordableBid)}<small> after minimum-squad reserve</small></span>
                    </button>;
                  })}
                </div>
              </div>
            )}
            {auction.awaitingAdvance && <div className="auction-outcome-review" role="status"><StatusBadge tone={currentPlayer?.auctionStatus === "sold" ? "success" : "warning"}>{currentPlayer?.auctionStatus === "sold" ? "SOLD" : "UNSOLD"}</StatusBadge><p>{currentPlayer?.name} · {currentPlayer?.auctionStatus === "sold" ? `${formatMoney(auction.currentBid ?? 0)} to ${highestTeam?.name ?? "team"}` : "No sale recorded"}</p></div>}
            {auction.awaitingAdvance && currentPlayer?.auctionStatus === "sold" && auction.lastSaleEventId && <div className="sale-recovery-actions"><button className="button button-outline" type="button" disabled={saving} onClick={() => void undoSale()}>Undo sale</button><button className="button button-outline" type="button" disabled={saving || correctionLoading} onClick={() => void openSaleCorrection(auction.lastSaleEventId!, auction.id)}>{correctionLoading ? "Loading preview..." : "Correct sale"}</button></div>}
          </section>

          <aside className="panel team-board">
            <SectionHeading title="Eligible teams" />
            {auctionTeams.length === 0 ? <p>No eligible teams are configured.</p> : auctionTeams.map((team) => (
              <div className="team-board-row" key={team.id}>
                <span className="team-logo">{team.shortName}</span>
                <div>
                  <b>{team.name}</b>
                  <small>{formatMoney(team.remainingBudget)} remaining · {team.playersCount}/{auction.maximumSquadSize} players</small>
                  <small className="team-board-max-bid">MAX BID {formatMoney(team.maximumAffordableBid)}</small>
                </div>
              </div>
            ))}
          </aside>
        </div>

        <div className="room-lower">
          {auction.status === "draft" && <button className="button button-dark" type="button" disabled={saving} onClick={() => void runAction("initialize")}>{saving ? "Initializing..." : "Initialize auction"}</button>}
          {auction.status === "ready" && <button className="button button-dark" type="button" disabled={saving} onClick={() => void runAction("start")}>{saving ? "Starting..." : "Start auction"}</button>}
          {auction.status === "live" && currentPlayer && !auction.awaitingAdvance && <>
            <button className="button button-sold" type="button" disabled={saving || !auction.highestTeamId} onClick={() => { if (window.confirm(`Confirm ${currentPlayer.name} SOLD to ${highestTeam?.name ?? "the highest-bid team"} for ${formatMoney(auction.currentBid ?? 0)}?`)) void runAction("sold"); }}>SOLD</button>
            <button className="button button-unsold" type="button" disabled={saving} onClick={() => { if (window.confirm(`Mark ${currentPlayer.name} UNSOLD?`)) void runAction("unsold"); }}>UNSOLD</button>
          </>}
          {auction.status === "live" && auction.awaitingAdvance && <button className="button button-dark" type="button" disabled={saving || Boolean(auction.lastResult && autoAdvanceAttemptedEventId !== auction.lastResult.eventId)} onClick={() => void runAction("next-player", auction.lastResult?.eventId)}>Next player →</button>}
          {auction.status === "live" && auction.roundStatus === "complete" && room.roundUnsoldCount > 0 && <button className="button button-dark" type="button" disabled={saving} onClick={() => void runAction("next-round")}>Start round {(auction.currentRound ?? 1) + 1} · {room.roundUnsoldCount} unsold</button>}
          {auction.status === "live" && auction.roundStatus === "complete" && room.roundUnsoldCount === 0 && <button className="button button-sold" type="button" disabled={saving} onClick={() => void runAction("complete")}>Complete auction</button>}
          {auction.status === "completed" && <StatusBadge tone="success">AUCTION COMPLETED</StatusBadge>}
        </div>
        {auction.currentRound && <p className="muted-label">Round {auction.currentRound}: {room.roundSoldCount} sold · {room.roundUnsoldCount} unsold · {room.roundTotal} players</p>}
      </div>
      {correctionPreview && typeof document !== "undefined" && createPortal(
        <div
          className="auction-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !correctionSaving) closeCorrectionPreview();
          }}
        >
          <section className="auction-correction-modal" role="dialog" aria-modal="true" aria-labelledby="correction-title">
            <div className="auction-modal-heading">
              <div>
                <span className="eyebrow">SALE CORRECTION</span>
                <h2 id="correction-title">Correct {correctionPreview.player.name}</h2>
                <p>{correctionPreview.player.id}{correctionPreview.player.role ? ` · ${correctionPreview.player.role}` : ""}</p>
              </div>
              <button className="icon-button" type="button" aria-label="Close correction dialog" onClick={closeCorrectionPreview}>×</button>
            </div>

            <div className="correction-origin">
              <div><span>Original team</span><strong>{correctionPreview.teams.find((team) => team.id === correctionPreview.currentTeamId)?.name ?? "Unavailable"}</strong></div>
              <div><span>Original price</span><strong>{formatMoney(correctionPreview.currentAmount)}</strong></div>
              <div><span>Base price</span><strong>{formatMoney(correctionPreview.basePrice)}</strong></div>
            </div>

            <div className="correction-form-grid">
              <label className="correction-field">
                <span>Correct team</span>
                <select autoFocus value={correctionTeamId} onChange={(event) => setCorrectionTeamId(event.target.value)}>
                  {correctionPreview.teams.map((team) => <option key={team.id} value={team.id} disabled={!team.eligible}>{team.name}</option>)}
                </select>
              </label>
              <label className="correction-field">
                <span>Correct price</span>
                <input type="number" min={correctionPreview.basePrice} step="1" value={correctionAmount} onChange={(event) => setCorrectionAmount(event.target.value)} />
              </label>
              <label className="correction-field correction-field-full">
                <span>Reason for correction</span>
                <textarea minLength={5} maxLength={500} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Record why this sale is being corrected." />
                <small>{correctionReason.trim().length}/500 characters · minimum 5</small>
              </label>
            </div>

            <div className="correction-preview-summary">
              <div className="correction-preview-heading"><span>RESULTING TEAM POSITION</span><StatusBadge tone={correctionIsValid ? "success" : "warning"}>{correctionIsValid ? "VALID" : "CHECK VALUES"}</StatusBadge></div>
              <strong>{correctionTarget?.name ?? "Select an eligible team"}</strong>
              <div className="correction-preview-metrics">
                <div><span>Sale price</span><b>{formatMoney(Number.isFinite(correctedPriceValue) ? correctedPriceValue : 0)}</b></div>
                <div><span>Remaining purse</span><b>{formatMoney(Math.max(0, (correctionTarget?.remainingBudget ?? 0) - (Number.isFinite(correctedPriceValue) ? correctedPriceValue : 0)))}</b></div>
                <div><span>Squad size</span><b>{(correctionTarget?.playersCount ?? 0) + 1} players</b></div>
              </div>
              {!correctionIsValid && <small className="correction-validation">Team must have a roster slot and enough available purse after its minimum-squad reserve.</small>}
            </div>

            {correctionError && <div className="tournament-error" role="alert">{correctionError}</div>}
            <div className="correction-modal-actions">
              <button
                className="button button-dark"
                type="button"
                disabled={correctionSaving || correctionReason.trim().length < 5 || !correctionIsValid}
                onClick={() => {
                  if (window.confirm("Apply this sale correction? The original sale remains in the permanent audit trail.")) void saveSaleCorrection();
                }}
              >{correctionSaving ? "Saving correction..." : "Confirm correction"}</button>
              <button className="button button-outline" type="button" disabled={correctionSaving} onClick={closeCorrectionPreview}>Cancel</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </AdminShell>
  );
}

export default function AdminAuctionPage() {
  return (
    <Suspense fallback={<AdminShell><div className="content-wrap"><section className="panel"><p>Loading auction room...</p></section></div></AdminShell>}>
      <AdminAuctionContent />
    </Suspense>
  );
}
