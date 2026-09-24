"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { PageHeader, StatusBadge } from "@/components/ui/Primitives";
import type { Tournament } from "@/types/tournament";

export default function TournamentOverviewPage() {
  const params = useParams<{ tournamentId: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tournaments/${params.tournamentId}`)
      .then(async (response) => {
        const result = await response.json() as { tournament?: Tournament; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load tournament.");
        setTournament(result.tournament ?? null);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load tournament."));
  }, [params.tournamentId]);

  if (error) {
    return <AdminShell><div className="content-wrap"><div className="panel"><p>{error}</p><Link className="button button-outline" href="/admin/tournaments">Back to tournaments</Link></div></div></AdminShell>;
  }

  if (!tournament) {
    return <AdminShell><div className="content-wrap"><div className="panel"><p>Loading tournament...</p></div></div></AdminShell>;
  }

  const competitions = [
    tournament.competitions.male.enabled ? { key: "male", title: "Men's competition", description: "Men's teams, player pool, auction and results." } : null,
    tournament.competitions.female.enabled ? { key: "female", title: "Women's competition", description: "Women's teams, player pool, auction and results." } : null,
  ].filter(Boolean) as { key: string; title: string; description: string }[];

  return (
    <AdminShell>
      <div className="content-wrap tournament-content">
        <Link className="back-link" href="/admin/tournaments">← All tournaments</Link>
        <PageHeader
          eyebrow={`${tournament.season} SEASON`}
          title={tournament.name}
          description={tournament.description || "Tournament control centre."}
          action={<StatusBadge tone={tournament.status === "active" ? "live" : tournament.status === "completed" ? "success" : "neutral"}>{tournament.status.toUpperCase()}</StatusBadge>}
        />
        <section className="competition-overview">
          {competitions.map((competition) => (
            <article className="competition-overview-card" key={competition.key}>
              <span className="eyebrow">{competition.key === "male" ? "MEN'S" : "WOMEN'S"}</span>
              <h2>{competition.title}</h2>
              <p>{competition.description}</p>
              <div className="competition-links">
                <Link href={`/admin/teams?tournamentId=${tournament.id}&gender=${competition.key}`}>Teams →</Link>
                <Link href={`/admin/players?tournamentId=${tournament.id}&gender=${competition.key}`}>Players →</Link>
                <Link href={`/admin/auction?tournamentId=${tournament.id}&gender=${competition.key}`}>Auction →</Link>
              </div>
            </article>
          ))}
        </section>
      </div>
    </AdminShell>
  );
}
