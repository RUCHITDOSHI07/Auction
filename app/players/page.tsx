import Link from "next/link";
import { connection } from "next/server";
import PublicHeader from "@/components/public/PublicHeader";
import PublicTournamentFilters from "@/components/public/PublicTournamentFilters";
import PlayerDirectory from "@/components/players/PlayerDirectory";
import { PageHeader, StatusBadge } from "@/components/ui/Primitives";
import { getPublicTournamentPlayers } from "@/lib/services/public-tournament-players";
import { getTournaments } from "@/lib/services/tournaments";
import type { CompetitionGender } from "@/types/tournament";

type PageSearchParams = Promise<{ tournamentId?: string; gender?: string }>;

export default async function PlayersPage({ searchParams }: { searchParams: PageSearchParams }) {
  await connection();
  const [{ tournamentId, gender: genderParam }, tournaments] = await Promise.all([
    searchParams,
    getTournaments(),
  ]);
  const selectedTournament = tournaments.find((tournament) => tournament.id === tournamentId);
  const gender: CompetitionGender | undefined = genderParam === "male" || genderParam === "female"
    ? genderParam
    : undefined;
  const competitionEnabled = Boolean(selectedTournament && gender && selectedTournament.competitions[gender].enabled);
  const players = competitionEnabled && selectedTournament && gender
    ? await getPublicTournamentPlayers(selectedTournament.id, gender)
    : null;
  const publicTournaments = tournaments.map(({ id, name, season, competitions }) => ({
    id,
    name,
    season,
    competitions: {
      male: { enabled: competitions.male.enabled },
      female: { enabled: competitions.female.enabled },
    },
  }));

  return (
    <main className="public-live">
      <PublicHeader><StatusBadge tone="neutral">PUBLIC</StatusBadge><span>TOURNAMENT PLAYERS</span></PublicHeader>
      <div className="content-wrap">
        <PageHeader
          eyebrow={selectedTournament && gender && competitionEnabled
            ? `${gender === "male" ? "MEN'S" : "WOMEN'S"} · ${selectedTournament.season}`
            : "TOURNAMENT DIRECTORY"}
          title="Players"
          description={selectedTournament && gender && competitionEnabled
            ? `${selectedTournament.name} · ${players?.length ?? 0} players`
            : "Choose a tournament and competition to view its player pool."}
          action={<Link className="button button-outline" href="/live">Live auctions</Link>}
        />
        <PublicTournamentFilters
          tournaments={publicTournaments}
          pathname="/players"
          tournamentId={selectedTournament?.id}
          gender={gender}
        />
        {selectedTournament && gender && !competitionEnabled && (
          <section className="panel history-state"><h2>Competition unavailable</h2><p>This tournament does not have an enabled {gender === "male" ? "men's" : "women's"} competition.</p></section>
        )}
        {players && selectedTournament && gender && (
          <section className="public-tournament-player-list">
            <PlayerDirectory players={players} />
          </section>
        )}
      </div>
    </main>
  );
}
