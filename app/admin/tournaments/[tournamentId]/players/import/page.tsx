import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import ExcelUpload from "@/components/excel/ExcelUpload";
import { PageHeader } from "@/components/ui/Primitives";

export default async function TournamentPlayersImportPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  return (
    <AdminShell>
      <div className="content-wrap narrow-content">
        <Link className="back-link" href={`/admin/tournaments/${tournamentId}`}>← Tournament overview</Link>
        <PageHeader eyebrow="TOURNAMENT · PLAYER POOL" title="Import players" description="Upload one Excel file containing both men's and women's players. Gender decides which competition each player belongs to." />
        <ExcelUpload importEndpoint={`/api/tournaments/${tournamentId}/players/import`} backHref={`/admin/tournaments/${tournamentId}`} />
      </div>
    </AdminShell>
  );
}
