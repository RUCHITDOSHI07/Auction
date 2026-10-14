"use client";

import { useEffect, useRef, useState } from "react";
import PlayerPortrait from "@/components/auction/PlayerPortrait";
import { auctionResultDisplayMs, shouldPresentAuctionResult } from "@/lib/auction/results";

export type AuctionResultDisplay = {
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
  createdAt: Date | string;
  displayUntil: Date | string;
};

type AuctionResultFeedbackProps = {
  variant: "admin" | "public";
  result: AuctionResultDisplay | null | undefined;
  storageKey: string;
};

function money(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function playResultSound(context: AudioContext, outcome: AuctionResultDisplay["outcome"]) {
  const notes = outcome === "sold" ? [660, 880] : [260, 190];
  const startAt = context.currentTime;

  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStart = startAt + index * 0.12;
    oscillator.type = outcome === "sold" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.08, noteStart + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + 0.19);
  });
}

export default function AuctionResultFeedback({ variant, result, storageKey }: AuctionResultFeedbackProps) {
  const [visibleEventId, setVisibleEventId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const handledEventId = useRef<string | null>(null);
  const visibleUntil = useRef(0);
  const resultRef = useRef(result);
  const isVisible = Boolean(result && visibleEventId === result.eventId);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  const resultEventId = result?.eventId;

  useEffect(() => {
    const currentResult = resultRef.current;
    if (!currentResult || currentResult.eventId !== resultEventId) return undefined;

    const resultToShow = currentResult;
    if (handledEventId.current === resultToShow.eventId) {
      if (visibleEventId !== resultToShow.eventId && visibleUntil.current <= Date.now()) return undefined;
      const remaining = Math.max(0, visibleUntil.current - Date.now());
      const revealTimer = visibleEventId === resultToShow.eventId
        ? undefined
        : window.setTimeout(() => setVisibleEventId(resultToShow.eventId), 0);
      const timer = window.setTimeout(() => {
        setVisibleEventId((visibleId) => visibleId === resultToShow.eventId ? null : visibleId);
      }, remaining);
      return () => {
        if (revealTimer !== undefined) window.clearTimeout(revealTimer);
        window.clearTimeout(timer);
      };
    }

    handledEventId.current = resultToShow.eventId;
    try {
      if (sessionStorage.getItem(storageKey) === resultToShow.eventId) return undefined;
      sessionStorage.setItem(storageKey, resultToShow.eventId);
    } catch {
      // Session storage may be unavailable in restricted browser contexts.
    }

    if (!shouldPresentAuctionResult(resultToShow.eventId, null, resultToShow.createdAt)) return undefined;

    visibleUntil.current = Date.now() + auctionResultDisplayMs;
    const revealTimer = window.setTimeout(() => setVisibleEventId(resultToShow.eventId), 0);
    if (soundEnabled && audioContext.current?.state === "running") {
      playResultSound(audioContext.current, resultToShow.outcome);
    }

    const timer = window.setTimeout(() => {
      setVisibleEventId((visibleId) => visibleId === resultToShow.eventId ? null : visibleId);
    }, auctionResultDisplayMs);
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(timer);
    };
  }, [resultEventId, soundEnabled, storageKey, visibleEventId]);

  function toggleSound() {
    if (!soundEnabled) {
      try {
        audioContext.current ??= new AudioContext();
        void audioContext.current.resume().catch(() => undefined);
      } catch {
        return;
      }
    }
    setSoundEnabled((enabled) => !enabled);
  }

  const soundControl = (
    <button
      className={`auction-sound-toggle${soundEnabled ? " is-enabled" : ""}`}
      type="button"
      aria-pressed={soundEnabled}
      onClick={toggleSound}
    >
      Sound {soundEnabled ? "on" : "off"}
    </button>
  );

  if (variant === "admin") {
    return (
      <div className="admin-result-feedback">
        {soundControl}
        {isVisible && result && <article className={`admin-result-banner result-${result.outcome}`} role="status" aria-live="assertive">
          <PlayerPortrait className="auction-result-portrait" name={result.playerName} initials={result.playerInitials} photoUrl={result.playerPhotoUrl} />
          <div className="admin-result-copy">
            <strong>{result.outcome === "sold" ? "SOLD" : "UNSOLD"}</strong>
            <span>{result.playerName}</span>
            {result.outcome === "sold" && <small>{result.teamName} · {money(result.amount ?? 0)}</small>}
          </div>
        </article>}
      </div>
    );
  }

  return (
    <>
      <div className="public-result-sound-control">{soundControl}</div>
      {isVisible && result && <div className={`public-result-overlay result-${result.outcome}`} role="status" aria-live="assertive">
        <article className="public-result-card">
          <PlayerPortrait className="auction-result-portrait" name={result.playerName} initials={result.playerInitials} photoUrl={result.playerPhotoUrl} />
          <div className="public-result-copy">
            <span className="eyebrow">PLAYER {result.playerId}</span>
            <strong>{result.outcome === "sold" ? "SOLD" : "UNSOLD"}</strong>
            <h2>{result.playerName}</h2>
            {result.outcome === "sold"
              ? <p>{result.teamName}<b>{money(result.amount ?? 0)}</b></p>
              : <p>No sale recorded</p>}
          </div>
        </article>
      </div>}
    </>
  );
}