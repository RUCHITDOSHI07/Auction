"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import type { AuctionResultsReport } from "@/lib/services/auction-results";

function formatAmount(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function getTeamColumns(report: AuctionResultsReport) {
  return report.teams.map((team) => ({
    id: team.id,
    name: team.name,
    players: report.players
      .filter((player) => player.status === "sold" && player.teamId === team.id)
      .map((player) => `${player.name} — ${player.soldPrice === null ? "Amount unavailable" : formatAmount(player.soldPrice)}`),
  }));
}

export default function ExportOptions({ reports }: { reports: AuctionResultsReport[] }) {
  const [selectedAuctionId, setSelectedAuctionId] = useState(reports[0]?.auctionId ?? "");
  const [error, setError] = useState<string | null>(null);
  const report = reports.find((item) => item.auctionId === selectedAuctionId);
  const columns = report ? getTeamColumns(report) : [];
  const previewRows = Array.from(
    { length: Math.max(1, ...columns.map((column) => column.players.length)) },
    (_, rowIndex) => columns.map((column) => column.players[rowIndex] ?? ""),
  );

  function exportWorkbook() {
    if (!report || columns.length === 0) return;
    setError(null);
    try {
      const rows = [
        columns.map((column) => column.name),
        ...previewRows,
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Team Results");
      const competition = report.gender === "male" ? "mens" : "womens";
      const tournament = report.tournamentName.trim().replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, "-");
      XLSX.writeFile(workbook, `${tournament}-${report.season ?? "results"}-${competition}-results.xlsx`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to create the Excel workbook.");
    }
  }

  return (
    <section className="panel export-panel">
      <div className="section-heading">
        <h2>Export tournament results</h2>
      </div>

      {reports.length === 0 ? (
        <p>No initialized tournament results are available to export.</p>
      ) : (
        <>
          <div className="export-form">
            <label>
              Tournament and competition
              <select value={selectedAuctionId} onChange={(event) => { setSelectedAuctionId(event.target.value); setError(null); }}>
                {reports.map((item) => (
                  <option key={item.auctionId} value={item.auctionId}>
                    {item.tournamentName} · {item.season ?? "Season unavailable"} · {item.gender === "male" ? "Men" : "Women"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {columns.length > 0 && (
            <div className="excel-table-wrap" aria-label="Team-wise results export preview">
              <div
                className="excel-table-head"
                style={{
                  gridTemplateColumns: `repeat(${columns.length}, minmax(12rem, 1fr))`,
                  minWidth: `${Math.max(42, columns.length * 12)}rem`,
                }}
              >
                {columns.map((column) => <span key={column.id}>{column.name}</span>)}
              </div>
              {previewRows.map((row, rowIndex) => (
                <div
                  className="excel-table-row"
                  key={rowIndex}
                  style={{
                    gridTemplateColumns: `repeat(${columns.length}, minmax(12rem, 1fr))`,
                    minWidth: `${Math.max(42, columns.length * 12)}rem`,
                  }}
                >
                  {row.map((value, columnIndex) => <span key={`${columnIndex}-${rowIndex}`}>{value}</span>)}
                </div>
              ))}
            </div>
          )}

          <div className="form-actions">
            <button className="button button-dark" type="button" onClick={exportWorkbook} disabled={!report || columns.length === 0}>
              Export Excel
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
