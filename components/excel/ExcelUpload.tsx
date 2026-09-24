"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { normalizePlayerGender } from "@/lib/players";

const importColumns = [
  "Full Name",
  "Gender",
  "Age",
  "Date of Birth",
  "Wing - Flat Number (eg:- B-1701)",
  "Phone Number",
  "Upload Your Recent Photo",
  "Have you played cricket before?",
  "Role",
  "Batting Preference",
  "Bowling Preference",
  "Insta-id",
];

const sampleRows = [
  ["Rohit Verma", "Male", "28", "14/06/1998", "B-1701", "+91 98765 43210", "rohit-verma.jpg", "Yes", "Batter", "Right-hand", "Right-arm medium", "@rohitverma"],
  ["Kabir Nair", "Male", "31", "02/11/1994", "A-904", "+91 98765 43211", "kabir-nair.jpg", "Yes", "All-rounder", "Left-hand", "Left-arm spin", "@kabirnair"],
  ["Aisha Rao", "Female", "24", "19/02/2002", "C-1203", "+91 98765 43212", "aisha-rao.jpg", "No", "Batter", "Right-hand", "None", "@aisharao"],
];

type ImportSummary = { found: number; valid: number; warnings: number; errors: number };

const emptySummary: ImportSummary = { found: 0, valid: 0, warnings: 0, errors: 0 };

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

function getCell(row: Record<string, unknown>, header: string) {
  const expected = normalizeHeader(header);
  const key = Object.keys(row).find((candidate) => normalizeHeader(candidate) === expected);
  return key ? String(row[key] ?? "").trim() : "";
}

function toNumber(value: string) {
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toDateString(value: string) {
  if (!value) return "";
  if (/^\d+(\.\d+)?$/.test(value)) {
    const date = XLSX.SSF.parse_date_code(Number(value));
    return date ? `${String(date.d).padStart(2, "0")}/${String(date.m).padStart(2, "0")}/${date.y}` : value;
  }
  return value;
}

function makePlayerCode(name: string, address: string, phone: string) {
  const source = `${name}-${address || phone}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return source || `player-${Date.now()}`;
}

function toImportRow(row: Record<string, unknown>) {
  const fullName = getCell(row, "Full Name");
  const genderValue = getCell(row, "Gender");
  const ageValue = getCell(row, "Age");
  const role = getCell(row, "Role");
  const age = ageValue ? toNumber(ageValue) : undefined;
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!fullName) errors.push("Full Name is required");
  if (!role) errors.push("Role is required");
  if (ageValue && (age === undefined || age < 1 || age > 120)) errors.push("Age must be a valid number");
  if (genderValue && !normalizePlayerGender(genderValue)) errors.push("Gender must be Male, Female, M, or F");

  const address = getCell(row, "Wing - Flat Number (eg:- B-1701)");
  const phone = getCell(row, "Phone Number");
  const basePriceValue = getCell(row, "Base Price");
  if (!basePriceValue) warnings.push("Base Price not provided; using 0");
  else if (toNumber(basePriceValue) === undefined) errors.push("Base Price must be a valid number");

  const playerCode = makePlayerCode(fullName, address, phone);
  return {
    row: [
      fullName,
      ageValue,
      toDateString(getCell(row, "Date of Birth")),
      address,
      phone,
      getCell(row, "Upload Your Recent Photo"),
      getCell(row, "Have you played cricket before?"),
      role,
      getCell(row, "Batting Preference"),
      getCell(row, "Bowling Preference"),
      getCell(row, "Insta-id"),
    ],
    warnings,
    errors,
    player: errors.length === 0 ? {
      id: playerCode,
      playerCode,
      name: fullName,
      fullName,
      gender: normalizePlayerGender(genderValue),
      category: getCell(row, "Category") || "Uncategorized",
      role,
      age,
      dateOfBirth: toDateString(getCell(row, "Date of Birth")),
      wingFlatNumber: address,
      phoneNumber: phone,
      photoUrl: getCell(row, "Upload Your Recent Photo") || undefined,
      battingStyle: getCell(row, "Batting Preference") || undefined,
      bowlingStyle: getCell(row, "Bowling Preference") || undefined,
      batting: getCell(row, "Batting Preference") || undefined,
      bowling: getCell(row, "Bowling Preference") || undefined,
      basePrice: toNumber(basePriceValue) ?? 0,
      status: "available" as const,
      isSold: false,
      instagramId: getCell(row, "Insta-id") || undefined,
    } : null,
  };
}

export default function ExcelUpload() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [previewRows, setPreviewRows] = useState(sampleRows);
  const [summary, setSummary] = useState<ImportSummary>({ found: sampleRows.length, valid: 0, warnings: 0, errors: 0 });
  const [message, setMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function handleFile(file: File) {
    setProcessing(true);
    setMessage(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error("The workbook does not contain a worksheet.");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
      const parsed = rows.map(toImportRow);
      const seenPlayerCodes = new Set<string>();
      let duplicateRows = 0;
      for (const item of parsed) {
        const playerCode = item.player?.playerCode;
        if (playerCode && seenPlayerCodes.has(playerCode)) duplicateRows += 1;
        if (playerCode) seenPlayerCodes.add(playerCode);
      }
      const validRows = parsed.filter((item) => item.player !== null);
      const response = await fetch("/api/players/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: validRows.map((item) => item.player!) }),
      });
      const result = await response.json() as { processed?: number; inserted?: number; updated?: number; unchanged?: number; duplicateRows?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to import players.");

      setPreviewRows(parsed.map((item) => item.row));
      setSummary({
        found: parsed.length,
        valid: result.processed ?? 0,
        warnings: parsed.reduce((count, item) => count + item.warnings.length, 0) + duplicateRows,
        errors: parsed.reduce((count, item) => count + item.errors.length, 0),
      });
      setMessage(`Processed ${result.processed ?? 0} rows: ${result.inserted ?? 0} new, ${result.updated ?? 0} updated, ${result.unchanged ?? 0} unchanged.${duplicateRows ? ` ${duplicateRows} duplicate rows were upserted.` : ""}`);
    } catch (error) {
      setSummary(emptySummary);
      setMessage(error instanceof Error ? error.message : "Unable to read this file.");
    } finally {
      setProcessing(false);
    }
  }

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
          <small>Supports .xlsx and .csv files</small>
        </div>
        <div className="upload-actions">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
          <button className="button button-dark" type="button" onClick={() => fileInput.current?.click()} disabled={processing} aria-busy={processing}>
            {processing && <span className="import-loader" aria-hidden="true" />}
            {processing ? "Processing..." : "Select file"}
          </button>
          <button className="button button-outline" type="button">
            Download template
          </button>
        </div>
      </div>

      <div className="import-summary-grid">
        <div className="mini-stat">
          <label>Players found</label>
          <strong>{summary.found}</strong>
        </div>
        <div className="mini-stat success">
          <label>Valid</label>
          <strong>{summary.valid}</strong>
        </div>
        <div className="mini-stat warning">
          <label>Warnings</label>
          <strong>{summary.warnings}</strong>
        </div>
        <div className="mini-stat danger">
          <label>Errors</label>
          <strong>{summary.errors}</strong>
        </div>
      </div>

      {message && <p>{message}</p>}

      <div className="excel-table-wrap">
        <div className="excel-table-head">
          {importColumns.map((column) => <span key={column}>{column}</span>)}
        </div>
        {previewRows.map((row) => (
          <div className="excel-table-row" key={row[0]}>
            {row.map((value, index) => <span key={`${row[0]}-${importColumns[index]}`}>{value}</span>)}
          </div>
        ))}
      </div>
    </section>
  );
}
