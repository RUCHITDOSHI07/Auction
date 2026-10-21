"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import ExcelUpload from "@/components/excel/ExcelUpload";
import type { AuctionConfig } from "@/types/auction-config";
import type { MongoPlayer } from "@/lib/services/players";
import type { Team } from "@/types/team";
import {
  DEFAULT_TOURNAMENT_CATEGORY_PRICES,
  MAX_PREMIUM_PLAYERS_PER_TEAM,
} from "@/lib/auction/category-rules";
import type {
  CompetitionGender,
  Tournament,
  TournamentCategoryRules,
} from "@/types/tournament";
import { normalizeTournamentPlayerCategory } from "@/lib/auction/category-rules";

type SetupPlayer = MongoPlayer & {
  tournament?: {
    basePrice: number;
    status: string;
    teamId?: string;
    soldPrice?: number;
    iconPurchase?: boolean;
  };
};
type TeamForm = {
  name: string;
  shortName: string;
  ownerName: string;
};
type AuctionForm = {
  teamIds: string[];
  pursePerTeam: string;
  minimumSquadSize: string;
  maximumSquadSize: string;
  bidIncrement: string;
};
type SetupData = {
  tournament: Tournament;
  teams: Record<CompetitionGender, Team[]>;
  players: SetupPlayer[];
  configs: Record<CompetitionGender, AuctionConfig | null>;
  auctionForms: Record<CompetitionGender, AuctionForm>;
  iconAssignments: Record<CompetitionGender, Record<string, string>>;
};

const genders: CompetitionGender[] = ["male", "female"];
const emptyTeamForm: TeamForm = {
  name: "",
  shortName: "",
  ownerName: "",
};

function emptyAuctionForm(): AuctionForm {
  return {
    teamIds: [],
    pursePerTeam: "100000",
    minimumSquadSize: "8",
    maximumSquadSize: "11",
    bidIncrement: "1000",
  };
}

function defaultCategoryRules(): TournamentCategoryRules {
  return {
    enabled: false,
    basePrices: { ...DEFAULT_TOURNAMENT_CATEGORY_PRICES },
    generalIconPrice: 15000,
    maxPremiumPlayersPerTeam: MAX_PREMIUM_PLAYERS_PER_TEAM,
  };
}

function label(gender: CompetitionGender) {
  return gender === "male" ? "Men's" : "Women's";
}

function formatMoney(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export default function TournamentSetupWizard() {
  const params = useParams<{ tournamentId: string }>();
  const router = useRouter();
  const tournamentId = params.tournamentId;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Record<CompetitionGender, Team[]>>({ male: [], female: [] });
  const [players, setPlayers] = useState<SetupPlayer[]>([]);
  const [configs, setConfigs] = useState<Record<CompetitionGender, AuctionConfig | null>>({ male: null, female: null });
  const [auctionForms, setAuctionForms] = useState<Record<CompetitionGender, AuctionForm>>({
    male: emptyAuctionForm(),
    female: emptyAuctionForm(),
  });
  const [categoryRules, setCategoryRules] = useState<Record<CompetitionGender, TournamentCategoryRules>>({
    male: defaultCategoryRules(),
    female: defaultCategoryRules(),
  });
  const [teamForm, setTeamForm] = useState<TeamForm>(emptyTeamForm);
  const [teamGender, setTeamGender] = useState<CompetitionGender>("male");
  const [auctionGender, setAuctionGender] = useState<CompetitionGender>("male");
  const [iconGender, setIconGender] = useState<CompetitionGender>("male");
  const [iconAssignments, setIconAssignments] = useState<Record<CompetitionGender, Record<string, string>>>({
    male: {},
    female: {},
  });
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledGenders = useMemo(
    () => genders.filter((gender) => tournament?.competitions[gender].enabled),
    [tournament],
  );
  const iconGenders = useMemo(
    () => enabledGenders.filter((gender) =>
      categoryRules[gender].enabled && teams[gender].length > 0,
    ),
    [categoryRules, enabledGenders, teams],
  );
  const configuredGenders = useMemo(
    () => enabledGenders.filter((gender) => teams[gender].length > 0),
    [enabledGenders, teams],
  );
  const stepNames = useMemo(
    () => ["Teams", "Import players", "Auction rules", ...(iconGenders.length ? ["Icon players"] : [])],
    [iconGenders.length],
  );

  const loadData = useCallback(async (): Promise<SetupData> => {
    const tournamentResponse = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}`);
    const tournamentResult = await tournamentResponse.json() as { tournament?: Tournament; error?: string };
    if (!tournamentResponse.ok || !tournamentResult.tournament) {
      throw new Error(tournamentResult.error ?? "Unable to load tournament.");
    }
    const loadedTournament = tournamentResult.tournament;
    const activeGenders = genders.filter((gender) => loadedTournament.competitions[gender].enabled);
    const [teamResults, playerResponse, configResults] = await Promise.all([
      Promise.all(activeGenders.map(async (gender) => {
        const response = await fetch(`/api/teams?tournamentId=${encodeURIComponent(tournamentId)}&gender=${gender}`);
        const result = await response.json() as { teams?: Team[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? `Unable to load ${label(gender).toLowerCase()} teams.`);
        return [gender, result.teams ?? []] as const;
      })),
      fetch(`/api/tournament-players?tournamentId=${encodeURIComponent(tournamentId)}`),
      Promise.all(activeGenders.map(async (gender) => {
        const response = await fetch(`/api/auction-config?tournamentId=${encodeURIComponent(tournamentId)}&gender=${gender}`);
        const result = await response.json() as { config?: AuctionConfig | null; error?: string };
        if (!response.ok) throw new Error(result.error ?? `Unable to load ${label(gender).toLowerCase()} auction settings.`);
        return [gender, result.config ?? null] as const;
      })),
    ]);
    const playerResult = await playerResponse.json() as { players?: SetupPlayer[]; error?: string };
    if (!playerResponse.ok) throw new Error(playerResult.error ?? "Unable to load tournament players.");
    const nextTeams: Record<CompetitionGender, Team[]> = { male: [], female: [] };
    for (const [gender, list] of teamResults) nextTeams[gender] = list;
    const nextConfigs: Record<CompetitionGender, AuctionConfig | null> = { male: null, female: null };
    const nextForms: Record<CompetitionGender, AuctionForm> = {
      male: emptyAuctionForm(),
      female: emptyAuctionForm(),
    };
    for (const [gender, config] of configResults) {
      nextConfigs[gender] = config;
      if (config) {
        nextForms[gender] = {
          teamIds: [...config.teamIds],
          pursePerTeam: String(config.pursePerTeam),
          minimumSquadSize: String(config.minimumSquadSize),
          maximumSquadSize: String(config.maximumSquadSize),
          bidIncrement: String(config.bidIncrement),
        };
      } else {
        nextForms[gender].teamIds = nextTeams[gender].map((team) => team.id);
      }
    }
    const loadedPlayers = playerResult.players ?? [];
    const nextIcons: Record<CompetitionGender, Record<string, string>> = { male: {}, female: {} };
    for (const player of loadedPlayers) {
      if (player.tournament?.iconPurchase && player.tournament.teamId && player.gender) {
        nextIcons[player.gender][player.tournament.teamId] = player.id;
      }
    }
    return {
      tournament: loadedTournament,
      teams: nextTeams,
      players: loadedPlayers,
      configs: nextConfigs,
      auctionForms: nextForms,
      iconAssignments: nextIcons,
    };
  }, [tournamentId]);

  const applyData = useCallback((data: SetupData) => {
    setTournament(data.tournament);
    setTeams(data.teams);
    setPlayers(data.players);
    setConfigs(data.configs);
    setAuctionForms(data.auctionForms);
    setIconAssignments(data.iconAssignments);
    setCategoryRules({
      male: data.tournament.competitions.male.categoryRules ?? defaultCategoryRules(),
      female: data.tournament.competitions.female.categoryRules ?? defaultCategoryRules(),
    });
    const activeGenders = genders.filter((gender) => data.tournament.competitions[gender].enabled);
    setTeamGender((current) => activeGenders.includes(current) ? current : activeGenders[0] ?? "male");
    setAuctionGender((current) =>
      activeGenders.includes(current) && data.teams[current].length > 0
        ? current
        : activeGenders.find((gender) => data.teams[gender].length > 0) ?? activeGenders[0] ?? "male",
    );
    setIconGender((current) =>
      activeGenders.includes(current) && data.teams[current].length > 0
        ? current
        : activeGenders.find((gender) => data.teams[gender].length > 0) ?? activeGenders[0] ?? "male",
    );
  }, []);

  const refreshData = useCallback(async () => {
    try {
      applyData(await loadData());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to refresh tournament setup.");
    }
  }, [applyData, loadData]);

  useEffect(() => {
    let active = true;
    void loadData()
      .then((data) => { if (active) applyData(data); })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load tournament setup.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyData, loadData]);

  async function createTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          gender: teamGender,
          ...teamForm,
          totalBudget: 100000,
          squadSize: 11,
        }),
      });
      const result = await response.json() as { team?: Team; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to create team.");
      setTeams((current) => ({
        ...current,
        [teamGender]: [...current[teamGender], result.team!].sort((left, right) => left.name.localeCompare(right.name)),
      }));
      setAuctionForms((current) => ({
        ...current,
        [teamGender]: {
          ...current[teamGender],
          teamIds: [...new Set([...current[teamGender].teamIds, result.team!.id])],
        },
      }));
      setTeamForm(emptyTeamForm);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create team.");
    } finally {
      setSaving(false);
    }
  }

  function setAuctionForm(gender: CompetitionGender, update: Partial<AuctionForm>) {
    setAuctionForms((current) => ({
      ...current,
      [gender]: { ...current[gender], ...update },
    }));
  }

  function setCategoryRule(gender: CompetitionGender, update: Partial<TournamentCategoryRules>) {
    setCategoryRules((current) => ({
      ...current,
      [gender]: { ...current[gender], ...update },
    }));
  }

  function canEditCategoryRules(gender: CompetitionGender) {
    return players.every((player) => player.gender !== gender)
      && !configs[gender]?.playerPoolIds;
  }

  async function saveCategoryRules() {
    const editableGenders = enabledGenders.filter(canEditCategoryRules);
    if (editableGenders.length === 0) {
      setStep(1);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryRules: Object.fromEntries(
            editableGenders.map((gender) => [gender, categoryRules[gender]]),
          ),
        }),
      });
      const result = await response.json() as { tournament?: Tournament; error?: string };
      if (!response.ok || !result.tournament) {
        throw new Error(result.error ?? "Unable to save competition category rules.");
      }
      setTournament(result.tournament);
      setCategoryRules({
        male: result.tournament.competitions.male.categoryRules ?? defaultCategoryRules(),
        female: result.tournament.competitions.female.categoryRules ?? defaultCategoryRules(),
      });
      setStep(1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save competition category rules.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAuctionConfigs() {
    setSaving(true);
    setError(null);
    try {
      for (const gender of enabledGenders.filter((competition) => teams[competition].length > 0)) {
        const form = auctionForms[gender];
        const response = await fetch("/api/auction-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tournamentId,
            gender,
            teamIds: form.teamIds,
            pursePerTeam: Number(form.pursePerTeam),
            minimumSquadSize: Number(form.minimumSquadSize),
            maximumSquadSize: Number(form.maximumSquadSize),
            bidIncrement: Number(form.bidIncrement),
          }),
        });
        const result = await response.json() as { config?: AuctionConfig; error?: string };
        if (!response.ok) throw new Error(result.error ?? `Unable to save ${label(gender).toLowerCase()} auction settings.`);
        setConfigs((current) => ({ ...current, [gender]: result.config ?? null }));
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save auction settings.");
      setSaving(false);
      return;
    }
    setSaving(false);
    if (iconGenders.length > 0) {
      setStep((current) => current + 1);
    } else {
      router.push(`/admin/tournaments/${encodeURIComponent(tournamentId)}`);
    }
  }

  async function saveIconAssignments() {
    setSaving(true);
    setError(null);
    try {
      for (const gender of iconGenders) {
        if (players.some((player) => player.tournament?.iconPurchase && player.gender === gender)) continue;
        const assignments = Object.entries(iconAssignments[gender])
          .filter(([, playerId]) => Boolean(playerId))
          .map(([teamId, playerId]) => ({ teamId, playerId }));
        if (assignments.length === 0) continue;
        const response = await fetch("/api/auction-config/icons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tournamentId, gender, assignments }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error ?? `Unable to assign ${label(gender).toLowerCase()} icon players.`);
      }
      router.push(`/admin/tournaments/${encodeURIComponent(tournamentId)}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to assign icon players.");
    } finally {
      setSaving(false);
    }
  }

  function canContinueFromTeams() {
    return enabledGenders.some((gender) => teams[gender].length > 0);
  }

  function allConfigsSaved() {
    return enabledGenders.every((gender) =>
      teams[gender].length === 0 || Boolean(configs[gender]),
    );
  }

  if (loading) {
    return <AdminShell><div className="content-wrap"><section className="panel"><p>Loading tournament setup...</p></section></div></AdminShell>;
  }
  if (!tournament) {
    return <AdminShell><div className="content-wrap"><section className="panel"><p>{error ?? "Tournament not found."}</p><Link className="button button-outline" href="/admin/tournaments">Back to tournaments</Link></section></div></AdminShell>;
  }

  const currentStep = Math.min(step, stepNames.length - 1);
  const currentStepName = stepNames[currentStep];

  return (
    <AdminShell>
      <div className="content-wrap tournament-content tournament-setup-wizard">
        <Link className="back-link" href={`/admin/tournaments/${encodeURIComponent(tournamentId)}`}>← {tournament.name}</Link>
        <div className="auction-config-head">
          <div>
            <span className="eyebrow">TOURNAMENT SETUP · STEP {currentStep + 1} OF {stepNames.length}</span>
            <h1>{currentStepName}</h1>
            <p>Set up teams, import the tournament player pool, configure the auction, and optionally assign icon players.</p>
          </div>
          <span className="config-draft">{tournament.season} · {tournament.name}</span>
        </div>
        <nav className="setup-step-indicators" aria-label="Tournament setup steps">
          {stepNames.map((name, index) => (
            <span className={index === currentStep ? "setup-step active" : index < currentStep ? "setup-step complete" : "setup-step"} key={name}>
              <b>{index + 1}</b>{name}
            </span>
          ))}
        </nav>
        {error && <div className="tournament-error" role="alert">{error}</div>}

        {currentStepName === "Teams" && (
          <>
            <section className="auction-config-section">
              <div className="setup-gender-tabs">
                {enabledGenders.map((gender) => (
                  <button className={teamGender === gender ? "button button-dark" : "button button-outline"} key={gender} type="button" onClick={() => setTeamGender(gender)}>
                    {label(gender)} teams · {teams[gender].length || "Not set up"}
                  </button>
                ))}
              </div>
              <div className="setup-section-title">
                <div>
                  <span className="eyebrow">{label(teamGender).toUpperCase()} COMPETITION</span>
                  <h2>Registered teams</h2>
                  <p>Add every team that will participate. Purse and squad limits are configured in the auction step.</p>
                </div>
                <div className="setup-team-count"><strong>{teams[teamGender].length}</strong><span>teams added</span></div>
              </div>
              {teams[teamGender].length > 0 && (
                <div className="setup-team-list">
                  {teams[teamGender].map((team, index) => (
                    <article className="setup-team-card" key={team.id}>
                      <span className="setup-team-index">{String(index + 1).padStart(2, "0")}</span>
                      <div className="setup-team-name"><small>TEAM</small><strong>{team.name}</strong></div>
                      <span className="setup-team-code">{team.shortName}</span>
                    </article>
                  ))}
                </div>
              )}
              {teams[teamGender].length === 0 && (
                <div className="setup-empty-state">
                  <span className="setup-empty-icon">+</span>
                  <strong>No teams added yet</strong>
                  <small>Start by adding the first team for this competition.</small>
                </div>
              )}
              <section className="setup-category-rules">
                <div className="setup-section-title">
                  <div>
                    <span className="eyebrow">PLAYER CATEGORIES</span>
                    <h2>Category players & icon assignments</h2>
                    <p>Configure category pricing before importing the player Excel file. Icon players are assigned after auction rules are saved.</p>
                  </div>
                </div>
                <label className="category-rules-toggle">
                  <input
                    type="checkbox"
                    checked={categoryRules[teamGender].enabled}
                    disabled={!canEditCategoryRules(teamGender)}
                    onChange={(event) => setCategoryRule(teamGender, { enabled: event.target.checked })}
                  />
                  <span>
                    <strong>Enable category pricing for {label(teamGender).toLowerCase()}</strong>
                    <small>Category A/B/C players count toward the two-player team limit. General players are not limited.</small>
                  </span>
                </label>
                {categoryRules[teamGender].enabled && (
                  <div className="category-rule-grid">
                    {(["A", "B", "C", "General"] as const).map((category) => (
                      <label key={category}>
                        Category {category} base price
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={categoryRules[teamGender].basePrices[category]}
                          disabled={!canEditCategoryRules(teamGender)}
                          onChange={(event) => setCategoryRule(teamGender, {
                            basePrices: {
                              ...categoryRules[teamGender].basePrices,
                              [category]: Number(event.target.value),
                            },
                          })}
                        />
                      </label>
                    ))}
                    <label>
                      General icon-player price
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={categoryRules[teamGender].generalIconPrice}
                        disabled={!canEditCategoryRules(teamGender)}
                        onChange={(event) => setCategoryRule(teamGender, { generalIconPrice: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                )}
                {!canEditCategoryRules(teamGender) && (
                  <p className="tournament-help">Category rules are locked because this competition already has imported players or an initialized auction.</p>
                )}
              </section>
              <form className="setup-team-form" onSubmit={(event) => void createTeam(event)}>
                <div className="team-form-grid">
                  <label>Team name<input required placeholder="e.g. PNPL Panthers" value={teamForm.name} onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })} /></label>
                  <label>Short name<input required maxLength={8} placeholder="e.g. PNP" value={teamForm.shortName} onChange={(event) => setTeamForm({ ...teamForm, shortName: event.target.value })} /></label>
                  <label className="setup-owner-field">Owner / manager <span>Optional</span><input placeholder="Add a contact name" value={teamForm.ownerName} onChange={(event) => setTeamForm({ ...teamForm, ownerName: event.target.value })} /></label>
                </div>
                <div className="setup-form-footer">
                  <small>Starting purse and squad limits will be set in the next step.</small>
                  <button className="button button-dark" type="submit" disabled={saving}>{saving ? "Adding team..." : `Add ${label(teamGender).toLowerCase()} team`}</button>
                </div>
              </form>
            </section>
            <div className="tournament-actions">
              <button className="button button-dark" type="button" disabled={saving || !canContinueFromTeams()} onClick={() => void saveCategoryRules()}>
                {saving ? "Saving..." : "Save rules and continue to player import"}
              </button>
              <Link className="button button-outline" href={`/admin/tournaments/${encodeURIComponent(tournamentId)}`}>Save and exit</Link>
            </div>
            {!canContinueFromTeams()
              ? <p className="tournament-help">Add at least one team to continue. You can set up other enabled competitions later.</p>
              : enabledGenders.some((gender) => teams[gender].length === 0)
                ? <p className="tournament-help">You can continue now and set up the other enabled competition later.</p>
                : null}
          </>
        )}

        {currentStepName === "Import players" && (
          <>
            <section className="auction-config-section">
              <p>Upload one workbook for this tournament. It can contain both men&apos;s and women&apos;s players, but each player is linked only to their own enabled competition. Include a Category column (A, B, C, or General) wherever category pricing is enabled; the server applies that competition&apos;s configured prices.</p>
              <ExcelUpload
                importEndpoint={`/api/tournaments/${encodeURIComponent(tournamentId)}/players/import`}
                backHref={null}
                categoryRules={{
                  male: categoryRules.male.enabled,
                  female: categoryRules.female.enabled,
                }}
                onImportComplete={() => void refreshData()}
              />
              <p className="tournament-help">Imported tournament players: {players.length}. You can also continue and import later from the tournament page.</p>
            </section>
            <div className="tournament-actions">
              <button className="button button-outline" type="button" onClick={() => setStep(0)}>Back</button>
              <button className="button button-dark" type="button" onClick={() => { setStep(2); setError(null); }}>Continue to auction rules</button>
            </div>
          </>
        )}

        {currentStepName === "Auction rules" && (
          <>
            <div className="setup-gender-tabs" role="tablist" aria-label="Auction competition">
              {configuredGenders.map((gender) => (
                <button
                  aria-selected={auctionGender === gender}
                  className={auctionGender === gender ? "button button-dark" : "button button-outline"}
                  key={gender}
                  role="tab"
                  type="button"
                  onClick={() => setAuctionGender(gender)}
                >
                  {label(gender)} auction · {teams[gender].length} teams
                </button>
              ))}
            </div>
            {configuredGenders.length === 0 ? (
              <section className="auction-config-section">
                <h2>No teams configured</h2>
                <p>Add teams to at least one enabled competition before saving auction rules.</p>
              </section>
            ) : (() => {
              const gender = configuredGenders.includes(auctionGender) ? auctionGender : configuredGenders[0];
              const form = auctionForms[gender];
              return (
                <section className="auction-config-section" key={gender}>
                  <span className="eyebrow">{label(gender).toUpperCase()} AUCTION</span>
                  <h2>{label(gender)} settings</h2>
                  <p>Select participating teams, purse, squad limits, and bid increments.</p>
                  <div className="auction-team-list setup-auction-team-list">
                    {teams[gender].map((team) => (
                      <label className={form.teamIds.includes(team.id) ? "auction-team selected" : "auction-team"} key={team.id}>
                        <input
                          type="checkbox"
                          checked={form.teamIds.includes(team.id)}
                          onChange={() => setAuctionForm(gender, {
                            teamIds: form.teamIds.includes(team.id)
                              ? form.teamIds.filter((id) => id !== team.id)
                              : [...form.teamIds, team.id],
                          })}
                        />
                        <span><strong>{team.name}</strong><small>{team.shortName}</small></span>
                      </label>
                    ))}
                  </div>
                  <div className="auction-rule-grid">
                    <label>Purse per team<input type="number" min="1" value={form.pursePerTeam} onChange={(event) => setAuctionForm(gender, { pursePerTeam: event.target.value })} /></label>
                    <label>Minimum squad size<input type="number" min="1" value={form.minimumSquadSize} onChange={(event) => setAuctionForm(gender, { minimumSquadSize: event.target.value })} /></label>
                    <label>Maximum squad size<input type="number" min="1" value={form.maximumSquadSize} onChange={(event) => setAuctionForm(gender, { maximumSquadSize: event.target.value })} /></label>
                    <label>Bid increment<input type="number" min="1" value={form.bidIncrement} onChange={(event) => setAuctionForm(gender, { bidIncrement: event.target.value })} /></label>
                  </div>
                  {configs[gender] && <p className="tournament-help">Saved: {configs[gender]!.teamIds.length} teams, {formatMoney(configs[gender]!.pursePerTeam)} purse.</p>}
                  {categoryRules[gender].enabled ? (
                    <p className="tournament-help">Category pricing is enabled: A/B/C base prices are applied to imported players, and each team may buy at most {categoryRules[gender].maxPremiumPlayersPerTeam} combined A/B/C players. Icon assignments follow this step.</p>
                  ) : (
                    <p className="tournament-help">Category pricing is off for this competition. Turn it on in the Teams step before importing players to enable category prices and icon assignments.</p>
                  )}
                </section>
              );
            })()}
            {enabledGenders.some((gender) => teams[gender].length === 0) && (
              <p className="tournament-help">Competitions without teams are skipped. You can add their teams and configure their auctions later.</p>
            )}
            <div className="tournament-actions">
              <button className="button button-outline" type="button" onClick={() => setStep(1)}>Back</button>
              <button className="button button-dark" type="button" disabled={saving || configuredGenders.length === 0 || configuredGenders.some((gender) => auctionForms[gender].teamIds.length === 0 || Boolean(configs[gender]?.playerPoolIds))} onClick={() => void saveAuctionConfigs()}>
                {saving
                  ? "Saving..."
                  : iconGenders.length > 0
                    ? allConfigsSaved() ? "Save and continue to icon players" : "Save auction settings"
                    : "Save auction settings and finish"}
              </button>
            </div>
          </>
        )}

        {currentStepName === "Icon players" && (
          <>
            <div className="setup-gender-tabs" role="tablist" aria-label="Icon player competition">
              {iconGenders.map((gender) => (
                <button
                  aria-selected={iconGender === gender}
                  className={iconGender === gender ? "button button-dark" : "button button-outline"}
                  key={gender}
                  role="tab"
                  type="button"
                  onClick={() => setIconGender(gender)}
                >
                  {label(gender)} icons
                </button>
              ))}
            </div>
            {iconGenders.filter((gender) => gender === iconGender).map((gender) => {
              const configuredTeams = teams[gender].filter((team) => configs[gender]?.teamIds.includes(team.id));
              const availablePlayers = players.filter((player) =>
                player.gender === gender
                && player.tournament?.status === "available"
                && normalizeTournamentPlayerCategory(player.category) !== null,
              );
              const rules = categoryRules[gender];
              const locked = players.some((player) => player.gender === gender && player.tournament?.iconPurchase);
              return (
                <section className="auction-config-section" key={gender}>
                  <span className="eyebrow">{label(gender).toUpperCase()} ICON PLAYERS</span>
                  <h2>Optional pre-auction assignment</h2>
                  <p>Choose at most one icon player per team. A/B/C players cost their category base price; General icon players cost {formatMoney(rules.generalIconPrice)}. Each icon purchase is deducted from purse and counts toward squad and A/B/C limits.</p>
                  {locked ? <p className="auction-lock-notice">Icon assignments have already been saved for this competition.</p> : (
                    <div className="icon-assignment-list">
                      {configuredTeams.map((team) => {
                        const selectedId = iconAssignments[gender][team.id] ?? "";
                        const selectedPlayer = availablePlayers.find((player) => player.id === selectedId);
                        const selectedCategory = normalizeTournamentPlayerCategory(selectedPlayer?.category);
                        const amount = selectedCategory
                          ? selectedCategory === "General" ? rules.generalIconPrice : rules.basePrices[selectedCategory]
                          : null;
                        return (
                          <label className="icon-assignment-row" key={team.id}>
                            <span><strong>{team.name}</strong><small>{selectedPlayer && amount !== null && amount !== undefined ? `Price: ${formatMoney(amount)}` : "No icon assigned"}</small></span>
                            <select
                              value={selectedId}
                              onChange={(event) => setIconAssignments((current) => ({
                                ...current,
                                [gender]: { ...current[gender], [team.id]: event.target.value },
                              }))}
                              disabled={locked}
                            >
                              <option value="">Skip icon player</option>
                              {availablePlayers.filter((player) =>
                                player.id === selectedId || !Object.values(iconAssignments[gender]).includes(player.id),
                              ).map((player) => <option key={player.id} value={player.id}>{player.name} · {player.category} · {formatMoney(player.tournament?.basePrice ?? 0)} base</option>)}
                            </select>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
            <div className="tournament-actions">
              <button className="button button-outline" type="button" onClick={() => setStep(2)}>Back</button>
              <button className="button button-outline" type="button" disabled={saving} onClick={() => router.push(`/admin/tournaments/${encodeURIComponent(tournamentId)}`)}>Skip icon assignment</button>
              <button className="button button-dark" type="button" disabled={saving} onClick={() => void saveIconAssignments()}>{saving ? "Saving..." : "Save icon players and finish"}</button>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
