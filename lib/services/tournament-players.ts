import type { Collection } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { getTournamentById } from "@/lib/services/tournaments";
import { normalizePlayerGender } from "@/lib/players";
import { getPlayerById } from "@/lib/services/players";
import type { CompetitionGender } from "@/types/tournament";
import type { PlayerInput } from "@/types/firestore";

export interface TournamentPlayer {
  tournamentId: string;
  playerId: string;
  gender: CompetitionGender;
  basePrice: number;
  status: "available" | "on_auction" | "sold" | "unsold";
  teamId?: string;
  soldPrice?: number;
  createdAt: Date;
  updatedAt: Date;
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
    return player ? { ...player, tournament: { basePrice: entry.basePrice, status: entry.status, teamId: entry.teamId, soldPrice: entry.soldPrice } } : null;
  }));
  return players.filter(Boolean);
}

export async function importPlayersIntoTournament(tournamentId: string, inputs: PlayerInput[]) {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  if (!inputs.length) return { processed: 0, created: 0, linked: 0, duplicateRows: 0 };

  const { createPlayer, getPlayers } = await import("@/lib/services/players");
  const c = await collection(); await ensureIndexes(c);
  const seen = new Set<string>();
  let duplicateRows = 0;
  let created = 0;
  let linked = 0;

  for (const input of inputs) {
    const gender = cleanGender(input.gender);
    if (!tournament.competitions[gender].enabled) throw new Error(`${gender === "male" ? "Men's" : "Women's"} competition is not enabled for this tournament.`);
    const key = `${(input.fullName ?? input.name ?? "").trim().toLowerCase()}|${(input.phoneNumber ?? "").trim().replace(/\D/g, "")}`;
    if (seen.has(key)) { duplicateRows += 1; continue; }
    seen.add(key);

    const existingPlayers = await getPlayers();
    const existing = existingPlayers.find((p) =>
      (p.name ?? "").trim().toLowerCase() === (input.fullName ?? input.name ?? "").trim().toLowerCase() &&
      (p.phoneNumber ?? "").trim().replace(/\D/g, "") === (input.phoneNumber ?? "").trim().replace(/\D/g, "")
    );
    const playerId = existing?.id ?? await createPlayer(input);
    if (!existing) created += 1;

    const basePrice = Number(input.basePrice ?? 0);
    const now = new Date();
    const result = await c.updateOne(
      { tournamentId, playerId },
      { $set: { tournamentId, playerId, gender, basePrice: Number.isFinite(basePrice) ? basePrice : 0, updatedAt: now }, $setOnInsert: { status: "available", createdAt: now } },
      { upsert: true },
    );
    if (result.upsertedCount) linked += 1;
  }

  return { processed: inputs.length, created, linked, duplicateRows };
}
