import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import ExportOptions from "@/components/excel/ExportOptions";
import { PageHeader } from "@/components/ui/Primitives";
import { getCurrentAdmin } from "@/lib/auth/session";
import { getAuctionResults } from "@/lib/services/auction-results";

export default async function AdminExportPage() {
  const admin = await getCurrentAdmin().catch(() => null);
  if (!admin) redirect(`/admin/login?next=${encodeURIComponent("/admin/results/export")}`);
  const reports = await getAuctionResults();

  return (
    <AdminShell>
      <div className="content-wrap narrow-content">
        <PageHeader
          eyebrow="EXCEL EXPORT · FINAL REPORT"
          title="Export results"
          description="Export one tournament competition as a team-wise Excel worksheet."
        />

        <ExportOptions reports={reports} />
      </div>
    </AdminShell>
  );
}
