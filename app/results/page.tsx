import Link from "next/link";
import { connection } from "next/server";
import PublicHeader from "@/components/public/PublicHeader";
import ResultsReport from "@/components/auction/ResultsReport";
import { StatusBadge } from "@/components/ui/Primitives";
import { getAuctionResults } from "@/lib/services/auction-results";

export default async function PublicResultsPage() {
  await connection();
  const reports = await getAuctionResults().catch(() => null);
  return <main className="public-live"><PublicHeader><StatusBadge tone="neutral">PUBLIC</StatusBadge><span>TOURNAMENT RESULTS</span></PublicHeader><div className="content-wrap"><div className="results-public-heading"><div><span className="eyebrow">PERSISTED OUTCOMES</span><h1>Results</h1><p>Final and in-progress tournament auction results.</p></div><Link className="button button-outline" href="/">Home</Link></div>{reports ? <ResultsReport reports={reports} /> : <section className="panel history-state"><h2>Results unavailable</h2><p>We could not load the tournament results right now.</p></section>}</div></main>;
}