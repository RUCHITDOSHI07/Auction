"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { PageHeader, StatusBadge } from "@/components/ui/Primitives";
import type { Team } from "@/types/team";
import type { Tournament } from "@/types/tournament";

type FormState = { name:string; shortName:string; ownerName:string; logoUrl:string; totalBudget:string; squadSize:string };
const emptyForm:FormState={name:"",shortName:"",ownerName:"",logoUrl:"",totalBudget:"100000",squadSize:"11"};

function formatMoney(value:number){return `₹${value.toLocaleString("en-IN")}`;}

export default function AdminTeamsPage(){
  const searchParams=useSearchParams();
  const tournamentId=searchParams.get("tournamentId")??"";
  const gender=searchParams.get("gender")==="female"?"female":"male";
  const [tournament,setTournament]=useState<Tournament|null>(null);
  const [teams,setTeams]=useState<Team[]>([]);
  const [form,setForm]=useState<FormState>(emptyForm);
  const [showForm,setShowForm]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const loadData=useCallback(async()=>{
    if(!tournamentId){setLoading(false);return;}
    setLoading(true);setError(null);
    try{
      const [tr,tm]=await Promise.all([
        fetch(`/api/tournaments/${tournamentId}`),
        fetch(`/api/teams?tournamentId=${encodeURIComponent(tournamentId)}&gender=${gender}`)
      ]);
      const tournamentResult=await tr.json() as {tournament?:Tournament;error?:string};
      const teamsResult=await tm.json() as {teams?:Team[];error?:string};
      if(!tr.ok)throw new Error(tournamentResult.error??"Unable to load tournament.");
      if(!tm.ok)throw new Error(teamsResult.error??"Unable to load teams.");
      setTournament(tournamentResult.tournament??null);setTeams(teamsResult.teams??[]);
    }catch(e){setError(e instanceof Error?e.message:"Unable to load teams.");}
    finally{setLoading(false);}
  },[tournamentId,gender]);

  useEffect(()=>{void loadData();},[loadData]);

  const title=gender==="female"?"Women's Teams":"Men's Teams";
  const competitionEnabled=tournament?.competitions[gender].enabled??false;
  const budgetTotal=useMemo(()=>teams.reduce((sum,team)=>sum+team.totalBudget,0),[teams]);

  async function createTeam(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);setError(null);
    try{
      const response=await fetch("/api/teams",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        tournamentId,gender,...form,totalBudget:Number(form.totalBudget),squadSize:Number(form.squadSize)
      })});
      const result=await response.json() as {team?:Team;error?:string};
      if(!response.ok)throw new Error(result.error??"Unable to create team.");
      setTeams(current=>[...current,result.team!].sort((a,b)=>a.name.localeCompare(b.name)));
      setForm(emptyForm);setShowForm(false);
    }catch(e){setError(e instanceof Error?e.message:"Unable to create team.");}
    finally{setSaving(false);}
  }

  if(!tournamentId)return <AdminShell><div className="content-wrap"><PageHeader eyebrow="TOURNAMENT TEAMS" title="Teams" description="Choose a tournament and competition before managing teams." action={<Link className="button button-outline" href="/admin/tournaments">Choose tournament</Link>}/><section className="panel"><p>Select a tournament first. Men's and women's teams are stored separately.</p></section></div></AdminShell>;

  return <AdminShell><div className="content-wrap tournament-content">
    <Link className="back-link" href={`/admin/tournaments/${tournamentId}`}>← {tournament?.name??"Tournament"}</Link>
    <PageHeader eyebrow={`${tournament?.season??""} · ${gender==="male"?"MEN'S":"WOMEN'S"}`} title={title} description={`Teams registered for ${tournament?.name??"this tournament"}.`} action={<button className="button button-dark" type="button" onClick={()=>setShowForm(v=>!v)} disabled={!competitionEnabled}>{showForm?"Close form":"Add team"}</button>}/>
    <section className="team-context-bar"><div><span>Competition</span><strong>{gender==="male"?"Men's":"Women's"}</strong></div><div><span>Teams</span><strong>{teams.length}</strong></div><div><span>Total allocated budget</span><strong>{formatMoney(budgetTotal)}</strong></div></section>
    {!competitionEnabled&&<div className="tournament-error">This competition is not enabled for this tournament.</div>}
    {error&&<div className="tournament-error">{error}</div>}
    {showForm&&competitionEnabled&&<form className="team-form" onSubmit={createTeam}><div className="team-form-grid">
      <label>Team name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Mumbai Strikers"/></label>
      <label>Short name<input required maxLength={8} value={form.shortName} onChange={e=>setForm({...form,shortName:e.target.value})} placeholder="MS"/></label>
      <label>Owner / manager<input value={form.ownerName} onChange={e=>setForm({...form,ownerName:e.target.value})} placeholder="Optional"/></label>
      <label>Logo URL<input value={form.logoUrl} onChange={e=>setForm({...form,logoUrl:e.target.value})} placeholder="Optional"/></label>
      <label>Starting budget<input required type="number" min="1" step="1" value={form.totalBudget} onChange={e=>setForm({...form,totalBudget:e.target.value})}/></label>
      <label>Squad size<input required type="number" min="1" step="1" value={form.squadSize} onChange={e=>setForm({...form,squadSize:e.target.value})}/></label>
    </div><div className="tournament-actions"><button className="button button-dark" type="submit" disabled={saving}>{saving?"Creating...":"Create team"}</button><button className="button button-outline" type="button" onClick={()=>setShowForm(false)}>Cancel</button></div></form>}
    {!loading&&teams.length===0&&<section className="panel team-empty"><h2>No teams yet</h2><p>Add the teams that will participate in this competition.</p></section>}
    {loading&&<section className="panel"><p>Loading teams...</p></section>}
    {!loading&&teams.length>0&&<section className="team-grid team-grid-modern">{teams.map(team=><article className="team-admin-card" key={team.id}><div className="team-admin-card-top"><div className="team-logo">{team.logoUrl?<img src={team.logoUrl} alt=""/>:team.shortName}</div><StatusBadge tone={team.status==="active"?"success":"neutral"}>{team.status.toUpperCase()}</StatusBadge></div><h2>{team.name}</h2><p>{team.ownerName||"No owner / manager set"}</p><div className="team-admin-metrics"><div><span>Budget</span><strong>{formatMoney(team.remainingBudget)}</strong><small>remaining</small></div><div><span>Squad</span><strong>{team.playersCount}/{team.squadSize}</strong><small>players</small></div></div></article>)}</section>}
  </div></AdminShell>;
}
