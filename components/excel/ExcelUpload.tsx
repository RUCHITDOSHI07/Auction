"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { normalizePlayerGender } from "@/lib/players";

const importColumns = ["Full Name","Gender","Age","Date of Birth","Wing - Flat Number (eg:- B-1701)","Phone Number","Upload Your Recent Photo","Have you played cricket before?","Role","Batting Preference","Bowling Preference","Insta-id"];
const sampleRows = [
  ["Rohit Verma","Male","28","14/06/1998","B-1701","+91 98765 43210","rohit-verma.jpg","Yes","Batter","Right-hand","Right-arm medium","@rohitverma"],
  ["Aisha Rao","Female","24","19/02/2002","C-1203","+91 98765 43212","aisha-rao.jpg","No","Batter","Right-hand","None","@aisharao"],
];
type ImportSummary = { found:number; valid:number; warnings:number; errors:number };
const emptySummary = { found:0, valid:0, warnings:0, errors:0 };

function normalizeHeader(header:string){ return header.trim().toLowerCase().replace(/\s+/g," "); }
function getCell(row:Record<string,unknown>,header:string){ const expected=normalizeHeader(header); const key=Object.keys(row).find(function(k){return normalizeHeader(k)===expected;}); return key ? String(row[key] ?? "").trim() : ""; }
function toNumber(value:string){ const parsed=Number(value.replace(/[^\d.-]/g,"")); return Number.isFinite(parsed)?parsed:undefined; }
function toDateString(value:string){ if(!value)return ""; if(/^\d+(\.\d+)?$/.test(value)){ const date=XLSX.SSF.parse_date_code(Number(value)); return date ? String(date.d).padStart(2,"0")+"/"+String(date.m).padStart(2,"0")+"/"+date.y : value; } return value; }

function toImportRow(row:Record<string,unknown>){
  const fullName=getCell(row,"Full Name"), genderValue=getCell(row,"Gender"), ageValue=getCell(row,"Age"), role=getCell(row,"Role");
  const age=ageValue?toNumber(ageValue):undefined; const warnings:string[]=[]; const errors:string[]=[];
  if(!fullName)errors.push("Full Name is required");
  if(!role)errors.push("Role is required");
  if(!genderValue || !normalizePlayerGender(genderValue))errors.push("Gender must be Male, Female, M, or F");
  if(ageValue && (age===undefined||age<1||age>120))errors.push("Age must be a valid number");
  const address=getCell(row,"Wing - Flat Number (eg:- B-1701)"), phone=getCell(row,"Phone Number"), basePriceValue=getCell(row,"Base Price");
  if(!basePriceValue)warnings.push("Base Price not provided; using 0");
  else if(toNumber(basePriceValue)===undefined)errors.push("Base Price must be a valid number");
  return {
    row:[fullName,genderValue,ageValue,toDateString(getCell(row,"Date of Birth")),address,phone,getCell(row,"Upload Your Recent Photo"),getCell(row,"Have you played cricket before?"),role,getCell(row,"Batting Preference"),getCell(row,"Bowling Preference"),getCell(row,"Insta-id")],
    warnings,errors,
    player:errors.length===0?{
      name:fullName,fullName,gender:normalizePlayerGender(genderValue),category:getCell(row,"Category")||"Uncategorized",role,age,dateOfBirth:toDateString(getCell(row,"Date of Birth")),wingFlatNumber:address,phoneNumber:phone,photoUrl:getCell(row,"Upload Your Recent Photo")||undefined,battingStyle:getCell(row,"Batting Preference")||undefined,bowlingStyle:getCell(row,"Bowling Preference")||undefined,batting:getCell(row,"Batting Preference")||undefined,bowling:getCell(row,"Bowling Preference")||undefined,basePrice:toNumber(basePriceValue)??0,status:"available" as const,isSold:false,instagramId:getCell(row,"Insta-id")||undefined
    }:null
  };
}

export default function ExcelUpload({ importEndpoint="/api/players/import", backHref="/admin/players" }: { importEndpoint?:string; backHref?:string }) {
  const fileInput=useRef<HTMLInputElement>(null); const [previewRows,setPreviewRows]=useState(sampleRows);
  const [summary,setSummary]=useState<ImportSummary>({...emptySummary,found:sampleRows.length}); const [message,setMessage]=useState<string|null>(null); const [processing,setProcessing]=useState(false);

  async function handleFile(file:File){
    setProcessing(true); setMessage(null);
    try{
      const workbook=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:false}); const sheet=workbook.Sheets[workbook.SheetNames[0]];
      if(!sheet)throw new Error("The workbook does not contain a worksheet.");
      const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:""}); const parsed=rows.map(toImportRow); const validRows=parsed.filter(function(item){return item.player!==null;});
      const response=await fetch(importEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({players:validRows.map(function(item){return item.player!;})})});
      const result=await response.json() as {processed?:number;inserted?:number;created?:number;linked?:number;duplicateRows?:number;error?:string};
      if(!response.ok)throw new Error(result.error??"Unable to import players.");
      setPreviewRows(parsed.map(function(item){return item.row;}));
      setSummary({found:parsed.length,valid:result.processed??validRows.length,warnings:parsed.reduce(function(n,item){return n+item.warnings.length;},0)+(result.duplicateRows??0),errors:parsed.reduce(function(n,item){return n+item.errors.length;},0)});
      setMessage("Imported "+(result.linked ?? result.inserted ?? result.processed ?? 0)+" tournament players."+((result.created ?? 0)>0 ? " "+result.created+" new permanent player IDs were created." : ""));
    }catch(error){setSummary(emptySummary);setMessage(error instanceof Error?error.message:"Unable to read this file.");}
    finally{setProcessing(false);}
  }

  return <section className="panel import-panel">
    <div className="section-heading"><h2>Import players</h2><Link className="text-link" href={backHref}>Back →</Link></div>
    <div className="upload-card"><div className="upload-placeholder"><span>⇪</span><strong>Upload Excel File</strong><small>One file can contain both Male and Female players.</small></div><div className="upload-actions">
      <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" hidden onChange={function(e){const file=e.target.files?.[0];if(file)void handleFile(file);e.target.value="";}}/>
      <button className="button button-dark" type="button" onClick={function(){fileInput.current?.click();}} disabled={processing}>{processing?"Processing...":"Select file"}</button>
      <button className="button button-outline" type="button">Download template</button>
    </div></div>
    <div className="import-summary-grid"><div className="mini-stat"><label>Players found</label><strong>{summary.found}</strong></div><div className="mini-stat success"><label>Valid</label><strong>{summary.valid}</strong></div><div className="mini-stat warning"><label>Warnings</label><strong>{summary.warnings}</strong></div><div className="mini-stat danger"><label>Errors</label><strong>{summary.errors}</strong></div></div>
    {message&&<p>{message}</p>}
    <div className="excel-table-wrap"><div className="excel-table-head">{importColumns.map(function(column){return <span key={column}>{column}</span>;})}</div>{previewRows.map(function(row,index){return <div className="excel-table-row" key={row[0] ? String(row[0]) : String(index)}>{row.map(function(value,i){return <span key={String(index)+"-"+importColumns[i]}>{value}</span>;})}</div>;})}</div>
  </section>;
}
