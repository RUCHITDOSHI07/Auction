"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { PageHeader, StatusBadge } from "@/components/ui/Primitives";
import type { Tournament } from "@/types/tournament";

export default function TournamentOverviewPage(){
  const params=useParams<{tournamentId:string}>(); const [tournament,setTournament]=useState<Tournament|null>(null); const [error,setError]=useState<string|null>(null);
  useEffect(function(){fetch("/api/tournaments/"+params.tournamentId).then(async function(response){const result=await response.json() as {tournament?:Tournament;error?:string};if(!response.ok)throw new Error(result.error??"Unable to load tournament.");setTournament(result.tournament??null);}).catch(function(e){setError(e instanceof Error?e.message:"Unable to load tournament.");});},[params.tournamentId]);
  if(error)return <AdminShell><div className="content-wrap"><div className="panel"><p>{error}</p><Link className="button button-outline" href="/admin/tournaments">Back to tournaments</Link></div></div></AdminShell>;
  if(!tournament)return <AdminShell><div className="content-wrap"><div className="panel"><p>Loading tournament...</p></div></div></AdminShell>;
  const competitions=[tournament.competitions.male.enabled?{key:"male" as const,title:"Men's competition"}:null,tournament.competitions.female.enabled?{key:"female" as const,title:"Women's competition"}:null].filter(Boolean) as {key:"male"|"female";title:string}[];
  return <AdminShell><div className="content-wrap tournament-content">
    <Link className="back-link" href="/admin/tournaments">← All tournaments</Link>
    <PageHeader eyebrow={tournament.season+" SEASON"} title={tournament.name} description={tournament.description||"Tournament control centre."} action={<StatusBadge tone={tournament.status==="active"?"live":tournament.status==="completed"?"success":"neutral"}>{tournament.status.toUpperCase()}</StatusBadge>}/>
    <section className="panel" style={{marginBottom:24}}><div className="section-heading"><div><span className="eyebrow">TOURNAMENT PLAYER POOL</span><h2>Import players once</h2><p>Use one Excel file containing both men and women. The Gender column automatically places players into the correct competition.</p></div><Link className="button button-dark" href={"/admin/tournaments/"+tournament.id+"/players/import"}>⇪ Import players</Link></div></section>
    <section className="competition-overview">{competitions.map(function(c){return <article className="competition-overview-card" key={c.key}><span className="eyebrow">{c.key==="male"?"MEN'S":"WOMEN'S"}</span><h2>{c.title}</h2><p>Teams, auction configuration, player pool, auction and results.</p><div className="competition-links">
      <Link href={"/admin/teams?tournamentId="+tournament.id+"&gender="+c.key}>1. Teams →</Link>
      <Link className="primary" href={"/admin/tournaments/"+tournament.id+"/auction-config?gender="+c.key}>2. Configure Auction →</Link>
      <Link href={"/admin/players?tournamentId="+tournament.id+"&gender="+c.key}>3. Player Pool →</Link>
      <Link href={"/admin/auction?tournamentId="+tournament.id+"&gender="+c.key}>4. Auction →</Link>
    </div></article>})}</section>
  </div></AdminShell>;
}
