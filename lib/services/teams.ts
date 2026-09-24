import type { Collection } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { getTournamentById } from "@/lib/services/tournaments";
import type { CompetitionGender } from "@/types/tournament";
import type { Team, TeamInput, TeamStatus } from "@/types/team";

type TeamDocument = Team & { _id?: unknown };

let teamIndexesPromise: Promise<string[]> | undefined;

async function getTeamsCollection(): Promise<Collection<TeamDocument>> {
  const database = await getMongoDb();
  return database.collection<TeamDocument>("teams");
}

async function ensureTeamIndexes(collection: Collection<TeamDocument>) {
  teamIndexesPromise ??= Promise.all([
    collection.createIndex(
      { tournamentId: 1, gender: 1, name: 1 },
      { name: "teams_tournament_gender_name_unique", unique: true },
    ),
    collection.createIndex(
      { tournamentId: 1, gender: 1 },
      { name: "teams_tournament_gender" },
    ),
  ]);
  await teamIndexesPromise;
}

function toTeam(document: TeamDocument): Team {
  const team = { ...document };
  delete team._id;
  return team;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeGender(value: unknown): CompetitionGender {
  const gender = cleanText(value).toLowerCase();
  if (gender !== "male" && gender !== "female") {
    throw new Error("Competition must be male or female.");
  }
  return gender;
}

function normalizeTeamInput(input: TeamInput) {
  const tournamentId = cleanText(input.tournamentId);
  const name = cleanText(input.name);
  const shortName = cleanText(input.shortName).toUpperCase();
  const gender = normalizeGender(input.gender);
  const totalBudget = Number(input.totalBudget);
  const squadSize = Number(input.squadSize);

  if (!tournamentId) throw new Error("Tournament is required.");
  if (!name) throw new Error("Team name is required.");
  if (!shortName) throw new Error("Short name is required.");
  if (!Number.isFinite(totalBudget) || totalBudget <= 0) {
    throw new Error("Total budget must be greater than 0.");
  }
  if (!Number.isInteger(squadSize) || squadSize <= 0) {
    throw new Error("Squad size must be a positive whole number.");
  }

  return {
    tournamentId,
    gender,
    name,
    shortName,
    ownerName: cleanText(input.ownerName) || undefined,
    logoUrl: cleanText(input.logoUrl) || undefined,
    totalBudget,
    squadSize,
  };
}

function makeTeamId(tournamentId: string, gender: CompetitionGender, name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${tournamentId}-${gender}-${slug}`;
}

async function assertCompetitionEnabled(tournamentId: string, gender: CompetitionGender) {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  if (!tournament.competitions[gender].enabled) {
    throw new Error(`${gender === "male" ? "Men's" : "Women's"} competition is not enabled for this tournament.`);
  }
  return tournament;
}

export async function getTeams(tournamentId: string, gender: CompetitionGender): Promise<Team[]> {
  const normalizedGender = normalizeGender(gender);
  await assertCompetitionEnabled(tournamentId, normalizedGender);
  const collection = await getTeamsCollection();
  await ensureTeamIndexes(collection);
  const documents = await collection
    .find({ tournamentId, gender: normalizedGender })
    .sort({ name: 1 })
    .toArray();
  return documents.map(toTeam);
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  const collection = await getTeamsCollection();
  await ensureTeamIndexes(collection);
  const document = await collection.findOne({ id: teamId });
  return document ? toTeam(document) : null;
}

export async function createTeam(input: TeamInput): Promise<Team> {
  const normalized = normalizeTeamInput(input);
  await assertCompetitionEnabled(normalized.tournamentId, normalized.gender);
  const collection = await getTeamsCollection();
  await ensureTeamIndexes(collection);

  const now = new Date();
  const team: Team = {
    id: makeTeamId(normalized.tournamentId, normalized.gender, normalized.name),
    ...normalized,
    remainingBudget: normalized.totalBudget,
    playersCount: 0,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  try {
    await collection.insertOne(team);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      throw new Error("A team with this name already exists in this competition.");
    }
    throw error;
  }

  return team;
}

export async function updateTeam(
  teamId: string,
  changes: Partial<Omit<TeamInput, "tournamentId" | "gender">> & { status?: TeamStatus },
): Promise<Team> {
  const collection = await getTeamsCollection();
  await ensureTeamIndexes(collection);
  const existing = await getTeamById(teamId);
  if (!existing) throw new Error("Team not found.");

  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (changes.name !== undefined) update.name = cleanText(changes.name);
  if (changes.shortName !== undefined) update.shortName = cleanText(changes.shortName).toUpperCase();
  if (changes.ownerName !== undefined) update.ownerName = cleanText(changes.ownerName) || undefined;
  if (changes.logoUrl !== undefined) update.logoUrl = cleanText(changes.logoUrl) || undefined;
  if (changes.status !== undefined) {
    if (changes.status !== "active" && changes.status !== "inactive") throw new Error("Invalid team status.");
    update.status = changes.status;
  }

  if (changes.totalBudget !== undefined) {
    const totalBudget = Number(changes.totalBudget);
    if (!Number.isFinite(totalBudget) || totalBudget <= 0) throw new Error("Total budget must be greater than 0.");
    const spent = existing.totalBudget - existing.remainingBudget;
    update.totalBudget = totalBudget;
    update.remainingBudget = Math.max(0, totalBudget - spent);
  }

  if (changes.squadSize !== undefined) {
    const squadSize = Number(changes.squadSize);
    if (!Number.isInteger(squadSize) || squadSize <= 0) throw new Error("Squad size must be a positive whole number.");
    if (squadSize < existing.playersCount) throw new Error("Squad size cannot be smaller than the current squad count.");
    update.squadSize = squadSize;
  }

  const result = await collection.findOneAndUpdate(
    { id: teamId },
    { $set: update },
    { returnDocument: "after" },
  );
  if (!result) throw new Error("Team not found.");
  return toTeam(result);
}

export async function deleteTeam(teamId: string) {
  const collection = await getTeamsCollection();
  await ensureTeamIndexes(collection);
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Team not found.");
  if (team.playersCount > 0) throw new Error("A team with players assigned cannot be deleted.");
  await collection.deleteOne({ id: teamId });
}
