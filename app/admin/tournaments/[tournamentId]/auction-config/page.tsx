"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import type { Team } from "@/types/team";
import type { Tournament } from "@/types/tournament";
import type { AuctionConfig } from "@/types/auction-config";

export default function AuctionConfigPage() {
  const params = useParams<{ tournamentId: string }>();
  const search = useSearchParams();
  const gender = search.get("gender") === "female" ? "female" : "male";
  const [tournament,setTournament]=useState<Tournament|null>(null);
  const [teams,setTeams]=useState<Team[]>([]);
  const [config,setConfig]=useState<AuctionConfig|null>(null);
  const [selected,setSelected]=useState<string[]>([]);
  const [purse,setPurse]=useState("100000");
  const [minSquad,setMinSquad]=useState("8");
  const [maxSquad,setMaxSquad]=useState("11");
  const [increment,setIncrement]=useState("1000");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{(async()=>{
    try{
      const [tr,tm,ac]=await Promise.all([
        fetch(`/api/tournaments/${params.tournamentId}`),
        fetch(`/api/teams?tournamentId=${params.tournamentId}&gender=${gender}`),
        fetch(`/api/auction-config?tournamentId=${params.tournamentId}&gender=${gender}`)
      ]);
      const [a,b,c]=await Promise.all([tr.json(),tm.json(),ac.json()]) as [{tournament?:Tournament,error?:string},{teams?:Team[],error?:string},{config?:AuctionConfig,error?:string}];
      if(!tr.ok)throw new Error(a.error??"Unable to load tournament.");
      if(!tm.ok)throw new Error(b.error??"Unable to load teams.");
      if(!ac.ok)throw new Error(c.error??"Unable to load auction configuration.");
      setTournament(a.tournament??null);setTeams(b.teams??[]);setConfig(c.config??null);
      if(c.config){setSelected(c.config.teamIds);setPurse(String(c.config.pursePerTeam));setMinSquad(String(c.config.minimumSquadSize));setMaxSquad(String(c.config.maximumSquadSize));setIncrement(String(c.config.bidIncrement));}
    }catch(e){setError(e instanceof Error?e.message:"Unable to load auction configuration.");}
    finally{setLoading(false);}
  })()},[params.tournamentId,gender]);

  async function save(){
    setSaving(true);setError(null);
    try{
      const response=await fetch("/api/auction-config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tournamentId:params.tournamentId,gender,teamIds:selected,pursePerTeam:Number(purse),minimumSquadSize:Number(minSquad),maximumSquadSize:Number(maxSquad),bidIncrement:Number(increment)})});
      const result=await response.json() as {config?:AuctionConfig,error?:string};
      if(!response.ok)throw new Error(result.error??"Unable to save configuration.");
      setConfig(result.config??null);
    }catch(e){setError(e instanceof Error?e.message:"Unable to save configuration.");}
    finally{setSaving(false);}
  }

  if(loading)return <AdminShell><div className="content-wrap"><section className="panel"><p>Loading auction configuration...</p></section></div></AdminShell>;

  return <AdminShell><div className="content-wrap tournament-content">
    <Link className="back-link" href={`/admin/tournaments/${params.tournamentId}`}>← {tournament?.name??"Tournament"}</Link>
    <div className="auction-config-head"><div><span className="eyebrow">{tournament?.season} · {gender==="male"?"MEN'S":"WOMEN'S"}</span><h1>Configure auction</h1><p>Set the auction rules and choose the teams that will participate.</p></div><span className={config?"config-ready":"config-draft"}>{config?"CONFIGURED":"DRAFT"}</span></div>
    {error&&<div className="tournament-error">{error}</div>}
    {teams.length===0?<section className="panel"><h2>No teams available</h2><p>Create the {gender==="male"?"men's":"women's"} teams first, then return here to configure the auction.</p><Link className="button button-dark" href={`/admin/teams?tournamentId=${params.tournamentId}&gender=${gender}`}>Go to teams</Link></section>:
    <><section className="auction-config-section"><div><span className="eyebrow">PARTICIPATING TEAMS</span><h2>Select teams</h2><p>Only teams created for this tournament and competition can be selected.</p></div><div className="auction-team-list">{teams.map(team=><label className={selected.includes(team.id)?"auction-team selected":"auction-team"} key={team.id}><input type="checkbox" checked={selected.includes(team.id)} onChange={()=>setSelected(current=>current.includes(team.id)?current.filter(id=>id!==team.id):[...current,team.id])}/><span className="team-logo">{team.logoUrl?<img src={team.logoUrl} alt=""/>:team.shortName}</span><span><strong>{team.name}</strong><small>{team.shortName} · {formatTeamBudget(team.totalBudget)}</small></span></label>)}</div></section>
    <section className="auction-config-section"><span className="eyebrow">AUCTION RULES</span><div className="auction-rule-grid">
      <label>Purse per team<input type="number" min="1" value={purse} onChange={e=>setPurse(e.target.value)}/></label>
      <label>Minimum squad size<input type="number" min="1" value={minSquad} onChange={e=>setMinSquad(e.target.value)}/></label>
      <label>Maximum squad size<input type="number" min="1" value={maxSquad} onChange={e=>setMaxSquad(e.target.value)}/></label>
      <label>Bid increment<input type="number" min="1" value={increment} onChange={e=>setIncrement(e.target.value)}/></label>
    </div></section>
    <div className="tournament-actions"><button className="button button-dark" type="button" disabled={saving} onClick={()=>void save()}>{saving?"Saving...":"Save auction configuration"}</button><Link className="button button-outline" href={`/admin/tournaments/${params.tournamentId}`}>Cancel</Link></div></>}
  </div></AdminShell>;
}
function formatTeamBudget(value:number){return `₹${value.toLocaleString("en-IN")}`;}
