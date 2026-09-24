"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { PageHeader, SectionHeading, StatusBadge } from "@/components/ui/Primitives";
import type { Tournament } from "@/types/tournament";

function competitionLabel(tournament: Tournament) {
  const labels: string[] = [];
  if (tournament.competitions.male.enabled) labels.push("Men's");
  if (tournament.competitions.female.enabled) labels.push("Women's");
  return labels.join(" + ");
}

export default function AdminTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadTournaments = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/tournaments");
      const result = await response.json() as { tournaments?: Tournament[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load tournaments.");
      setTournaments(result.tournaments ?? []);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load tournaments."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadTournaments(); }, [loadTournaments]);
  return (
    <AdminShell>
      <div className="content-wrap tournament-content">
        <PageHeader eyebrow="TOURNAMENTS" title="Tournaments" description="Create and manage tournament seasons and their separate men's and women's competitions." action={<Link className="button button-dark" href="/admin/tournaments/new">+ New tournament</Link>} />
        {loading && <div className="panel"><p>Loading tournaments...</p></div>}
        {!loading && error && <div className="panel"><p>{error}</p><button className="button button-dark" type="button" onClick={() => void loadTournaments()}>Retry</button></div>}
        {!loading && !error && tournaments.length === 0 && <section className="panel tournament-empty"><SectionHeading title="No tournaments yet" /><p>Create the first tournament to establish the competition structure before adding teams or running an auction.</p><Link className="button button-dark" href="/admin/tournaments/new">Create tournament</Link></section>}
        {!loading && !error && tournaments.length > 0 && <div className="tournament-grid">{tournaments.map((tournament) => (
          <Link className="tournament-card" href={`/admin/tournaments/${tournament.id}`} key={tournament.id}>
            <div className="tournament-card-top"><span className="tournament-season">{tournament.season}</span><StatusBadge tone={tournament.status === "active" ? "live" : tournament.status === "completed" ? "success" : "neutral"}>{tournament.status.toUpperCase()}</StatusBadge></div>
            <h2>{tournament.name}</h2><p>{tournament.description || "Tournament setup and competition management."}</p>
            <div className="tournament-card-meta"><span>{competitionLabel(tournament)}</span><strong>Open tournament →</strong></div>
          </Link>
        ))}</div>}
      </div>
    </AdminShell>
  );
}