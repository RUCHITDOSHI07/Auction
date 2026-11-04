"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { PageHeader, StatusBadge } from "@/components/ui/Primitives";
import ImageFilePicker from "@/components/ui/ImageFilePicker";
import { uploadImageFile } from "@/lib/image-upload-client";
import { optimizedImageUrl } from "@/lib/storage/image-url";
import type { Team } from "@/types/team";
import type { Tournament } from "@/types/tournament";
import type { MongoPlayer } from "@/lib/services/players";
import { getIconPlayerPrice, normalizeTournamentPlayerCategory } from "@/lib/auction/category-rules";

type TeamSetupPlayer = MongoPlayer & { tournament?: { basePrice: number; status: string; teamId?: string; iconPurchase?: boolean } };
type FormState = { name:string; shortName:string; ownerName:string; totalBudget:string; squadSize:string; iconPlayerId:string };
const emptyForm:FormState={name:"",shortName:"",ownerName:"",totalBudget:"100000",squadSize:"11",iconPlayerId:""};

function formatMoney(value:number){return `₹${value.toLocaleString("en-IN")}`;}

function AdminTeamsContent(){
  const searchParams=useSearchParams();
  const tournamentId=searchParams.get("tournamentId")??"";
  const gender=searchParams.get("gender")==="female"?"female":"male";
  const [tournament,setTournament]=useState<Tournament|null>(null);
  const [teams,setTeams]=useState<Team[]>([]);
  const [players,setPlayers]=useState<TeamSetupPlayer[]>([]);
  const [form,setForm]=useState<FormState>(emptyForm);
  const [showForm,setShowForm]=useState(false);
  const [editingTeam,setEditingTeam]=useState<Team|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [success,setSuccess]=useState<string|null>(null);
  const [logoFile,setLogoFile]=useState<File|null>(null);
  const [removeLogo,setRemoveLogo]=useState(false);
  const [uploadProgress,setUploadProgress]=useState<number|null>(null);

  const loadData=useCallback(async()=>{
    if(!tournamentId)return null;
    const [tr,tm]=await Promise.all([
      fetch(`/api/tournaments/${tournamentId}`),
      fetch(`/api/teams?tournamentId=${encodeURIComponent(tournamentId)}&gender=${gender}`)
    ]);
    const tournamentResult=await tr.json() as {tournament?:Tournament;error?:string};
    const teamsResult=await tm.json() as {teams?:Team[];error?:string};
    if(!tr.ok)throw new Error(tournamentResult.error??"Unable to load tournament.");
    if(!tm.ok)throw new Error(teamsResult.error??"Unable to load teams.");
    const loadedTournament=tournamentResult.tournament??null;
    const iconPlayersEnabled=loadedTournament?.competitions[gender].iconPlayersEnabled
      ??loadedTournament?.competitions[gender].categoryRules?.enabled
      ??false;
    let loadedPlayers:TeamSetupPlayer[]=[];
    if(iconPlayersEnabled){
      const response=await fetch(`/api/tournament-players?tournamentId=${encodeURIComponent(tournamentId)}&gender=${gender}`);
      const result=await response.json() as {players?:TeamSetupPlayer[];error?:string};
      if(!response.ok)throw new Error(result.error??"Unable to load tournament players.");
      loadedPlayers=result.players??[];
    }
    return {
      tournament:loadedTournament,
      teams:teamsResult.teams??[],
      players:loadedPlayers,
    };
  },[tournamentId,gender]);

  useEffect(()=>{
    let active=true;
    void loadData().then(data=>{
      if(active&&data){setTournament(data.tournament);setTeams(data.teams);setPlayers(data.players);}
    }).catch(e=>{
      if(active)setError(e instanceof Error?e.message:"Unable to load teams.");
    }).finally(()=>{
      if(active)setLoading(false);
    });
    return ()=>{active=false;};
  },[loadData]);

  const title=gender==="female"?"Women's Teams":"Men's Teams";
  const competitionEnabled=tournament?.competitions[gender].enabled??false;
  const iconPlayersEnabled=tournament?.competitions[gender].iconPlayersEnabled
    ?? tournament?.competitions[gender].categoryRules?.enabled
    ?? false;
  const selectedIconIsLocked=Boolean(form.iconPlayerId&&players.some(player=>player.id===form.iconPlayerId&&player.tournament?.iconPurchase));
  const availableIconPlayers=players.filter(player=>
    (player.tournament?.status==="available"||player.id===form.iconPlayerId)
    &&normalizeTournamentPlayerCategory(player.category)!==null
    &&!teams.some(team=>team.id!==editingTeam?.id&&team.iconPlayerId===player.id)
  );
  const budgetTotal=useMemo(()=>teams.reduce((sum,team)=>sum+team.totalBudget,0),[teams]);

  function startEdit(team:Team){
    setEditingTeam(team);
    setForm({name:team.name,shortName:team.shortName,ownerName:team.ownerName??"",totalBudget:String(team.totalBudget),squadSize:String(team.squadSize),iconPlayerId:team.iconPlayerId??""});
    setLogoFile(null);
    setRemoveLogo(false);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function closeForm(){
    setShowForm(false);setEditingTeam(null);setForm(emptyForm);setLogoFile(null);setRemoveLogo(false);setUploadProgress(null);setError(null);
  }

  async function saveTeam(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);setError(null);setSuccess(null);
    let savedTeam:Team|undefined;
    let teamDetailsSaved=false;
    try{
      const teamDetailsChanged=!editingTeam
        ||form.name.trim()!==editingTeam.name
        ||form.shortName.trim().toUpperCase()!==editingTeam.shortName
        ||form.ownerName.trim()!==(editingTeam.ownerName??"")
        ||Number(form.totalBudget)!==editingTeam.totalBudget
        ||Number(form.squadSize)!==editingTeam.squadSize
        ||form.iconPlayerId!== (editingTeam.iconPlayerId??"");
      const teamChanges={name:form.name,shortName:form.shortName,ownerName:form.ownerName,totalBudget:Number(form.totalBudget),squadSize:Number(form.squadSize),iconPlayerId:form.iconPlayerId};
      let imageWarning:string|undefined;
      if(teamDetailsChanged){
        const endpoint=editingTeam?`/api/teams/${encodeURIComponent(editingTeam.id)}`:"/api/teams";
        const response=await fetch(endpoint,{method:editingTeam?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(editingTeam?teamChanges:{tournamentId,gender,...teamChanges})});
        const result=await response.json() as {team?:Team;error?:string;warning?:string};
        if(!response.ok)throw new Error(result.error??"Unable to save team details.");
        if(!result.team)throw new Error("The team was saved without a response record.");
        savedTeam=result.team;
        teamDetailsSaved=true;
        imageWarning=result.warning;
      }else if(editingTeam){
        savedTeam=editingTeam;
      }else{
        throw new Error("Unable to create team.");
      }

      let imageChanged=false;
      if(logoFile){
        setUploadProgress(0);
        const imageResult=await uploadImageFile(`/api/teams/${encodeURIComponent(savedTeam.id)}/image`,logoFile,setUploadProgress);
        const imageTeam=imageResult.team as Team|undefined;
        if(!imageTeam)throw new Error("Logo upload completed, but the updated team could not be loaded.");
        savedTeam=imageTeam;
        imageChanged=true;
        imageWarning=[imageWarning,imageResult.warning].filter(Boolean).join(" ")||undefined;
      }else if(removeLogo&&editingTeam?.logoUrl){
        const imageResponse=await fetch(`/api/teams/${encodeURIComponent(savedTeam.id)}/image`,{method:"DELETE"});
        const imageResult=await imageResponse.json() as {team?:Team;error?:string;warning?:string};
        if(!imageResponse.ok)throw new Error(imageResult.error??"Team was saved, but its logo could not be removed.");
        if(!imageResult.team)throw new Error("Logo removal completed, but the updated team could not be loaded.");
        savedTeam=imageResult.team;
        imageChanged=true;
        imageWarning=[imageWarning,imageResult.warning].filter(Boolean).join(" ")||undefined;
      }
      if(teamDetailsSaved||imageChanged){
        setTeams(current=>{const next=editingTeam?current.map(team=>team.id===savedTeam!.id?savedTeam!:team):[...current,savedTeam!];return next.sort((a,b)=>a.name.localeCompare(b.name));});
      }
      closeForm();
      if(imageWarning)setError(imageWarning);
      else if(imageChanged)setSuccess(logoFile?"Team logo uploaded and saved to Cloudinary.":"Team logo removed.");
      else if(teamDetailsSaved)setSuccess("Team details saved.");
    }catch(e){
      if(teamDetailsSaved&&savedTeam){
        setTeams(current=>{const next=editingTeam?current.map(team=>team.id===savedTeam!.id?savedTeam!:team):[...current,savedTeam!];return next.sort((a,b)=>a.name.localeCompare(b.name));});
        closeForm();
        setError(`Team details were saved, but the logo change failed: ${e instanceof Error?e.message:"Unable to update team logo."}`);
      }else setError(e instanceof Error?e.message:"Unable to save team.");
    }
    finally{setSaving(false);}
  }

  if(!tournamentId)return <AdminShell><div className="content-wrap"><PageHeader eyebrow="TOURNAMENT TEAMS" title="Teams" description="Choose a tournament and competition before managing teams." action={<Link className="button button-outline" href="/admin/tournaments">Choose tournament</Link>}/><section className="panel"><p>Select a tournament first. Men&apos;s and women&apos;s teams are stored separately.</p></section></div></AdminShell>;

  return <AdminShell><div className="content-wrap tournament-content">
    <Link className="back-link" href={`/admin/tournaments/${tournamentId}`}>← {tournament?.name??"Tournament"}</Link>
    <PageHeader eyebrow={`${tournament?.season??""} · ${gender==="male"?"MEN'S":"WOMEN'S"}`} title={title} description={`Teams registered for ${tournament?.name??"this tournament"}.`} action={<button className="button button-dark" type="button" onClick={()=>{if(showForm)closeForm();else{setEditingTeam(null);setForm(emptyForm);setShowForm(true);setError(null);setSuccess(null);}}} disabled={!competitionEnabled}>{showForm?"Close form":"Add team"}</button>}/>
    <section className="team-context-bar"><div><span>Competition</span><strong>{gender==="male"?"Men's":"Women's"}</strong></div><div><span>Teams</span><strong>{teams.length}</strong></div><div><span>Total allocated budget</span><strong>{formatMoney(budgetTotal)}</strong></div></section>
    {!competitionEnabled&&<div className="tournament-error">This competition is not enabled for this tournament.</div>}
    {error&&<div className="team-form-feedback team-form-feedback-error" role="alert">{error}</div>}
    {success&&<div className="team-form-feedback team-form-feedback-success" role="status">{success}</div>}
    {showForm&&competitionEnabled&&<form className="team-form" onSubmit={saveTeam}><div className="team-form-grid">
      <label>Team name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Mumbai Strikers"/></label>
      <label>Short name<input required maxLength={8} value={form.shortName} onChange={e=>setForm({...form,shortName:e.target.value})} placeholder="MS"/></label>
      <label>Owner / manager<input value={form.ownerName} onChange={e=>setForm({...form,ownerName:e.target.value})} placeholder="Optional"/></label>
      <label>Starting budget<input required type="number" min="1" step="1" value={form.totalBudget} onChange={e=>setForm({...form,totalBudget:e.target.value})}/></label>
      <label>Squad size<input required type="number" min="1" step="1" value={form.squadSize} onChange={e=>setForm({...form,squadSize:e.target.value})}/></label>
      {iconPlayersEnabled&&<label>Pre-booked icon player<select value={form.iconPlayerId} disabled={selectedIconIsLocked} onChange={e=>setForm({...form,iconPlayerId:e.target.value})}><option value="">No icon player</option>{availableIconPlayers.map(player=>{const category=normalizeTournamentPlayerCategory(player.category);const price=category?getIconPlayerPrice(category,player.tournament?.basePrice??0,tournament?.competitions[gender].categoryRules):0;return <option key={player.id} value={player.id}>{player.name} · {player.category} · {formatMoney(price)}</option>;})}</select><small>One per team. The purchase is charged when auction rules are saved.</small></label>}
    </div><ImageFilePicker label="Upload team photo / logo (optional)" currentUrl={removeLogo?undefined:editingTeam?.logoUrl} fallback={form.shortName.slice(0,3)||"PN"} file={logoFile} imageCrop="fit" trimTransparentPadding disabled={saving} onFileChange={file=>{setLogoFile(file);if(file)setRemoveLogo(false);}}/>{editingTeam?.logoUrl&&!logoFile&&!removeLogo&&<button className="button button-outline" type="button" disabled={saving} onClick={()=>setRemoveLogo(true)}>Remove saved logo</button>}{removeLogo&&<button className="button button-outline" type="button" disabled={saving} onClick={()=>setRemoveLogo(false)}>Keep current logo</button>}{uploadProgress!==null&&<p role="status">Uploading logo… {uploadProgress}%</p>}<div className="tournament-actions"><button className="button button-dark" type="submit" disabled={saving}>{saving?(uploadProgress!==null?"Uploading logo…":editingTeam?"Saving...":"Creating..."):(editingTeam?"Save changes":"Create team")}</button><button className="button button-outline" type="button" onClick={closeForm} disabled={saving}>Cancel</button></div></form>}
    {!loading&&teams.length===0&&<section className="panel team-empty"><h2>No teams yet</h2><p>Add the teams that will participate in this competition.</p></section>}
    {loading&&<section className="panel"><p>Loading teams...</p></section>}
    {!loading&&teams.length>0&&<section className="team-grid team-grid-modern">{teams.map(team=><article className="team-admin-card" key={team.id}><div className="team-admin-card-top"><div className="team-logo">{team.logoUrl?<img src={optimizedImageUrl(team.logoUrl,{width:256,height:256,crop:"fit",trim:true})} alt="" width="256" height="256" loading="lazy" decoding="async"/>:team.shortName}</div><StatusBadge tone={team.status==="active"?"success":"neutral"}>{team.status.toUpperCase()}</StatusBadge></div><h2>{team.name}</h2><p>{team.ownerName||"No owner / manager set"}</p><div className="team-admin-metrics"><div><span>Budget</span><strong>{formatMoney(team.remainingBudget)}</strong><small>remaining</small></div><div><span>Squad</span><strong>{team.playersCount}/{team.squadSize}</strong><small>players</small></div></div><div className="tournament-actions"><button className="button button-outline" type="button" onClick={()=>startEdit(team)}>Edit team</button><button className="button button-outline" type="button" onClick={async()=>{if(team.playersCount>0){setError("A team with players assigned cannot be deleted.");return;}if(!window.confirm(`Delete ${team.name}?`))return;const response=await fetch(`/api/teams/${encodeURIComponent(team.id)}`,{method:"DELETE"});const result=await response.json() as {error?:string};if(!response.ok){setError(result.error??"Unable to delete team.");return;}setTeams(current=>current.filter(item=>item.id!==team.id));}}>Delete</button></div></article>)}</section>}
  </div></AdminShell>;
}

export default function AdminTeamsPage(){
  return <Suspense fallback={<AdminShell><div className="content-wrap"><section className="panel"><p>Loading teams...</p></section></div></AdminShell>}><AdminTeamsContent /></Suspense>;
}
