import Link from "next/link";

const previewRows = [
  { name: "Rohit Verma", role: "Batter", category: "Marquee", basePrice: "₹20L", status: "Valid" },
  { name: "Kabir Nair", role: "All-rounder", category: "Capped", basePrice: "₹12L", status: "Warning" },
  { name: "Aisha Rao", role: "Wicketkeeper", category: "Emerging", basePrice: "₹8L", status: "Missing photo" },
  { name: "Nikhil Sen", role: "Fast bowler", category: "Uncapped", basePrice: "₹0", status: "Error" },
];

export default function ExcelUpload() {
  return (
    <section className="panel import-panel">
      <div className="section-heading">
        <h2>Import players</h2>
        <Link className="text-link" href="/admin/players">
          Back to players →
        </Link>
      </div>

      <div className="upload-card">
        <div className="upload-placeholder">
          <span>⇪</span>
          <strong>Upload Excel File</strong>
          <small>Supports .xlsx and .csv mock upload for Phase 2</small>
        </div>
        <div className="upload-actions">
          <button className="button button-dark" type="button">
            Select file
          </button>
          <button className="button button-outline" type="button">
            Download template
          </button>
        </div>
      </div>

      <div className="import-summary-grid">
        <div className="mini-stat">
          <label>Players found</label>
          <strong>120</strong>
        </div>
        <div className="mini-stat success">
          <label>Valid</label>
          <strong>116</strong>
        </div>
        <div className="mini-stat warning">
          <label>Warnings</label>
          <strong>3</strong>
        </div>
        <div className="mini-stat danger">
          <label>Errors</label>
          <strong>1</strong>
        </div>
      </div>

      <div className="excel-table-wrap">
        <div className="excel-table-head">
          <span>Photo</span>
          <span>Player</span>
          <span>Role</span>
          <span>Category</span>
          <span>Base Price</span>
          <span>Status</span>
        </div>
        {previewRows.map((row) => (
          <div className="excel-table-row" key={row.name}>
            <span className={`thumb ${row.status.toLowerCase().replace(/\s+/g, "-")}`}>
              {row.name.slice(0, 2).toUpperCase()}
            </span>
            <span>{row.name}</span>
            <span>{row.role}</span>
            <span>{row.category}</span>
            <span>{row.basePrice}</span>
            <span>
              <em className={`status-chip ${row.status.toLowerCase().replace(/\s+/g, "-")}`}>{row.status}</em>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
