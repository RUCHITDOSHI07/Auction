"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { normalizePlayerGender } from "@/lib/players";
import type { CompetitionGender } from "@/types/tournament";
import { optimizedImageUrl } from "@/lib/storage/image-url";

const importColumns = ["Full Name","Gender","Age","Date of Birth","Wing - Flat Number (eg:- B-1701)","Phone Number","Upload Your Recent Photo","Have you played cricket before?","Role","Batting Preference","Bowling Preference","Insta-id","Category","Base Price"];
type ImportIssue = { playerName:string; reason:string };
type ImportSummary = { found:number; valid:number; warnings:number; errors:number; created:number; updated:number; imagesUploaded:number; imagesUpdated:number; imagesSkipped:number };
const emptySummary:ImportSummary = { found:0, valid:0, warnings:0, errors:0, created:0, updated:0, imagesUploaded:0, imagesUpdated:0, imagesSkipped:0 };

function normalizeHeader(header:string){ return header.trim().toLowerCase().replace(/\s+/g," "); }
function getCell(row:Record<string,unknown>,header:string){ const expected=normalizeHeader(header); const key=Object.keys(row).find(function(k){return normalizeHeader(k)===expected;}); return key ? String(row[key] ?? "").trim() : ""; }
function toNumber(value:string){ const parsed=Number(value.replace(/[^\d.-]/g,"")); return Number.isFinite(parsed)?parsed:undefined; }
function toDateString(value:string){ if(!value)return ""; if(/^\d+(\.\d+)?$/.test(value)){ const date=XLSX.SSF.parse_date_code(Number(value)); return date ? String(date.d).padStart(2,"0")+"/"+String(date.m).padStart(2,"0")+"/"+date.y : value; } return value; }
function getPhotoPreviewUrl(value:string){
  try{
    const url=new URL(value);
    if(url.hostname==="res.cloudinary.com")return optimizedImageUrl(url.toString(),{width:96,height:96});
    if((url.hostname==="drive.google.com"||url.hostname==="docs.google.com")&&url.protocol==="https:"){
      const id=url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/)?.[1]??url.searchParams.get("id");
      if(id&&/^[A-Za-z0-9_-]{10,200}$/.test(id))return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w96`;
    }
  }catch{}
  return undefined;
}

function toImportRow(row:Record<string,unknown>, categoryRules?:Partial<Record<CompetitionGender,boolean>>){
  const fullName=getCell(row,"Full Name"), genderValue=getCell(row,"Gender"), ageValue=getCell(row,"Age"), role=getCell(row,"Role");
  const gender=normalizePlayerGender(genderValue);
  const category=getCell(row,"Category");
  const usesCategoryPrices=gender ? categoryRules?.[gender]===true : false;
  const age=ageValue?toNumber(ageValue):undefined; const warnings:string[]=[]; const errors:string[]=[];
  if(!fullName)errors.push("Full Name is required");
  if(!role)errors.push("Role is required");
  if(!genderValue || !gender)errors.push("Gender must be Male, Female, M, or F");
  if(ageValue && (age===undefined||age<1||age>120))errors.push("Age must be a valid number");
  const address=getCell(row,"Wing - Flat Number (eg:- B-1701)"), phone=getCell(row,"Phone Number"), basePriceValue=getCell(row,"Base Price");
  if(usesCategoryPrices && !category)errors.push("Category is required when tournament category pricing is enabled");
  if(!usesCategoryPrices && !basePriceValue)warnings.push("Base Price not provided; using 0");
  if(basePriceValue && toNumber(basePriceValue)===undefined)errors.push("Base Price must be a valid number");
  return {
    row:[fullName,genderValue,ageValue,toDateString(getCell(row,"Date of Birth")),address,phone,getCell(row,"Upload Your Recent Photo"),getCell(row,"Have you played cricket before?"),role,getCell(row,"Batting Preference"),getCell(row,"Bowling Preference"),getCell(row,"Insta-id"),category,basePriceValue],
    warnings,errors,
    player:errors.length===0?{
      name:fullName,fullName,gender,category:category||"Uncategorized",role,age,dateOfBirth:toDateString(getCell(row,"Date of Birth")),wingFlatNumber:address,phoneNumber:phone,photoUrl:getCell(row,"Upload Your Recent Photo")||undefined,battingStyle:getCell(row,"Batting Preference")||undefined,bowlingStyle:getCell(row,"Bowling Preference")||undefined,batting:getCell(row,"Batting Preference")||undefined,bowling:getCell(row,"Bowling Preference")||undefined,basePrice:toNumber(basePriceValue)??0,status:"available" as const,isSold:false,instagramId:getCell(row,"Insta-id")||undefined
    }:null
  };
}

export default function ExcelUpload({ importEndpoint="/api/players/import", backHref="/admin/players", categoryRules, onImportComplete, disabled=false }: { importEndpoint?:string; backHref?:string | null; categoryRules?:Partial<Record<CompetitionGender,boolean>>; onImportComplete?:()=>void; disabled?:boolean }) {
  const fileInput=useRef<HTMLInputElement>(null); const [previewRows,setPreviewRows]=useState<string[][]>([]); const [importIssues,setImportIssues]=useState<ImportIssue[]>([]);
  const [summary,setSummary]=useState<ImportSummary>(emptySummary); const [message,setMessage]=useState<string|null>(null); const [processing,setProcessing]=useState(false);

  async function handleFile(file:File){
    setProcessing(true); setMessage(null); setImportIssues([]);
    try{
      const workbook=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:false}); const sheet=workbook.Sheets[workbook.SheetNames[0]];
      if(!sheet)throw new Error("The workbook does not contain a worksheet.");
      const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:""}); const parsed=rows.map(function(row){return toImportRow(row,categoryRules);}); const validRows=parsed.filter(function(item){return item.player!==null;});
      const response=await fetch(importEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({players:validRows.map(function(item){return item.player!;})})});
      const result=await response.json() as {processed?:number;inserted?:number;created?:number;updated?:number;linked?:number;duplicateRows?:number;imagesUploaded?:number;imagesUpdated?:number;imagesSkipped?:number;imageFailures?:ImportIssue[];rowFailures?:ImportIssue[];error?:string};
      if(!response.ok)throw new Error(result.error??"Unable to import players.");
      setPreviewRows(parsed.map(function(item){return item.row;}));
      setSummary({found:parsed.length,valid:result.processed??validRows.length,warnings:parsed.reduce(function(n,item){return n+item.warnings.length;},0)+(result.duplicateRows??0),errors:parsed.reduce(function(n,item){return n+item.errors.length;},0)+(result.rowFailures?.length??0),created:result.created??result.inserted??0,updated:result.updated??0,imagesUploaded:result.imagesUploaded??0,imagesUpdated:result.imagesUpdated??0,imagesSkipped:result.imagesSkipped??0});
      setImportIssues([...(result.imageFailures??[]),...(result.rowFailures??[])]);
      setMessage(`Imported ${result.processed??validRows.length} player records${(result.linked??0)>0?` and linked ${result.linked} to this tournament`:""}. ${result.created??result.inserted??0} new permanent IDs; ${result.updated??0} existing players updated.`);
      onImportComplete?.();
    }catch(error){setSummary(emptySummary);setMessage(error instanceof Error?error.message:"Unable to read this file.");}
    finally{setProcessing(false);}
  }

  return <section className="panel import-panel">
    <div className="section-heading"><h2>Import players</h2>{backHref&&<Link className="text-link" href={backHref}>Back →</Link>}</div>
    <div className="upload-card"><div className="upload-placeholder"><span>⇪</span><strong>Upload Excel File</strong><small>One file can contain both Male and Female players.</small></div><div className="upload-actions">
      <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" hidden onChange={function(e){const file=e.target.files?.[0];if(file)void handleFile(file);e.target.value="";}}/>
      <button className="button button-dark" type="button" onClick={function(){fileInput.current?.click();}} disabled={processing||disabled}>{processing?"Processing...":"Select file"}</button>
      <a className="button button-outline" href="/player-import-template.xlsx" download="cricket-auction-player-import-template.xlsx">Download Excel template</a>
    </div></div>
    <div className="import-summary-grid"><div className="mini-stat"><label>Players found</label><strong>{summary.found}</strong></div><div className="mini-stat success"><label>Imported</label><strong>{summary.valid}</strong></div><div className="mini-stat"><label>New IDs</label><strong>{summary.created}</strong></div><div className="mini-stat"><label>Updated</label><strong>{summary.updated}</strong></div><div className="mini-stat success"><label>Images uploaded / updated</label><strong>{summary.imagesUploaded} / {summary.imagesUpdated}</strong></div><div className="mini-stat warning"><label>Images skipped</label><strong>{summary.imagesSkipped}</strong></div><div className="mini-stat warning"><label>Warnings</label><strong>{summary.warnings}</strong></div><div className="mini-stat danger"><label>Errors</label><strong>{summary.errors}</strong></div></div>
    {message&&<p>{message}</p>}
    {importIssues.length>0&&<div className="import-image-issues" role="status"><strong>Import items needing attention</strong><ul>{importIssues.map((issue,index)=><li key={`${issue.playerName}-${index}`}><b>{issue.playerName}:</b> {issue.reason}</li>)}</ul></div>}
    <div className="excel-table-wrap"><div className="excel-table-head">{importColumns.map(function(column){return <span key={column}>{column}</span>;})}</div>{previewRows.map(function(row,index){return <div className="excel-table-row" key={row[0] ? String(row[0]) : String(index)}>{row.map(function(value,i){const photoPreview=i===6&&typeof value==="string"?getPhotoPreviewUrl(value):undefined;return <span key={String(index)+"-"+importColumns[i]}>{value}{photoPreview&&<img className="excel-photo-preview" src={photoPreview} alt="Player photo preview" width="48" height="48" loading="lazy" decoding="async"/>}</span>;})}</div>;})}</div>
  </section>;
}
