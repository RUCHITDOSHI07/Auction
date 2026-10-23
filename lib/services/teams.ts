import type { Collection } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { publicRevisionUpdate, publicTeamAuctionFilter } from "@/lib/auction/public-cache";
import { getIconPlayerPrice, normalizeTournamentPlayerCategory } from "@/lib/auction/category-rules";
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
    collection.createIndex(
      { tournamentId: 1, gender: 1, iconPlayerId: 1 },
      {
        name: "teams_icon_player_unique",
        unique: true,
        partialFilterExpression: { iconPlayerId: { $type: "string" } },
      },
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

function isDuplicateKeyError(error: unknown): error is { code: number; keyPattern?: Record<string, unknown> } {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
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
  const iconPlayerId = cleanText(input.iconPlayerId);
  const gender = normalizeGender(input.gender);
  const totalBudget = Number(input.totalBudget);
  const squadSize = Number(input.squadSize);

  if (input.iconPlayerId !== undefined && typeof input.iconPlayerId !== "string") {
    throw new Error("Icon player must be selected from the tournament player pool.");
  }
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
    ...(iconPlayerId ? { iconPlayerId } : {}),
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

async function assertIconPlayerAvailable(
  tournamentId: string,
  gender: CompetitionGender,
  playerId: string,
  excludeTeamId?: string,
) {
  const database = await getMongoDb();
  const tournament = await assertCompetitionEnabled(tournamentId, gender);
  const iconPlayersEnabled = tournament.competitions[gender].iconPlayersEnabled
    ?? tournament.competitions[gender].categoryRules?.enabled
    ?? false;
  if (!iconPlayersEnabled) {
    throw new Error("Pre-booked icon players are not enabled for this competition.");
  }
  const [playerEntry, player, existingAssignment, initializedAuction] = await Promise.all([
    database.collection("tournamentPlayers").findOne({
      tournamentId,
      gender,
      playerId,
      status: "available",
    }, { projection: { category: 1, basePrice: 1 } }),
    database.collection("players").findOne({ id: playerId, gender }),
    database.collection("teams").findOne({
      tournamentId,
      gender,
      iconPlayerId: playerId,
      ...(excludeTeamId ? { id: { $ne: excludeTeamId } } : {}),
    }),
    database.collection("auctions").findOne({
      tournamentId,
      gender,
      playerPoolIds: { $exists: true },
    }, { projection: { id: 1 } }),
  ]);
  if (initializedAuction) throw new Error("Icon players must be assigned before auction initialization.");
  if (!playerEntry || !player) throw new Error("Icon player must be available in this tournament competition.");
  if (existingAssignment) throw new Error("A player can only be assigned as an icon to one team.");
  const category = normalizeTournamentPlayerCategory(playerEntry.category ?? player.category);
  if (!category) throw new Error("Icon player must have category A, B, C, or General.");
  const price = getIconPlayerPrice(category, playerEntry.basePrice, tournament.competitions[gender].categoryRules);
  if (!Number.isSafeInteger(price) || price <= 0) throw new Error("Icon player has an invalid purchase price.");
}

async function assertTeamSetupUnlocked(team: Pick<Team, "tournamentId" | "gender">) {
  const initializedAuction = await (await getMongoDb()).collection("auctions").findOne({
    tournamentId: team.tournamentId,
    gender: team.gender,
    playerPoolIds: { $exists: true },
  });
  if (initializedAuction) throw new Error("Teams are locked after auction initialization.");
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
  if (normalized.iconPlayerId) {
    await assertIconPlayerAvailable(normalized.tournamentId, normalized.gender, normalized.iconPlayerId);
  }
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
    if (isDuplicateKeyError(error) && error.keyPattern?.iconPlayerId) {
      throw new Error("This icon player is already selected for another team.");
    }
    if (isDuplicateKeyError(error)) {
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
  if (changes.iconPlayerId !== undefined && typeof changes.iconPlayerId !== "string") {
    throw new Error("Icon player must be selected from the tournament player pool.");
  }
  const collection = await getTeamsCollection();
  await ensureTeamIndexes(collection);
  const existing = await getTeamById(teamId);
  if (!existing) throw new Error("Team not found.");
  if (changes.iconPlayerId !== undefined && changes.iconPlayerId !== existing.iconPlayerId) {
    const iconPurchase = await (await getMongoDb()).collection("auctionTransactions").findOne({
      tournamentId: existing.tournamentId,
      gender: existing.gender,
      teamId,
      source: "icon",
      type: "purchase",
    });
    if (iconPurchase) throw new Error("An assigned icon player cannot be changed after its purchase is recorded.");
    if (changes.iconPlayerId.trim()) {
      await assertIconPlayerAvailable(existing.tournamentId, existing.gender, changes.iconPlayerId.trim(), teamId);
    }
  }
  if (changes.name !== undefined || changes.totalBudget !== undefined || changes.squadSize !== undefined || changes.status !== undefined) {
    await assertTeamSetupUnlocked(existing);
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  const unset: Record<string, ""> = {};

  if (changes.name !== undefined) update.name = cleanText(changes.name);
  if (changes.shortName !== undefined) update.shortName = cleanText(changes.shortName).toUpperCase();
  if (changes.iconPlayerId !== undefined) {
    const iconPlayerId = cleanText(changes.iconPlayerId);
    if (iconPlayerId) update.iconPlayerId = iconPlayerId;
    else unset.iconPlayerId = "";
  }
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

  let result: TeamDocument | null;
  try {
    result = await collection.findOneAndUpdate(
      { id: teamId },
      { $set: update, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { returnDocument: "after" },
    );
  } catch (error) {
    if (isDuplicateKeyError(error) && error.keyPattern?.iconPlayerId) {
      throw new Error("This icon player is already selected for another team.");
    }
    throw error;
  }
  if (!result) throw new Error("Team not found.");
  if (changes.shortName !== undefined) {
    await (await getMongoDb()).collection("auctions").updateMany(
      publicTeamAuctionFilter(existing.tournamentId, existing.gender, teamId),
      publicRevisionUpdate("publicMetadataRevision"),
    );
  }
  return toTeam(result);
}

export async function deleteTeam(teamId: string) {
  const collection = await getTeamsCollection();
  await ensureTeamIndexes(collection);
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Team not found.");
  await assertTeamSetupUnlocked(team);
  if (team.playersCount > 0) throw new Error("A team with players assigned cannot be deleted.");
  await collection.deleteOne({ id: teamId });
}
