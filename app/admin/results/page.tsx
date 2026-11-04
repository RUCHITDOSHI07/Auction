import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import ResultsReport from "@/components/auction/ResultsReport";
import { PageHeader } from "@/components/ui/Primitives";
import { getCurrentAdmin } from "@/lib/auth/session";
import { getAuctionResults } from "@/lib/services/auction-results";
import type { CompetitionGender } from "@/types/tournament";

type PageSearchParams = Promise<{ tournamentId?: string; gender?: string }>;

export default async function AdminResultsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const { tournamentId, gender: genderParam } = await searchParams;
  const gender: CompetitionGender | undefined = genderParam === "male" || genderParam === "female"
    ? genderParam
    : undefined;
  const scoped = Boolean(tournamentId && gender);
  const query = tournamentId && gender
    ? `?tournamentId=${encodeURIComponent(tournamentId)}&gender=${gender}`
    : "";
  const admin = await getCurrentAdmin().catch(() => null);
  if (!admin) redirect(`/admin/login?next=${encodeURIComponent(`/admin/results${query}`)}`);
  const reports = await getAuctionResults(scoped ? tournamentId : undefined, scoped ? gender : undefined).catch(() => null);
  const competitionLabel = scoped ? gender === "male" ? "MEN'S" : "WOMEN'S" : null;
  return <AdminShell><div className="content-wrap"><PageHeader
    eyebrow={scoped ? `${competitionLabel} TOURNAMENT RESULTS` : "TOURNAMENT REPORTS"}
    title="Auction results"
    description={scoped ? "Persisted player outcomes, completed spend, and team purse status for this competition." : "Current persisted player outcomes, completed spend, and team purse status."}
    action={<div className="room-actions">
      {scoped && <Link className="button button-outline" href={`/admin/tournaments/${encodeURIComponent(tournamentId ?? "")}`}>Back to tournament</Link>}
      <Link className="button button-outline" href={`/admin/results/export${query}`}>Export workbook</Link>
    </div>}
  />{reports ? <ResultsReport reports={reports} /> : <section className="panel history-state"><h2>Results unavailable</h2><p>Could not load MongoDB auction results.</p></section>}</div></AdminShell>;
}