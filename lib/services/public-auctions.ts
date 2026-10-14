import type { Db, Filter } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { calculateTeamAuctionBudget } from "@/lib/auction/calculations";
import { auctionResultDeliveryGraceMs } from "@/lib/auction/results";
import { getEffectiveAuctionPurchases } from "@/lib/auction/transactions";
import type { AuctionConfig, AuctionResultSnapshot } from "@/types/auction-config";
import type { MongoPlayer } from "@/lib/services/players";
import type { Team } from "@/types/team";
import type { CompetitionGender } from "@/types/tournament";

type PublicAuctionConfig = AuctionConfig;
type PublicTeam = Pick<Team, "id" | "name" | "shortName" | "status">;
type PublicTeamDocument = PublicTeam & {
  tournamentId: string;
  gender: CompetitionGender;
};
type PublicTransaction = {
  transactionId?: string;
  reversesTransactionId?: string;
  type?: "purchase" | "reversal" | "correction";
  teamId: string;
  amount: number;
};
type PublicTournamentPlayer = {
  tournamentId: string;
  playerId: string;
  gender: CompetitionGender;
  basePrice: number;
  status: "available" | "on_auction" | "sold" | "unsold";
  lastAuctionRound?: number;
};
type PublicTournament = { id: string; name: string; season: number };
type PublicPlayer = Pick<MongoPlayer,
  | "id"
  | "name"
  | "fullName"
  | "initials"
  | "photoUrl"
  | "role"
  | "category"
  | "age"
  | "batting"
  | "battingStyle"
  | "bowling"
  | "bowlingStyle"
  | "gender"
>;

type PublicMetadata = { tournament: PublicTournament | null; teams: PublicTeam[] };
type CachedPublicMetadata = { expiresAt: number; value: Promise<PublicMetadata> };
type PublicResult = Omit<AuctionResultSnapshot, "createdAt" | "displayUntil"> & {
  createdAt: string;
  displayUntil: string;
};

const publicMetadataCache = new Map<string, CachedPublicMetadata>();
const publicMetadataCacheMs = 60_000;
const maximumPublicMetadataEntries = 100;

async function getPublicMetadata(
  database: Db,
  auction: PublicAuctionConfig,
): Promise<PublicMetadata> {
  const cached = publicMetadataCache.get(auction.id);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = Promise.all([
    database.collection<PublicTeamDocument>("teams")
      .find({
        id: { $in: auction.teamIds },
        tournamentId: auction.tournamentId,
        gender: auction.gender,
        status: "active",
      }, { projection: { _id: 0, id: 1, name: 1, shortName: 1, status: 1 } })
      .sort({ name: 1 })
      .toArray(),
    database.collection<PublicTournament>("tournaments")
      .findOne({ id: auction.tournamentId }, { projection: { _id: 0, id: 1, name: 1, season: 1 } }),
  ]).then(([teams, tournament]) => ({ tournament, teams }));

  if (publicMetadataCache.size >= maximumPublicMetadataEntries) {
    const oldestKey = publicMetadataCache.keys().next().value;
    if (oldestKey) publicMetadataCache.delete(oldestKey);
  }
  const entry = { expiresAt: Date.now() + publicMetadataCacheMs, value };
  publicMetadataCache.set(auction.id, entry);

  try {
    return await value;
  } catch (error) {
    if (publicMetadataCache.get(auction.id) === entry) publicMetadataCache.delete(auction.id);
    throw error;
  }
}

function publicResult(result: AuctionResultSnapshot | undefined): PublicResult | null {
  if (!result || Date.now() - result.createdAt.getTime() > auctionResultDeliveryGraceMs) return null;
  return {
    eventId: result.eventId,
    outcome: result.outcome,
    playerId: result.playerId,
    playerName: result.playerName,
    playerInitials: result.playerInitials,
    ...(result.playerPhotoUrl ? { playerPhotoUrl: result.playerPhotoUrl } : {}),
    ...(result.teamId ? { teamId: result.teamId } : {}),
    ...(result.teamName ? { teamName: result.teamName } : {}),
    ...(result.teamShortName ? { teamShortName: result.teamShortName } : {}),
    ...(result.amount === undefined ? {} : { amount: result.amount }),
    createdAt: result.createdAt.toISOString(),
    displayUntil: result.displayUntil.toISOString(),
  };
}

export async function getPublicAuctions() {
  const database = await getMongoDb();
  const auctions = await database.collection<PublicAuctionConfig>("auctions")
    .find({ status: { $in: ["ready", "live", "paused", "completed"] } }, {
      projection: {
        _id: 0,
        id: 1,
        tournamentId: 1,
        gender: 1,
        status: 1,
        currentRound: 1,
        playerPoolIds: 1,
        updatedAt: 1,
      },
    })
    .sort({ updatedAt: -1 })
    .limit(100)
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

export async function getPublicAuction(auctionId: string, ifNoneMatch?: string) {
  const database = await getMongoDb();
  const auction = await database.collection<PublicAuctionConfig>("auctions").findOne({ id: auctionId }, {
    projection: {
      _id: 0,
      id: 1,
      tournamentId: 1,
      gender: 1,
      teamIds: 1,
      pursePerTeam: 1,
      minimumSquadSize: 1,
      maximumSquadSize: 1,
      bidIncrement: 1,
      status: 1,
      currentRound: 1,
      roundPlayerIds: 1,
      roundStatus: 1,
      playerPoolIds: 1,
      currentPlayerId: 1,
      currentBid: 1,
      highestTeamId: 1,
      awaitingAdvance: 1,
      lastActionEventId: 1,
      lastSaleEventId: 1,
      lastResult: 1,
      updatedAt: 1,
    },
  });
  if (!auction || auction.status === "draft") return null;

  const version = `${auction.updatedAt.getTime()}-${auction.lastActionEventId ?? ""}`;
  const etag = `"${version}"`;
  if (ifNoneMatch === etag) return { notModified: true as const, etag };

  const round = auction.currentRound ?? 1;
  const poolIds = auction.playerPoolIds ?? [];
  const roundPlayerIds = auction.roundPlayerIds ?? [];
  const remainingPoolFilter: Filter<PublicTournamentPlayer> = {
    tournamentId: auction.tournamentId,
    gender: auction.gender,
    playerId: {
      $in: poolIds,
      ...(auction.currentPlayerId ? { $ne: auction.currentPlayerId } : {}),
    },
    status: { $in: ["available", "unsold"] },
  };

  const [metadata, transactions, remainingPlayers, player, tournamentPlayer, roundStats] = await Promise.all([
    getPublicMetadata(database, auction),
    database.collection<PublicTransaction>("auctionTransactions")
      .find({ auctionId: auction.id }, {
        projection: { _id: 0, transactionId: 1, reversesTransactionId: 1, type: 1, teamId: 1, amount: 1 },
      })
      .toArray(),
    poolIds.length
      ? database.collection<PublicTournamentPlayer>("tournamentPlayers")
          .aggregate<{
            cheapest: Pick<PublicTournamentPlayer, "basePrice" | "status" | "lastAuctionRound">[];
            remaining: { count: number }[];
          }>([
            { $match: remainingPoolFilter },
            {
              $facet: {
                cheapest: [
                  {
                    $match: {
                      $or: [
                        { status: "available" },
                        {
                          status: "unsold",
                          $or: [
                            { lastAuctionRound: { $exists: false } },
                            { lastAuctionRound: { $lt: round } },
                          ],
                        },
                      ],
                    },
                  },
                  { $sort: { basePrice: 1 } },
                  { $limit: auction.maximumSquadSize },
                  { $project: { _id: 0, basePrice: 1, status: 1, lastAuctionRound: 1 } },
                ],
                remaining: [{ $count: "count" }],
              },
            },
          ])
          .toArray()
      : Promise.resolve([{
          cheapest: [] as Pick<PublicTournamentPlayer, "basePrice" | "status" | "lastAuctionRound">[],
          remaining: [],
        }]),
    auction.currentPlayerId
      ? database.collection<PublicPlayer>("players").findOne({ id: auction.currentPlayerId }, {
          projection: {
            _id: 0,
            id: 1,
            name: 1,
            fullName: 1,
            initials: 1,
            photoUrl: 1,
            role: 1,
            category: 1,
            age: 1,
            batting: 1,
            battingStyle: 1,
            bowling: 1,
            bowlingStyle: 1,
            gender: 1,
          },
        })
      : Promise.resolve(null),
    auction.currentPlayerId
      ? database.collection<PublicTournamentPlayer>("tournamentPlayers").findOne({
          tournamentId: auction.tournamentId,
          playerId: auction.currentPlayerId,
          gender: auction.gender,
        }, { projection: { _id: 0, basePrice: 1, status: 1 } })
      : Promise.resolve(null),
    roundPlayerIds.length && auction.currentRound
      ? database.collection<PublicTournamentPlayer>("tournamentPlayers").aggregate<{
          sold: number;
          unsold: number;
        }>([
          {
            $match: {
              tournamentId: auction.tournamentId,
              gender: auction.gender,
              playerId: { $in: roundPlayerIds },
              lastAuctionRound: auction.currentRound,
            },
          },
          {
            $group: {
              _id: null,
              sold: { $sum: { $cond: [{ $eq: ["$status", "sold"] }, 1, 0] } },
              unsold: { $sum: { $cond: [{ $eq: ["$status", "unsold"] }, 1, 0] } },
            },
          },
        ]).toArray()
      : Promise.resolve([]),
  ]);

  if (auction.currentPlayerId && (!player || !tournamentPlayer || player.gender !== auction.gender)) {
    throw new Error("The persisted current player is missing or does not match this competition.");
  }

  const purchases = getEffectiveAuctionPurchases(transactions);
  const reserveData = remainingPlayers[0];
  const remainingPlayerBasePrices = (reserveData?.cheapest ?? []).map((candidate) => candidate.basePrice);
  const teams = metadata.teams.map((team) => {
    const teamPurchases = purchases.filter((purchase) => purchase.teamId === team.id);
    const budget = calculateTeamAuctionBudget({
      startingPurse: auction.pursePerTeam,
      completedSpend: teamPurchases.reduce((total, purchase) => total + purchase.amount, 0),
      playersPurchased: teamPurchases.length,
      minimumSquadSize: auction.minimumSquadSize,
      maximumSquadSize: auction.maximumSquadSize,
      bidIncrement: auction.bidIncrement,
      currentBid: auction.currentBid ?? 0,
      basePrice: auction.highestTeamId ? 0 : auction.currentBid ?? 0,
      hasHighestBidder: Boolean(auction.highestTeamId),
      isLeadingTeam: team.id === auction.highestTeamId,
      hasCurrentPlayer: Boolean(auction.currentPlayerId),
      remainingPlayerBasePrices,
    });
    return {
      ...team,
      remainingBudget: budget.remainingBudget,
      playersCount: budget.playersPurchased,
      squadSize: auction.maximumSquadSize,
      playersNeeded: budget.playersNeeded,
      maximumAffordableBid: budget.maximumAffordableBid,
    };
  });
  const leader = teams.find((team) => team.id === auction.highestTeamId);
  const playerName = player?.name ?? player?.fullName ?? "Unnamed player";
  const stats = roundStats[0];
  return {
    notModified: false as const,
    etag,
    data: {
      auction: {
      id: auction.id,
      tournamentId: auction.tournamentId,
      tournamentName: metadata.tournament?.name ?? "Tournament",
      season: metadata.tournament?.season ?? null,
      gender: auction.gender,
      status: auction.status,
      currentRound: auction.currentRound ?? null,
      roundStatus: auction.roundStatus ?? null,
      currentBid: auction.currentBid ?? 0,
      bidIncrement: auction.bidIncrement,
      currentPlayerId: auction.currentPlayerId ?? null,
      highestTeamId: auction.highestTeamId ?? null,
      awaitingAdvance: Boolean(auction.awaitingAdvance),
      updatedAt: auction.updatedAt,
      playerCount: poolIds.length,
      remainingPlayerCount: reserveData?.remaining[0]?.count ?? 0,
      roundTotal: roundPlayerIds.length,
      roundSoldCount: stats?.sold ?? 0,
      roundUnsoldCount: stats?.unsold ?? 0,
      },
      currentPlayer: player ? {
      id: player.id,
      name: playerName,
      initials: player.initials ?? playerName.slice(0, 2).toUpperCase(),
      ...(player.photoUrl ? { photoUrl: player.photoUrl } : {}),
      role: player.role,
      category: player.category,
      age: player.age,
      batting: player.batting ?? player.battingStyle,
      bowling: player.bowling ?? player.bowlingStyle,
      basePrice: tournamentPlayer?.basePrice ?? 0,
      status: tournamentPlayer?.status ?? "available",
      } : null,
      highestTeam: leader ? { id: leader.id, name: leader.name, shortName: leader.shortName } : null,
      teams: teams.map((team) => ({
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
      result: publicResult(auction.lastResult),
    },
  };
}