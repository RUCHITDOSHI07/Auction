"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { PageHeader } from "@/components/ui/Primitives";

export default function NewTournamentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [description, setDescription] = useState("");
  const [male, setMale] = useState(true);
  const [female, setFemale] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      const response = await fetch("/api/tournaments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, season: Number(season), description, competitions: { male, female } }) });
      const result = await response.json() as { tournament?: { id: string }; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to create tournament.");
      router.push(`/admin/tournaments/${result.tournament?.id ?? ""}`);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to create tournament."); }
    finally { setSaving(false); }
  }

  return (
    <AdminShell>
      <div className="content-wrap tournament-content">
        <PageHeader eyebrow="TOURNAMENT SETUP" title="Create tournament" description="Set up one tournament first. Men's and women's competitions remain completely independent inside it." action={<Link className="button button-outline" href="/admin/tournaments">← Back</Link>} />
        <form className="tournament-form" onSubmit={submit}>
          <div className="tournament-form-grid">
            <label><span className="eyebrow">TOURNAMENT NAME</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. PNPL" required /></label>
            <label><span className="eyebrow">SEASON</span><input type="number" min="2000" max="2100" value={season} onChange={(event) => setSeason(event.target.value)} required /></label>
            <label className="tournament-full-field"><span className="eyebrow">DESCRIPTION</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional tournament description" rows={4} /></label>
          </div>
          <div className="tournament-section"><span className="eyebrow">COMPETITIONS</span><p className="tournament-help">Choose which independent competitions will exist in this tournament.</p>
            <div className="competition-choice-grid">
              <label className={`competition-choice ${male ? "selected" : ""}`}><input type="checkbox" checked={male} onChange={(event) => setMale(event.target.checked)} /><span><strong>Men&apos;s competition</strong><small>Separate teams, players, auction and results.</small></span></label>
              <label className={`competition-choice ${female ? "selected" : ""}`}><input type="checkbox" checked={female} onChange={(event) => setFemale(event.target.checked)} /><span><strong>Women&apos;s competition</strong><small>Separate teams, players, auction and results.</small></span></label>
            </div>
          </div>
          {error && <p className="tournament-error" role="alert">{error}</p>}
          <div className="tournament-actions"><button className="button button-dark" type="submit" disabled={saving}>{saving ? "Creating..." : "Create tournament"}</button><Link className="button button-outline" href="/admin/tournaments">Cancel</Link></div>
        </form>
      </div>
    </AdminShell>
  );
}