import Link from "next/link";
import { connection } from "next/server";
import PublicHeader from "@/components/public/PublicHeader";
import PublicTournamentFilters from "@/components/public/PublicTournamentFilters";
import ResultsReport from "@/components/auction/ResultsReport";
import { PageHeader, StatusBadge } from "@/components/ui/Primitives";
import { getAuctionResults } from "@/lib/services/auction-results";
import { getTournaments } from "@/lib/services/tournaments";
import type { CompetitionGender } from "@/types/tournament";

type PageSearchParams = Promise<{ tournamentId?: string; gender?: string }>;

export default async function PublicResultsPage({ searchParams }: { searchParams: PageSearchParams }) {
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
  const reports = competitionEnabled && selectedTournament && gender
    ? await getAuctionResults(selectedTournament.id, gender)
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
      <PublicHeader><StatusBadge tone="neutral">PUBLIC</StatusBadge><span>TOURNAMENT RESULTS</span></PublicHeader>
      <div className="content-wrap">
        <PageHeader
          eyebrow={selectedTournament && gender && competitionEnabled
            ? `${gender === "male" ? "MEN'S" : "WOMEN'S"} · ${selectedTournament.season}`
            : "TOURNAMENT RESULTS"}
          title="Results"
          description={selectedTournament && gender && competitionEnabled
            ? `${selectedTournament.name} · ${gender === "male" ? "Men's" : "Women's"} competition`
            : "Choose a tournament and competition to view its persisted auction results."}
          action={<Link className="button button-outline" href="/live">Live auctions</Link>}
        />
        <PublicTournamentFilters
          tournaments={publicTournaments}
          pathname="/results"
          tournamentId={selectedTournament?.id}
          gender={gender}
        />
        {selectedTournament && gender && !competitionEnabled && (
          <section className="panel history-state"><h2>Competition unavailable</h2><p>This tournament does not have an enabled {gender === "male" ? "men's" : "women's"} competition.</p></section>
        )}
        {reports && (reports.length > 0
          ? <ResultsReport reports={reports} />
          : <section className="panel history-state"><h2>No auction results yet</h2><p>Results appear here after this tournament competition has an initialized auction and recorded player outcomes.</p></section>)}
      </div>
    </main>
  );
}
