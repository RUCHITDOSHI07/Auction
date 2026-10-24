"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { CompetitionGender } from "@/types/tournament";

export type PublicTournamentOption = {
  id: string;
  name: string;
  season: number;
  competitions: Record<CompetitionGender, { enabled: boolean }>;
};

export default function PublicTournamentFilters({
  tournaments,
  pathname,
  tournamentId,
  gender,
}: {
  tournaments: PublicTournamentOption[];
  pathname: "/players" | "/results";
  tournamentId?: string;
  gender?: CompetitionGender;
}) {
  const router = useRouter();
  const [selectedTournamentId, setSelectedTournamentId] = useState(tournamentId ?? "");
  const selectedTournament = tournaments.find((tournament) => tournament.id === selectedTournamentId);
  const [selectedGender, setSelectedGender] = useState<CompetitionGender>(() => {
    if (selectedTournament?.competitions[gender ?? "male"].enabled) return gender ?? "male";
    if (selectedTournament?.competitions.male.enabled) return "male";
    return "female";
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTournamentId) return;
    const query = new URLSearchParams({ tournamentId: selectedTournamentId, gender: selectedGender });
    router.push(`${pathname}?${query.toString()}`);
  }

  if (tournaments.length === 0) {
    return <section className="panel history-state"><h2>No tournaments available</h2><p>Tournament data will appear here when available.</p></section>;
  }

  return (
    <form className="public-tournament-filters" onSubmit={submit}>
      <label>
        Tournament
        <select
          value={selectedTournamentId}
          onChange={(event) => {
            const nextTournamentId = event.target.value;
            const nextTournament = tournaments.find((tournament) => tournament.id === nextTournamentId);
            setSelectedTournamentId(nextTournamentId);
            if (!nextTournament?.competitions[selectedGender].enabled) {
              setSelectedGender(nextTournament?.competitions.male.enabled ? "male" : "female");
            }
          }}
          required
        >
          <option value="" disabled>Select a tournament</option>
          {tournaments.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>{tournament.name} · {tournament.season}</option>
          ))}
        </select>
      </label>
      <label>
        Competition
        <select value={selectedGender} onChange={(event) => setSelectedGender(event.target.value as CompetitionGender)}>
          <option value="male" disabled={Boolean(selectedTournament && !selectedTournament.competitions.male.enabled)}>Men&apos;s</option>
          <option value="female" disabled={Boolean(selectedTournament && !selectedTournament.competitions.female.enabled)}>Women&apos;s</option>
        </select>
      </label>
      <button className="button button-dark" type="submit" disabled={!selectedTournamentId}>View</button>
    </form>
  );
}
