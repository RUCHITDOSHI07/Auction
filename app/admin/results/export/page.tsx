import AdminShell from "@/components/admin/AdminShell";
import ExportOptions from "@/components/excel/ExportOptions";
import { PageHeader } from "@/components/ui/Primitives";

export default function AdminExportPage() {
  return (
    <AdminShell>
      <div className="content-wrap narrow-content">
        <PageHeader
          eyebrow="EXCEL EXPORT · FINAL REPORT"
          title="Export results"
          description="Prepare the final team-wise allocation and detailed auction summary for distribution."
        />

        <ExportOptions />
      </div>
    </AdminShell>
  );
}
