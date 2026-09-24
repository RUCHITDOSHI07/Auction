import type { Collection } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { getTournamentById } from "@/lib/services/tournaments";
import { getTeams } from "@/lib/services/teams";
import type { CompetitionGender } from "@/types/tournament";
import type { AuctionConfig, AuctionConfigInput } from "@/types/auction-config";

type AuctionConfigDocument = AuctionConfig & { _id?: unknown };
let indexesPromise: Promise<string[]> | undefined;

async function collection(): Promise<Collection<AuctionConfigDocument>> {
  const db = await getMongoDb();
  return db.collection<AuctionConfigDocument>("auctions");
}
async function ensureIndexes(c: Collection<AuctionConfigDocument>) {
  indexesPromise ??= Promise.all([
    c.createIndex({ tournamentId: 1, gender: 1 }, { name: "auction_tournament_gender_unique", unique: true }),
  ]);
  await indexesPromise;
}
function cleanGender(value: unknown): CompetitionGender {
  const gender = String(value ?? "").toLowerCase();
  if (gender !== "male" && gender !== "female") throw new Error("Competition must be male or female.");
  return gender;
}
function cleanNumber(value: unknown, label: string, integer = false) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || (integer && !Number.isInteger(n))) throw new Error(`${label} must be a positive ${integer ? "whole number" : "number"}.`);
  return n;
}
async function validate(input: AuctionConfigInput) {
  const tournament = await getTournamentById(input.tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  const gender = cleanGender(input.gender);
  if (!tournament.competitions[gender].enabled) throw new Error("This competition is not enabled for the tournament.");
  const teams = await getTeams(input.tournamentId, gender);
  const teamIds = [...new Set(input.teamIds ?? [])];
  const validTeamIds = new Set(teams.map(team => team.id));
  if (!teamIds.length) throw new Error("Add at least one team before configuring the auction.");
  if (teamIds.some(id => !validTeamIds.has(id))) throw new Error("Auction teams must belong to this tournament and competition.");
  const pursePerTeam = cleanNumber(input.pursePerTeam, "Purse per team");
  const minimumSquadSize = cleanNumber(input.minimumSquadSize, "Minimum squad size", true);
  const maximumSquadSize = cleanNumber(input.maximumSquadSize, "Maximum squad size", true);
  const bidIncrement = cleanNumber(input.bidIncrement, "Bid increment");
  if (minimumSquadSize > maximumSquadSize) throw new Error("Minimum squad size cannot exceed maximum squad size.");
  return { tournamentId: input.tournamentId, gender, teamIds, pursePerTeam, minimumSquadSize, maximumSquadSize, bidIncrement };
}
export async function getAuctionConfig(tournamentId: string, gender: CompetitionGender) {
  const c = await collection(); await ensureIndexes(c);
  const doc = await c.findOne({ tournamentId, gender });
  if (!doc) return null;
  const { _id: _ignoredId, ...config } = doc;
  return config;
}
export async function saveAuctionConfig(input: AuctionConfigInput) {
  const normalized = await validate(input);
  const c = await collection(); await ensureIndexes(c);
  const now = new Date();
  const id = `${normalized.tournamentId}-${normalized.gender}-auction`;
  const existing = await getAuctionConfig(normalized.tournamentId, normalized.gender);
  const config: AuctionConfig = { id, ...normalized, status: "draft", createdAt: existing?.createdAt ?? now, updatedAt: now };
  await c.updateOne({ tournamentId: normalized.tournamentId, gender: normalized.gender }, { $set: config }, { upsert: true });
  return config;
}
