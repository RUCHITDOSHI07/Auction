import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import ResultsReport from "@/components/auction/ResultsReport";
import { PageHeader } from "@/components/ui/Primitives";
import { getCurrentAdmin } from "@/lib/auth/session";
import { getAuctionResults } from "@/lib/services/auction-results";

export default async function AdminResultsPage() {
  const admin = await getCurrentAdmin().catch(() => null);
  if (!admin) redirect(`/admin/login?next=${encodeURIComponent("/admin/results")}`);
  const reports = await getAuctionResults().catch(() => null);
  return <AdminShell><div className="content-wrap"><PageHeader eyebrow="TOURNAMENT REPORTS" title="Auction results" description="Current persisted player outcomes, completed spend, and team purse status." action={<Link className="button button-outline" href="/admin/results/export">Export workbook</Link>} />{reports ? <ResultsReport reports={reports} /> : <section className="panel history-state"><h2>Results unavailable</h2><p>Could not load MongoDB auction results.</p></section>}</div></AdminShell>;
}