import { getMongoDb } from "@/lib/mongodb";
import { getAuctionRoom } from "@/lib/services/auctions";
import type { AuctionConfig } from "@/types/auction-config";

type PublicAuctionConfig = AuctionConfig & { _id?: unknown };

export async function getPublicAuctions() {
  const database = await getMongoDb();
  const auctions = await database.collection<PublicAuctionConfig>("auctions")
    .find({ status: { $ne: "draft" } })
    .sort({ updatedAt: -1 })
    .toArray();
  const tournamentIds = [...new Set(auctions.map((auction) => auction.tournamentId))];
  const tournaments = await database.collection<{ id: string; name: string; season: number }>("tournaments")
    .find({ id: { $in: tournamentIds } }, { projection: { id: 1, name: 1, season: 1 } })
    .toArray();
  const tournamentById = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  return auctions.map((auction) => ({
    id: auction.id,
    tournamentId: auction.tournamentId,
    tournamentName: tournamentById.get(auction.tournamentId)?.name ?? "Tournament",
    season: tournamentById.get(auction.tournamentId)?.season ?? null,
    gender: auction.gender,
    status: auction.status,
    currentRound: auction.currentRound ?? null,
    playerCount: auction.playerPoolIds?.length ?? 0,
    updatedAt: auction.updatedAt ?? null,
  }));
}

export async function getPublicAuction(auctionId: string) {
  const database = await getMongoDb();
  const auction = await database.collection<PublicAuctionConfig>("auctions").findOne({ id: auctionId });
  if (!auction || auction.status === "draft") return null;

  const [room, tournament] = await Promise.all([
    getAuctionRoom(auction.tournamentId, auction.gender, auction),
    database.collection<{ id: string; name: string; season: number }>("tournaments")
      .findOne({ id: auction.tournamentId }, { projection: { id: 1, name: 1, season: 1 } }),
  ]);
  if (!room.auction) return null;

  const leader = room.teams.find((team) => team.id === room.auction?.highestTeamId);
  const player = room.currentPlayer;
  return {
    auction: {
      id: room.auction.id,
      tournamentId: room.auction.tournamentId,
      tournamentName: tournament?.name ?? "Tournament",
      season: tournament?.season ?? null,
      gender: room.auction.gender,
      status: room.auction.status,
      currentRound: room.auction.currentRound ?? null,
      roundStatus: room.auction.roundStatus ?? null,
      currentBid: room.auction.currentBid ?? 0,
      bidIncrement: room.auction.bidIncrement,
      currentPlayerId: room.auction.currentPlayerId ?? null,
      highestTeamId: room.auction.highestTeamId ?? null,
      awaitingAdvance: Boolean(room.auction.awaitingAdvance),
      updatedAt: room.auction.updatedAt,
      playerCount: room.playerCount,
      roundTotal: room.roundTotal,
      roundSoldCount: room.roundSoldCount,
      roundUnsoldCount: room.roundUnsoldCount,
    },
    currentPlayer: player ? {
      id: player.id,
      name: player.name ?? player.fullName ?? "Unnamed player",
      initials: player.initials ?? (player.name ?? player.fullName ?? "P").slice(0, 2).toUpperCase(),
      role: player.role,
      category: player.category,
      age: player.age,
      batting: player.batting ?? player.battingStyle,
      bowling: player.bowling ?? player.bowlingStyle,
      basePrice: player.auctionBasePrice,
      status: player.auctionStatus,
    } : null,
    highestTeam: leader ? { id: leader.id, name: leader.name, shortName: leader.shortName } : null,
    teams: room.teams.map((team) => ({
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      remainingBudget: team.remainingBudget,
      playersCount: team.playersCount,
      squadSize: team.squadSize,
      playersNeeded: team.playersNeeded,
      maximumAffordableBid: team.maximumAffordableBid,
      status: team.status,
    })),
  };
}