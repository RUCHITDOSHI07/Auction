import type { Collection } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { getTournamentById } from "@/lib/services/tournaments";
import { normalizePlayerGender } from "@/lib/players";
import { bulkUpsertPlayers, getPlayerById, getPlayers } from "@/lib/services/players";
import { findPlayerIdentityMatch, playerImportIdentity, playerImportName } from "@/lib/players/import-identity";
import type { CompetitionGender } from "@/types/tournament";
import type { PlayerInput } from "@/types/firestore";
import { getTournamentCategoryBasePrice } from "@/lib/auction/category-rules";

export interface TournamentPlayer {
  tournamentId: string;
  playerId: string;
  gender: CompetitionGender;
  category?: string;
  basePrice: number;
  status: "available" | "on_auction" | "sold" | "unsold";
  teamId?: string;
  soldPrice?: number;
  iconPurchase?: boolean;
  createdAt: Date;
  updatedAt: Date;
  auctionId?: string;
  lastAuctionRound?: number;
}

type TournamentPlayerDocument = TournamentPlayer & { _id?: unknown };
let indexPromise: Promise<string[]> | undefined;

async function collection(): Promise<Collection<TournamentPlayerDocument>> {
  return (await getMongoDb()).collection<TournamentPlayerDocument>("tournamentPlayers");
}

async function ensureIndexes(c: Collection<TournamentPlayerDocument>) {
  indexPromise ??= Promise.all([
    c.createIndex({ tournamentId: 1, playerId: 1 }, { name: "tournament_players_unique", unique: true }),
    c.createIndex({ tournamentId: 1, gender: 1 }, { name: "tournament_players_gender" }),
  ]);
  await indexPromise;
}

function cleanGender(value: unknown): CompetitionGender {
  const gender = normalizePlayerGender(value);
  if (!gender) throw new Error("Gender is required and must be Male or Female.");
  return gender;
}

export async function getTournamentPlayers(tournamentId: string, gender?: CompetitionGender) {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  const c = await collection(); await ensureIndexes(c);
  const filter: Record<string, unknown> = { tournamentId };
  if (gender) filter.gender = cleanGender(gender);
  const entries = await c.find(filter).sort({ createdAt: 1 }).toArray();
  const players = await Promise.all(entries.map(async (entry) => {
    const player = await getPlayerById(entry.playerId);
    return player ? {
      ...player,
      gender: entry.gender,
      ...(entry.category ? { category: entry.category } : {}),
      tournament: {
        basePrice: entry.basePrice,
        status: entry.status,
        teamId: entry.teamId,
        soldPrice: entry.soldPrice,
        iconPurchase: entry.iconPurchase,
      },
    } : null;
  }));
  return players.filter(Boolean);
}

export async function importPlayersIntoTournament(tournamentId: string, inputs: PlayerInput[]) {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  if (!inputs.length) {
    return {
      processed: 0, created: 0, updated: 0, linked: 0, duplicateRows: 0,
      imagesUploaded: 0, imagesUpdated: 0, imagesSkipped: 0, imageFailures: [], rowFailures: [],
    };
  }

  const unnamedInputs = inputs.filter((input) => !playerImportName(input));
  const validInputs = inputs.filter((input) => playerImportName(input));
  const invalidNameFailures = unnamedInputs.map(() => ({
    playerName: "Unnamed player",
    reason: "Full Name is required.",
  }));
  if (validInputs.length === 0) {
    return {
      processed: 0, created: 0, updated: 0, linked: 0, duplicateRows: 0,
      imagesUploaded: 0, imagesUpdated: 0, imagesSkipped: 0, imageFailures: [], rowFailures: invalidNameFailures,
    };
  }

  const inputGenders = [...new Set(validInputs.map((input) => cleanGender(input.gender)))];
  for (const gender of inputGenders) {
    if (!tournament.competitions[gender].enabled) {
      throw new Error(`${gender === "male" ? "Men's" : "Women's"} competition is not enabled for this tournament.`);
    }
  }
  const initializedAuction = await (await getMongoDb()).collection("auctions").findOne({
    tournamentId,
    gender: { $in: inputGenders },
    playerPoolIds: { $exists: true },
  });
  if (initializedAuction) throw new Error("Tournament players and base prices are locked after auction initialization.");

  const c = await collection(); await ensureIndexes(c);
  const uniqueInputs = new Map<string, PlayerInput>();
  const basePrices = new Map<string, number>();
  let duplicateRows = 0;
  for (const input of validInputs) {
    const gender = cleanGender(input.gender);
    const key = playerImportIdentity(input.fullName || input.name, input.phoneNumber, gender);
    if (uniqueInputs.has(key)) { duplicateRows += 1; continue; }
    uniqueInputs.set(key, input);
    const categoryRules = tournament.competitions[gender].categoryRules;
    const basePrice = categoryRules?.enabled
      ? getTournamentCategoryBasePrice(input.category, categoryRules.basePrices)
      : Number(input.basePrice ?? 0);
    if (!Number.isSafeInteger(basePrice) || basePrice < 0) {
      throw new Error(`Player "${input.fullName ?? input.name ?? "unknown"}" must have a non-negative whole-number base price.`);
    }
    basePrices.set(key, basePrice);
  }

  const importResult = await bulkUpsertPlayers([...uniqueInputs.values()]);
  const importedPlayers = await getPlayers();
  let linked = 0;
  let processed = 0;
  const rowFailures = [...invalidNameFailures, ...importResult.rowFailures];
  for (const [key, input] of uniqueInputs) {
    const match = findPlayerIdentityMatch(input, importedPlayers);
    if (!match.player) {
      if (!match.ambiguous) rowFailures.push({
        playerName: input.fullName ?? input.name ?? "Unnamed player",
        reason: "Player master record could not be matched after import.",
      });
      continue;
    }
    const playerId = match.player.id;

    const now = new Date();
    const result = await c.updateOne(
      { tournamentId, playerId },
      {
        $set: {
          tournamentId,
          playerId,
          gender: cleanGender(input.gender),
          category: input.category?.trim() || match.player.category || "Uncategorized",
          basePrice: basePrices.get(key) ?? 0,
          updatedAt: now,
        },
        $setOnInsert: { status: "available", createdAt: now },
      },
      { upsert: true },
    );
    if (result.upsertedCount) linked += 1;
    processed += 1;
  }

  return {
    processed,
    created: importResult.inserted,
    updated: importResult.updated,
    linked,
    duplicateRows,
    imagesUploaded: importResult.imagesUploaded,
    imagesUpdated: importResult.imagesUpdated,
    imagesSkipped: importResult.imagesSkipped,
    imageFailures: importResult.imageFailures,
    rowFailures,
  };
}
