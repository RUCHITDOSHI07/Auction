import { getMongoDb } from "@/lib/mongodb";
import { getAuctionRoom } from "@/lib/services/auctions";
import type { CompetitionGender } from "@/types/tournament";

type AuctionRecord = { id: string; tournamentId: string; gender: CompetitionGender; status: string; currentRound?: number; playerPoolIds?: string[] };
type TournamentPlayerRecord = {
  auctionId?: string;
  playerId: string;
  gender: CompetitionGender;
  category?: string;
  status: "available" | "on_auction" | "sold" | "unsold";
  basePrice: number;
  teamId?: string;
  soldPrice?: number;
  soldRound?: number;
  lastAuctionRound?: number;
  iconPurchase?: boolean;
};

export type AuctionResultsReport = {
  auctionId: string;
  tournamentId: string;
  tournamentName: string;
  season: number | null;
  gender: CompetitionGender;
  status: string;
  currentRound: number | null;
  totalPlayers: number;
  soldCount: number;
  unsoldCount: number;
  totalSpend: number;
  highestSale: null | { id: string; name: string; role: string | null; category: string | null; status: string; basePrice: number; teamId: string | null; teamName: string | null; teamShortName: string | null; soldPrice: number | null; round: number | null; iconPurchase: boolean };
  players: { id: string; name: string; role: string | null; category: string | null; status: string; basePrice: number; teamId: string | null; teamName: string | null; teamShortName: string | null; soldPrice: number | null; round: number | null; iconPurchase: boolean }[];
  teams: { id: string; name: string; shortName: string; startingPurse: number; remainingBudget: number; spent: number; playersCount: number; maximumSquadSize: number }[];
};

export async function getAuctionResults(tournamentId?: string, gender?: CompetitionGender) {
  const database = await getMongoDb();
  const filter: Record<string, unknown> = { status: { $ne: "draft" } };
  if (tournamentId) filter.tournamentId = tournamentId;
  if (gender) filter.gender = gender;
  const auctions = await database.collection<AuctionRecord>("auctions").find(filter).sort({ updatedAt: -1 }).toArray();
  const results = await Promise.all(auctions.map(async (auction) => {
    const [tournament, room, entries] = await Promise.all([
      database.collection<{ id: string; name: string; season: number }>("tournaments").findOne({ id: auction.tournamentId }, { projection: { id: 1, name: 1, season: 1 } }),
      getAuctionRoom(auction.tournamentId, auction.gender),
      database.collection<TournamentPlayerRecord>("tournamentPlayers").find({
        tournamentId: auction.tournamentId,
        gender: auction.gender,
        status: { $in: ["sold", "unsold"] },
        $or: [
          { playerId: { $in: auction.playerPoolIds ?? [] } },
          { auctionId: auction.id, iconPurchase: true },
        ],
      }).toArray(),
    ]);
    const playerIds = entries.map((entry) => entry.playerId);
    const teamIds = [...new Set(entries.flatMap((entry) => entry.teamId ? [entry.teamId] : []))];
    const [players, teams] = await Promise.all([
      database.collection<{ id: string; name?: string; fullName?: string; role?: string; category?: string }>("players")
        .find({ id: { $in: playerIds } }, { projection: { id: 1, name: 1, fullName: 1, role: 1, category: 1 } }).toArray(),
      database.collection<{ id: string; name: string; shortName: string }>("teams")
        .find({ id: { $in: teamIds }, tournamentId: auction.tournamentId, gender: auction.gender }, { projection: { id: 1, name: 1, shortName: 1 } }).toArray(),
    ]);
    const playerById = new Map(players.map((player) => [player.id, player]));
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const playersResult = entries.map((entry) => ({
      id: entry.playerId,
      name: playerById.get(entry.playerId)?.name ?? playerById.get(entry.playerId)?.fullName ?? "Unnamed player",
      role: playerById.get(entry.playerId)?.role ?? null,
      category: entry.category ?? playerById.get(entry.playerId)?.category ?? null,
      status: entry.status,
      basePrice: entry.basePrice,
      teamId: entry.teamId ?? null,
      teamName: entry.teamId ? teamById.get(entry.teamId)?.name ?? null : null,
      teamShortName: entry.teamId ? teamById.get(entry.teamId)?.shortName ?? null : null,
      soldPrice: entry.soldPrice ?? null,
      round: entry.iconPurchase ? null : entry.status === "sold" ? entry.soldRound ?? null : entry.lastAuctionRound ?? null,
      iconPurchase: entry.iconPurchase ?? false,
    }));
    const soldPlayers = playersResult.filter((player) => player.status === "sold");
    const teamSummary = room.teams.map((team) => ({
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      startingPurse: auction ? room.auction?.pursePerTeam ?? team.totalBudget : team.totalBudget,
      remainingBudget: team.remainingBudget,
      spent: Math.max(0, (room.auction?.pursePerTeam ?? team.totalBudget) - team.remainingBudget),
      playersCount: team.playersCount,
      maximumSquadSize: room.auction?.maximumSquadSize ?? team.squadSize,
    }));
    return {
      auctionId: auction.id,
      tournamentId: auction.tournamentId,
      tournamentName: tournament?.name ?? "Tournament",
      season: tournament?.season ?? null,
      gender: auction.gender,
      status: auction.status,
      currentRound: auction.currentRound ?? null,
      totalPlayers: (auction.playerPoolIds?.length ?? 0) + entries.filter((entry) => entry.iconPurchase).length,
      soldCount: soldPlayers.length,
      unsoldCount: playersResult.filter((player) => player.status === "unsold").length,
      totalSpend: teamSummary.reduce((sum, team) => sum + team.spent, 0),
      highestSale: soldPlayers.reduce<(typeof soldPlayers)[number] | null>((highest, player) => !highest || (player.soldPrice ?? 0) > (highest.soldPrice ?? 0) ? player : highest, null),
      players: playersResult,
      teams: teamSummary,
    };
  }));
  return results;
}