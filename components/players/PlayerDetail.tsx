"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import AdminShell from "@/components/admin/AdminShell";
import AppShell from "@/components/layout/AppShell";
import { normalizePlayerGender } from "@/lib/players";
import type { MongoPlayer } from "@/lib/services/players";
import type { PlayerGender } from "@/types/firestore";
import { PageHeader, SectionHeading, StatusBadge } from "@/components/ui/Primitives";

type PlayerRecord = MongoPlayer & { gender?: PlayerGender };
type PlayerForm = {
  name: string;
  gender: "" | PlayerGender;
  role: string;
  category: string;
  age: string;
  basePrice: string;
  photoUrl: string;
  dateOfBirth: string;
  wingFlatNumber: string;
  phoneNumber: string;
  battingStyle: string;
  bowlingStyle: string;
  instagramId: string;
};

function toForm(player: PlayerRecord): PlayerForm {
  return {
    name: player.name ?? player.fullName ?? "",
    gender: player.gender ?? "",
    role: player.role ?? "",
    category: player.category ?? "",
    age: player.age?.toString() ?? "",
    basePrice: player.basePrice?.toString() ?? "0",
    photoUrl: player.photoUrl ?? "",
    dateOfBirth: player.dateOfBirth ?? "",
    wingFlatNumber: player.wingFlatNumber ?? "",
    phoneNumber: player.phoneNumber ?? "",
    battingStyle: player.battingStyle ?? player.batting ?? "",
    bowlingStyle: player.bowlingStyle ?? player.bowling ?? "",
    instagramId: player.instagramId ?? "",
  };
}

function getInitials(player: PlayerRecord) {
  return player.initials ?? (player.name ?? player.fullName ?? "Player").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function PlayerDetail({ playerId, initialPlayer, adminMode = false }: { playerId: string; initialPlayer?: PlayerRecord; adminMode?: boolean }) {
  const [player, setPlayer] = useState<PlayerRecord | null>(initialPlayer ?? null);
  const [form, setForm] = useState<PlayerForm | null>(initialPlayer ? toForm(initialPlayer) : null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(!initialPlayer);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadPlayer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/players/${encodeURIComponent(playerId)}`);
      const result = await response.json() as { player?: PlayerRecord; error?: string };
      if (!response.ok || !result.player) throw new Error(result.error ?? "Unable to load this player.");
      setPlayer(result.player);
      setForm(toForm(result.player));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load this player.");
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    if (initialPlayer) return;
    const request = window.setTimeout(() => void loadPlayer(), 0);
    return () => window.clearTimeout(request);
  }, [initialPlayer, loadPlayer]);

  async function savePlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/players/${encodeURIComponent(playerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          fullName: form.name.trim(),
          gender: normalizePlayerGender(form.gender),
          role: form.role.trim(),
          category: form.category.trim(),
          age: form.age ? Number(form.age) : undefined,
          basePrice: Number(form.basePrice),
          photoUrl: form.photoUrl.trim() || undefined,
          dateOfBirth: form.dateOfBirth.trim() || undefined,
          wingFlatNumber: form.wingFlatNumber.trim() || undefined,
          phoneNumber: form.phoneNumber.trim() || undefined,
          battingStyle: form.battingStyle.trim() || undefined,
          bowlingStyle: form.bowlingStyle.trim() || undefined,
          batting: form.battingStyle.trim() || undefined,
          bowling: form.bowlingStyle.trim() || undefined,
          instagramId: form.instagramId.trim() || undefined,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save player.");
      await loadPlayer();
      setEditing(false);
      setMessage("Player changes saved to MongoDB.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save player.");
    } finally {
      setSaving(false);
    }
  }

  const Shell = adminMode ? AdminShell : AppShell;
  const backHref = adminMode ? "/admin/players" : "/players";

  if (loading) {
    return <Shell><div className="content-wrap"><div className="players-empty-state"><p>Loading player details...</p></div></div></Shell>;
  }

  if (error && !player) {
    return <Shell><div className="content-wrap"><Link className="back-link" href={backHref}>← All players</Link><div className="players-empty-state"><h2>Unable to load player</h2><p>{error}</p><button className="button button-dark" type="button" onClick={() => void loadPlayer()}>Retry</button></div></div></Shell>;
  }

  if (!player || !form) return null;

  const playerName = player.name ?? player.fullName ?? "Unnamed player";
  const status = player.status.toUpperCase();

  return (
    <Shell>
      <div className="content-wrap">
        <Link className="back-link" href={backHref}>← All players</Link>
        <PageHeader
          eyebrow="PLAYER DETAILS"
          title={playerName}
          description={`${player.role} · ${player.age ?? "Age not set"}${player.gender ? ` · ${player.gender}` : ""}`}
          action={adminMode && !editing ? <button className="button button-dark" type="button" onClick={() => { setMessage(null); setEditing(true); }}>Edit player</button> : undefined}
        />
        {message && <p className="player-success-message" role="status">{message}</p>}
        {error && <p className="player-error-message" role="alert">{error}</p>}

        {editing ? (
          <form className="form-panel player-edit-form" onSubmit={savePlayer}>
            <div className="section-heading"><h2>Edit player</h2><button className="button button-outline" type="button" onClick={() => { setForm(toForm(player)); setEditing(false); }}>Cancel</button></div>
            <div className="form-grid">
              <label>Full name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
              <label>Gender<select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as PlayerForm["gender"] })}><option value="">Not set</option><option value="male">Male</option><option value="female">Female</option></select></label>
              <label>Role<input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} required /></label>
              <label>Category<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
              <label>Age<input type="number" min="1" max="120" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} /></label>
              <label>Base price<input type="number" min="0" step="any" value={form.basePrice} onChange={(event) => setForm({ ...form, basePrice: event.target.value })} required /></label>
              <label className="full-field">Photo URL / reference<input value={form.photoUrl} onChange={(event) => setForm({ ...form, photoUrl: event.target.value })} /></label>
              <label>Date of birth<input value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} /></label>
              <label>Wing / flat number<input value={form.wingFlatNumber} onChange={(event) => setForm({ ...form, wingFlatNumber: event.target.value })} /></label>
              <label>Phone number<input value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} /></label>
              <label>Instagram ID<input value={form.instagramId} onChange={(event) => setForm({ ...form, instagramId: event.target.value })} /></label>
              <label>Batting style<input value={form.battingStyle} onChange={(event) => setForm({ ...form, battingStyle: event.target.value })} /></label>
              <label>Bowling style<input value={form.bowlingStyle} onChange={(event) => setForm({ ...form, bowlingStyle: event.target.value })} /></label>
            </div>
            <div className="form-actions"><button className="button button-dark" type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button></div>
          </form>
        ) : (
          <>
            <div className="player-detail-hero">
              {player.photoUrl ? <img src={player.photoUrl} alt={`${playerName} portrait`} /> : <div className="player-detail-fallback" style={{ background: player.accent ?? "#d9ef75" }}>{getInitials(player)}</div>}
              <div className="player-detail-summary"><StatusBadge tone={status === "SOLD" ? "success" : status === "UNSOLD" ? "warning" : status === "ON_AUCTION" ? "live" : "neutral"}>{status.replace("_", " ")}</StatusBadge><h2>{player.role}</h2><p>{player.gender ? `${player.gender} · ` : "Gender not set · "}{player.category ?? "Uncategorized"}</p></div>
            </div>
            <section className="panel"><SectionHeading title="Player information" /><div className="player-info-grid"><div><small>Base price</small><strong>{player.basePrice} cr</strong></div><div><small>Age</small><strong>{player.age ?? "—"}</strong></div><div><small>Batting</small><strong>{player.battingStyle ?? player.batting ?? "—"}</strong></div><div><small>Bowling</small><strong>{player.bowlingStyle ?? player.bowling ?? "—"}</strong></div><div><small>Phone</small><strong>{player.phoneNumber ?? "—"}</strong></div><div><small>Player ID</small><strong>{player.id}</strong></div></div></section>
          </>
        )}
      </div>
    </Shell>
  );
}
