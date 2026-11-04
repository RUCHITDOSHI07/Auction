import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import ExportOptions from "@/components/excel/ExportOptions";
import { PageHeader } from "@/components/ui/Primitives";
import { getCurrentAdmin } from "@/lib/auth/session";
import { getAuctionResults } from "@/lib/services/auction-results";
import type { CompetitionGender } from "@/types/tournament";

type PageSearchParams = Promise<{ tournamentId?: string; gender?: string }>;

export default async function AdminExportPage({ searchParams }: { searchParams: PageSearchParams }) {
  const { tournamentId, gender: genderParam } = await searchParams;
  const gender: CompetitionGender | undefined = genderParam === "male" || genderParam === "female"
    ? genderParam
    : undefined;
  const scoped = Boolean(tournamentId && gender);
  const query = tournamentId && gender
    ? `?tournamentId=${encodeURIComponent(tournamentId)}&gender=${gender}`
    : "";
  const admin = await getCurrentAdmin().catch(() => null);
  if (!admin) redirect(`/admin/login?next=${encodeURIComponent(`/admin/results/export${query}`)}`);
  const reports = await getAuctionResults(scoped ? tournamentId : undefined, scoped ? gender : undefined);

  return (
    <AdminShell>
      <div className="content-wrap narrow-content">
        <PageHeader
          eyebrow={scoped ? `${gender === "male" ? "MEN'S" : "WOMEN'S"} · EXCEL EXPORT` : "EXCEL EXPORT · FINAL REPORT"}
          title="Export results"
          description={scoped ? "Export this tournament competition as a team-wise Excel worksheet." : "Export one tournament competition as a team-wise Excel worksheet."}
          action={<Link className="button button-outline" href={`/admin/results${query}`}>Back to results</Link>}
        />

        <ExportOptions reports={reports} />
      </div>
    </AdminShell>
  );
}
