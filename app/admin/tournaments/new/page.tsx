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
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          season: Number(season),
          description,
          competitions: { male, female },
        }),
      });
      const result = await response.json() as { tournament?: { id: string }; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to create tournament.");
      router.push("/admin/tournaments");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create tournament.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <div className="content-wrap">
        <PageHeader
          eyebrow="TOURNAMENT SETUP"
          title="Create tournament"
          description="Establish the tournament and decide which independent competitions will exist inside it."
          action={<Link className="button button-outline" href="/admin/tournaments">← Back</Link>}
        />

        <form className="panel" onSubmit={submit}>
          <div className="players-filter-bar" style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: "1rem" }}>
            <label>
              <span className="eyebrow">TOURNAMENT NAME</span>
              <input className="players-search-box" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. PNPL" required />
            </label>
            <label>
              <span className="eyebrow">SEASON</span>
              <input className="players-search-box" type="number" min="2000" max="2100" value={season} onChange={(event) => setSeason(event.target.value)} required />
            </label>
          </div>

          <label style={{ display: "block", marginTop: "1rem" }}>
            <span className="eyebrow">DESCRIPTION</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional tournament description" rows={4} style={{ width: "100%", padding: "0.9rem", borderRadius: "0.75rem", border: "1px solid #d8d8d8", marginTop: "0.4rem" }} />
          </label>

          <div style={{ marginTop: "1.4rem" }}>
            <div className="eyebrow">COMPETITIONS</div>
            <p>Select the independent competitions that belong to this tournament.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem", marginTop: "0.8rem" }}>
              <label className="panel" style={{ cursor: "pointer", margin: 0 }}>
                <input type="checkbox" checked={male} onChange={(event) => setMale(event.target.checked)} />
                <strong style={{ marginLeft: "0.6rem" }}>Men&apos;s competition</strong>
                <p>Separate teams, player pool, auction and results.</p>
              </label>
              <label className="panel" style={{ cursor: "pointer", margin: 0 }}>
                <input type="checkbox" checked={female} onChange={(event) => setFemale(event.target.checked)} />
                <strong style={{ marginLeft: "0.6rem" }}>Women&apos;s competition</strong>
                <p>Separate teams, player pool, auction and results.</p>
              </label>
            </div>
          </div>

          {error && <p style={{ marginTop: "1rem" }} role="alert">{error}</p>}

          <div style={{ display: "flex", gap: "0.8rem", marginTop: "1.5rem" }}>
            <button className="button button-dark" type="submit" disabled={saving}>{saving ? "Creating..." : "Create tournament"}</button>
            <Link className="button button-outline" href="/admin/tournaments">Cancel</Link>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}
