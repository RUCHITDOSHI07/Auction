import AdminShell from "@/components/admin/AdminShell";
import ExcelUpload from "@/components/excel/ExcelUpload";
import { PageHeader } from "@/components/ui/Primitives";

export default function AdminPlayersImportPage() {
  return (
    <AdminShell>
      <div className="content-wrap narrow-content">
        <PageHeader
          eyebrow="EXCEL IMPORT · STEP 1-4"
          title="Import players"
          description="Prepare the spreadsheet, validate rows, review warnings, and stage the data for the live auction."
        />

        <div className="stepper">
          <div className="step active"><span>01</span>Upload Excel</div>
          <div className="step"><span>02</span>Validate</div>
          <div className="step"><span>03</span>Review players</div>
          <div className="step"><span>04</span>Import</div>
        </div>

        <ExcelUpload />
      </div>
    </AdminShell>
  );
}
