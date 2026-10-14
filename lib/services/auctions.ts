import type { ClientSession, Collection, Filter } from "mongodb";
import { randomUUID } from "node:crypto";
import { getMongoDb } from "@/lib/mongodb";
import type { AdminUser } from "@/lib/auth/session";
import type { AuctionConfig } from "@/types/auction-config";
import type { CompetitionGender } from "@/types/tournament";
import type { Team } from "@/types/team";
import type { MongoPlayer } from "@/lib/services/players";
import { calculateTeamAuctionBudget } from "@/lib/auction/calculations";
import { auctionResultDisplayMs } from "@/lib/auction/results";
import { getEffectiveAuctionPurchases } from "@/lib/auction/transactions";

type AuctionDocument = AuctionConfig & { _id?: unknown };
type TournamentPlayerDocument = {
  tournamentId: string;
  playerId: string;
  gender: CompetitionGender;
  basePrice: number;
  status: "available" | "on_auction" | "sold" | "unsold";
  teamId?: string;
  soldPrice?: number;
  soldRound?: number;
  auctionId?: string;
  lastAuctionRound?: number;
  createdAt: Date;
  updatedAt: Date;
};
type TeamDocument = Team & { _id?: unknown };
type PlayerDocument = MongoPlayer & { _id?: unknown };
type AuctionTransactionDocument = {
  transactionId?: string;
  eventId?: string;
  reversesTransactionId?: string;
  auctionId: string;
  tournamentId: string;
  gender: CompetitionGender;
  playerId: string;
  teamId: string;
  amount: number;
  round: number;
  type?: "purchase" | "reversal" | "correction";
  createdAt: Date;
};
type AuctionHistoryEvent = {
  eventId: string;
  requestId?: string;
  auctionId: string;
  tournamentId: string;
  gender: CompetitionGender;
  action: string;
  round: number;
  admin: { userId: string; name?: string };
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reversesEventId?: string;
  correctsEventId?: string;
  reason?: string;
  playerId?: string;
  teamId?: string;
  amount?: number;
  createdAt: Date;
};

export type AuctionTeamView = Team & {
  playersNeeded: number;
  minimumReserve: number | null;
  maximumAffordableBid: number;
  minimumNextBid: number;
  canPlaceNextBid: boolean;
};

let purchaseIndexPromise: Promise<string> | undefined;
let historyIndexesPromise: Promise<string[]> | undefined;

export interface AuctionRoom {
  auction: AuctionConfig | null;
  currentPlayer: (MongoPlayer & { auctionBasePrice: number; auctionStatus: TournamentPlayerDocument["status"] }) | null;
  teams: AuctionTeamView[];
  playerCount: number;
  roundTotal: number;
  roundSoldCount: number;
  roundUnsoldCount: number;
}

function cleanGender(value: unknown): CompetitionGender {
  if (value !== "male" && value !== "female") {
    throw new Error("Competition must be male or female.");
  }
  return value;
}

function withoutId<T extends { _id?: unknown }>(document: T): Omit<T, "_id"> {
  const result = { ...document };
  delete result._id;
  return result;
}

async function getCollections() {
  const database = await getMongoDb();
  const collections = {
    database,
    auctions: database.collection<AuctionDocument>("auctions"),
    tournamentPlayers: database.collection<TournamentPlayerDocument>("tournamentPlayers"),
    teams: database.collection<TeamDocument>("teams"),
    players: database.collection<PlayerDocument>("players"),
    transactions: database.collection<AuctionTransactionDocument>("auctionTransactions"),
    history: database.collection<AuctionHistoryEvent>("auctionHistory"),
  };
  return collections;
}

async function ensurePurchaseIndex(collection: Collection<AuctionTransactionDocument>) {
  purchaseIndexPromise ??= (async () => {
    await collection.createIndex({ auctionId: 1 });
    await collection.createIndex(
      { auctionId: 1, playerId: 1 },
      {
        name: "auction_purchase_player_unique_v2",
        unique: true,
        partialFilterExpression: { type: "purchase" },
      },
    );
    try {
      await collection.dropIndex("auction_purchase_player_unique");
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== 27) throw error;
    }
    return "auction_purchase_player_unique_v2";
  })();
  await purchaseIndexPromise;
}

async function ensureHistoryIndexes(collection: Collection<AuctionHistoryEvent>) {
  historyIndexesPromise ??= Promise.all([
    collection.createIndex({ eventId: 1 }, {
      name: "auction_history_event_unique",
      unique: true,
      partialFilterExpression: { eventId: { $type: "string" } },
    }),
    collection.createIndex({ requestId: 1 }, {
      name: "auction_history_request_unique",
      unique: true,
      partialFilterExpression: { requestId: { $type: "string" } },
    }),
    collection.createIndex({ auctionId: 1, createdAt: -1 }, { name: "auction_history_chronological" }),
  ]);
  await historyIndexesPromise;
}

async function getTeamViews(
  collections: Awaited<ReturnType<typeof getCollections>>,
  auction: AuctionConfig,
  session?: ClientSession,
  excludeTransactionId?: string,
): Promise<AuctionTeamView[]> {
  const poolIds = auction.playerPoolIds ?? [];
  const teams = await collections.teams
    .find({ id: { $in: auction.teamIds }, tournamentId: auction.tournamentId, gender: auction.gender, status: "active" }, { session })
    .sort({ name: 1 })
    .toArray();
  const transactions = await collections.transactions
    .find({ auctionId: auction.id }, {
      session,
      projection: { transactionId: 1, reversesTransactionId: 1, type: 1, teamId: 1, amount: 1 },
    })
    .toArray();
  const purchases = getEffectiveAuctionPurchases(transactions, excludeTransactionId);
  const remainingPlayers = poolIds.length
    ? await collections.tournamentPlayers
        .find({
          tournamentId: auction.tournamentId,
          gender: auction.gender,
          playerId: { $in: poolIds, ...(auction.currentPlayerId ? { $ne: auction.currentPlayerId } : {}) },
          status: { $in: ["available", "unsold"] },
        }, { session })
        .toArray()
    : [];

  const basePrices = remainingPlayers
    .filter((player) => player.status === "available" || (player.lastAuctionRound ?? 0) < (auction.currentRound ?? 1))
    .map((player) => player.basePrice);
  return teams.map((team) => {
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
      remainingPlayerBasePrices: basePrices,
    });
    return {
      ...withoutId(team),
      totalBudget: auction.pursePerTeam,
      remainingBudget: budget.remainingBudget,
      playersCount: budget.playersPurchased,
      squadSize: auction.maximumSquadSize,
      playersNeeded: budget.playersNeeded,
      minimumReserve: Number.isFinite(budget.minimumReserve) ? budget.minimumReserve : null,
      maximumAffordableBid: budget.maximumAffordableBid,
      minimumNextBid: budget.minimumNextBid,
      canPlaceNextBid: budget.canPlaceNextBid,
    };
  });
}

async function appendHistory(
  collections: Awaited<ReturnType<typeof getCollections>>,
  auction: AuctionConfig,
  action: string,
  session: ClientSession,
  admin: AdminUser,
  details: Record<string, unknown> = {},
) {
  const createdAt = new Date();
  const event: AuctionHistoryEvent = {
    eventId: randomUUID(),
    auctionId: auction.id,
    tournamentId: auction.tournamentId,
    gender: auction.gender,
    action,
    round: auction.currentRound ?? 1,
    admin: { userId: admin.userId, ...(admin.name ? { name: admin.name } : {}) },
    ...details,
    createdAt,
  };
  await collections.history.insertOne(event, { session });
  await collections.auctions.updateOne(
    { id: auction.id },
    { $set: { lastActionEventId: event.eventId, updatedAt: createdAt } },
    { session },
  );
  return event;
}

export async function getAuctionRoom(
  tournamentId: string,
  genderValue: unknown,
  knownAuction?: AuctionDocument,
): Promise<AuctionRoom> {
  const gender = cleanGender(genderValue);
  const collections = await getCollections();
  const document = knownAuction && knownAuction.tournamentId === tournamentId && knownAuction.gender === gender
    ? knownAuction
    : await collections.auctions.findOne({ tournamentId, gender });
  if (!document) return { auction: null, currentPlayer: null, teams: [], playerCount: 0, roundTotal: 0, roundSoldCount: 0, roundUnsoldCount: 0 };

  const auction = withoutId(document) as AuctionConfig;
  const [teams, currentPlayerData] = await Promise.all([
    getTeamViews(collections, auction),
    auction.currentPlayerId
      ? Promise.all([
          collections.players.findOne({ id: auction.currentPlayerId }),
          collections.tournamentPlayers.findOne({ tournamentId, playerId: auction.currentPlayerId, gender }),
        ])
      : Promise.resolve([null, null] as const),
  ]);
  const [player, tournamentPlayer] = currentPlayerData;
  if (auction.currentPlayerId && (!player || !tournamentPlayer || player.gender !== gender)) {
    throw new Error("The persisted current player is missing or does not match this competition.");
  }
  const currentPlayer = player && tournamentPlayer
    ? {
        ...(withoutId(player) as MongoPlayer),
        auctionBasePrice: tournamentPlayer.basePrice,
        auctionStatus: tournamentPlayer.status,
      }
    : null;
  const roundEntries = auction.currentRound && auction.roundPlayerIds?.length
    ? await collections.tournamentPlayers.find({
        tournamentId,
        gender,
        playerId: { $in: auction.roundPlayerIds },
        lastAuctionRound: auction.currentRound,
      }).toArray()
    : [];

  return {
    auction,
    currentPlayer,
    teams,
    playerCount: auction.playerPoolIds?.length ?? 0,
    roundTotal: auction.roundPlayerIds?.length ?? 0,
    roundSoldCount: roundEntries.filter((entry) => entry.status === "sold").length,
    roundUnsoldCount: roundEntries.filter((entry) => entry.status === "unsold").length,
  };
}

export async function initializeAuction(
  tournamentId: string,
  genderValue: unknown,
  admin: AdminUser,
): Promise<AuctionRoom> {
  const gender = cleanGender(genderValue);
  const collections = await getCollections();
  await ensureHistoryIndexes(collections.history);
  const auction = await collections.auctions.findOne({ tournamentId, gender });
  if (!auction) throw new Error("Configure this tournament competition before initializing its auction.");
  if (Array.isArray(auction.playerPoolIds)) return getAuctionRoom(tournamentId, gender);
  if (auction.status !== "draft") throw new Error("Only a draft auction can be initialized.");

  const tournament = await collections.database
    .collection("tournaments")
    .findOne({ id: tournamentId });
  if (!tournament) throw new Error("Tournament not found.");
  const competitions = tournament.competitions as Record<CompetitionGender, { enabled?: boolean }> | undefined;
  if (!competitions?.[gender]?.enabled) throw new Error("This competition is not enabled for the tournament.");

  const teamIds = [...new Set(auction.teamIds)];
  const teams = await collections.teams
    .find({ id: { $in: teamIds }, tournamentId, gender, status: "active" })
    .toArray();
  if (teamIds.length === 0 || teams.length !== teamIds.length) {
    throw new Error("Every configured team must be active and belong to this tournament competition.");
  }

  const pool = await collections.tournamentPlayers
    .find({ tournamentId, gender, status: "available" })
    .sort({ createdAt: 1, playerId: 1 })
    .toArray();
  if (pool.length === 0) throw new Error("No eligible available players exist in this competition's tournament pool.");
  if (pool.some((player) => !Number.isFinite(player.basePrice) || player.basePrice < 0)) {
    throw new Error("Every eligible player must have a valid non-negative base price.");
  }
  if (pool.length < teams.length * auction.minimumSquadSize) {
    throw new Error("The eligible player pool is too small to satisfy every team's minimum squad size.");
  }

  const masterPlayers = await collections.players
    .find({ id: { $in: pool.map((player) => player.playerId) } }, { projection: { id: 1, gender: 1 } })
    .toArray();
  const gendersByPlayerId = new Map(masterPlayers.map((player) => [player.id, player.gender]));
  if (pool.some((player) => gendersByPlayerId.get(player.playerId) !== gender)) {
    throw new Error("Every eligible tournament player must exist and match this competition's gender.");
  }

  const now = new Date();
  const playerPoolIds = pool.map((player) => player.playerId);
  const updatedAuction: AuctionConfig = {
    ...withoutId(auction),
    status: "ready",
    currentRound: 1,
    roundPlayerIds: playerPoolIds,
    roundStatus: "not_started",
    playerPoolIds,
    currentPlayerId: playerPoolIds[0],
    currentBid: pool[0].basePrice,
    initializedAt: now,
    updatedAt: now,
  };

  const session = collections.database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const result = await collections.auctions.updateOne(
        { id: auction.id, tournamentId, gender, status: "draft", playerPoolIds: { $exists: false }, updatedAt: auction.updatedAt },
        {
          $set: {
            status: updatedAuction.status,
            currentRound: updatedAuction.currentRound,
            roundPlayerIds: updatedAuction.roundPlayerIds,
            roundStatus: updatedAuction.roundStatus,
            playerPoolIds: updatedAuction.playerPoolIds,
            currentPlayerId: updatedAuction.currentPlayerId,
            currentBid: updatedAuction.currentBid,
            initializedAt: now,
            updatedAt: now,
          },
        },
        { session },
      );
      if (result.modifiedCount !== 1) throw new Error("Auction initialization changed concurrently; reload and try again.");
      await appendHistory(collections, updatedAuction, "AUCTION_INITIALIZED", session, admin, {
        before: { status: "draft" },
        after: { status: "ready", playerCount: playerPoolIds.length, currentPlayerId: playerPoolIds[0] },
      });
    });
  } catch (error) {
    const current = await collections.auctions.findOne({ id: auction.id });
    if (!current?.playerPoolIds) throw error;
  } finally {
    await session.endSession();
  }

  return getAuctionRoom(tournamentId, gender);
}

export type AuctionLifecycleAction = "start" | "pause" | "resume" | "complete";

export async function markCurrentAuctionPlayerUnsold(auctionId: string, admin: AdminUser) {
  const collections = await getCollections();
  await ensureHistoryIndexes(collections.history);
  const session = collections.database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const auction = await collections.auctions.findOne({ id: auctionId }, { session });
      if (!auction || auction.status !== "live") throw new Error("A player can only be marked unsold while the auction is live.");
      const playerId = auction.currentPlayerId;
      if (!playerId || !auction.playerPoolIds?.includes(playerId)) throw new Error("There is no eligible current player.");
      const entry = await collections.tournamentPlayers.findOne({ tournamentId: auction.tournamentId, gender: auction.gender, playerId, status: "on_auction" }, { session });
      const player = await collections.players.findOne({ id: playerId }, { session });
      if (!entry || !player || player.gender !== auction.gender) throw new Error("Current player is not eligible for this auction.");

      const round = auction.currentRound ?? 1;
      const updated = await collections.tournamentPlayers.updateOne(
        { tournamentId: auction.tournamentId, gender: auction.gender, playerId, status: "on_auction" },
        { $set: { status: "unsold", lastAuctionRound: round, auctionId, updatedAt: new Date() } },
        { session },
      );
      if (updated.modifiedCount !== 1) throw new Error("Player state changed before UNSOLD could be saved.");
      const event = await appendHistory(collections, auction, "PLAYER_UNSOLD", session, admin, {
        playerId,
        before: { status: "on_auction" },
        after: { status: "unsold", round },
      });
      const resultDisplayUntil = new Date(event.createdAt.getTime() + auctionResultDisplayMs);
      const result = await collections.auctions.updateOne(
        { id: auctionId, status: "live", currentPlayerId: playerId, lastActionEventId: event.eventId },
        {
          $set: {
            awaitingAdvance: true,
            lastResult: {
              eventId: event.eventId,
              outcome: "unsold",
              playerId,
              playerName: player.name ?? player.fullName ?? "Unnamed player",
              playerInitials: player.initials ?? (player.name ?? player.fullName ?? "P").slice(0, 2).toUpperCase(),
              ...(player.photoUrl ? { playerPhotoUrl: player.photoUrl } : {}),
              createdAt: event.createdAt,
              displayUntil: resultDisplayUntil,
            },
            updatedAt: event.createdAt,
          },
        },
        { session },
      );
      if (result.modifiedCount !== 1) throw new Error("Auction changed before UNSOLD could be finalized.");
    });
  } finally {
    await session.endSession();
  }

  const auction = await collections.auctions.findOne({ id: auctionId });
  if (!auction) throw new Error("Auction not found after UNSOLD.");
  return getAuctionRoom(auction.tournamentId, auction.gender);
}

export async function startNextAuctionRound(auctionId: string, admin: AdminUser) {
  const collections = await getCollections();
  await ensureHistoryIndexes(collections.history);
  const session = collections.database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const auction = await collections.auctions.findOne({ id: auctionId }, { session });
      if (!auction || auction.status !== "live" || auction.roundStatus !== "complete") {
        throw new Error("The current round must be complete before starting another round.");
      }
      const nextRound = (auction.currentRound ?? 1) + 1;
      const poolIds = auction.playerPoolIds ?? [];
      const unsoldPlayers = await collections.tournamentPlayers.find({
        tournamentId: auction.tournamentId,
        gender: auction.gender,
        playerId: { $in: poolIds },
        status: "unsold",
        $or: [
          { lastAuctionRound: { $exists: false } },
          { lastAuctionRound: { $lt: nextRound } },
        ],
      }, { session }).toArray();
      unsoldPlayers.sort((left, right) => poolIds.indexOf(left.playerId) - poolIds.indexOf(right.playerId));
      const firstPlayer = unsoldPlayers[0];
      if (!firstPlayer) throw new Error("There are no unsold eligible players for another round.");

      const player = await collections.players.findOne({ id: firstPlayer.playerId }, { session });
      if (!player || player.gender !== auction.gender) throw new Error("The next-round player is missing or does not match this competition.");
      if (!Number.isFinite(firstPlayer.basePrice) || firstPlayer.basePrice < 0) throw new Error("The next-round player has an invalid base price.");
      const playerUpdate = await collections.tournamentPlayers.updateOne(
        {
          tournamentId: auction.tournamentId,
          gender: auction.gender,
          playerId: firstPlayer.playerId,
          status: "unsold",
          $or: [
            { lastAuctionRound: { $exists: false } },
            { lastAuctionRound: { $lt: nextRound } },
          ],
        },
        { $set: { status: "on_auction", auctionId, updatedAt: new Date() } },
        { session },
      );
      if (playerUpdate.modifiedCount !== 1) throw new Error("The first unsold player changed; reload and try again.");

      const roundPlayerIds = unsoldPlayers.map((candidate) => candidate.playerId);
      const result = await collections.auctions.updateOne(
        { id: auctionId, status: "live", roundStatus: "complete", currentRound: auction.currentRound },
        {
          $set: {
            currentRound: nextRound,
            roundPlayerIds,
            roundStatus: "in_progress",
            currentPlayerId: firstPlayer.playerId,
            currentBid: firstPlayer.basePrice,
            updatedAt: new Date(),
          },
          $unset: { highestTeamId: "" },
        },
        { session },
      );
      if (result.modifiedCount !== 1) throw new Error("Auction changed while starting the next round.");
      await appendHistory(collections, auction, "ROUND_STARTED", session, admin, {
        before: { round: auction.currentRound, roundStatus: "complete" },
        after: { round: nextRound, roundStatus: "in_progress", playerCount: roundPlayerIds.length, currentPlayerId: firstPlayer.playerId },
      });
    });
  } finally {
    await session.endSession();
  }

  const auction = await collections.auctions.findOne({ id: auctionId });
  if (!auction) throw new Error("Auction not found after starting the next round.");
  return getAuctionRoom(auction.tournamentId, auction.gender);
}

export async function sellCurrentAuctionPlayer(auctionId: string, admin: AdminUser) {
  const collections = await getCollections();
  await ensurePurchaseIndex(collections.transactions);
  await ensureHistoryIndexes(collections.history);
  const session = collections.database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const auction = await collections.auctions.findOne({ id: auctionId }, { session });
      if (!auction || auction.status !== "live") throw new Error("A player can only be sold while the auction is live.");
      const playerId = auction.currentPlayerId;
      const teamId = auction.highestTeamId;
      const amount = auction.currentBid;
      if (!playerId || !teamId || typeof amount !== "number") throw new Error("A current player, confirmed bid, and highest team are required before SOLD.");
      if (!auction.playerPoolIds?.includes(playerId) || !auction.teamIds.includes(teamId)) throw new Error("Current player or team is outside this auction.");

      const entry = await collections.tournamentPlayers.findOne({ tournamentId: auction.tournamentId, gender: auction.gender, playerId, status: "on_auction" }, { session });
      const player = await collections.players.findOne({ id: playerId }, { session });
      const storedTeam = await collections.teams.findOne({ id: teamId, tournamentId: auction.tournamentId, gender: auction.gender, status: "active" }, { session });
      if (!entry || !player || player.gender !== auction.gender) throw new Error("Current player is not eligible for this auction.");
      if (!storedTeam) throw new Error("Highest-bid team is not active in this tournament competition.");
      if (!Number.isFinite(entry.basePrice) || entry.basePrice < 0) throw new Error("Current player has an invalid base price.");
      if (!Number.isFinite(amount) || amount < entry.basePrice) throw new Error("Confirmed sale price is below the player's base price.");
      if (await collections.transactions.findOne({ auctionId, playerId, type: "purchase" }, { session })) {
        throw new Error("This player already has a purchase record for this auction.");
      }

      const teamView = (await getTeamViews(collections, auction, session)).find((team) => team.id === teamId);
      if (!teamView) throw new Error("Highest-bid team is not eligible for this auction.");
      if (teamView.playersCount >= auction.maximumSquadSize) throw new Error("Highest-bid team has reached the maximum squad size.");
      if (amount > teamView.remainingBudget) throw new Error("Confirmed sale price exceeds the team's available budget.");
      if (amount > teamView.maximumAffordableBid) throw new Error("Confirmed sale price would prevent the team from filling its minimum squad.");

      const now = new Date();
      const teamUpdate = await collections.teams.updateOne(
        {
          id: teamId,
          tournamentId: auction.tournamentId,
          gender: auction.gender,
          status: "active",
          playersCount: storedTeam.playersCount,
          remainingBudget: storedTeam.remainingBudget,
        },
        {
          $set: {
            playersCount: teamView.playersCount + 1,
            remainingBudget: teamView.remainingBudget - amount,
            updatedAt: now,
          },
        },
        { session },
      );
      if (teamUpdate.modifiedCount !== 1) throw new Error("Team state changed during this sale; reload and try again.");

      const playerUpdate = await collections.tournamentPlayers.updateOne(
        { tournamentId: auction.tournamentId, gender: auction.gender, playerId, status: "on_auction" },
        {
          $set: {
            status: "sold",
            teamId,
            soldPrice: amount,
            soldRound: auction.currentRound ?? 1,
            lastAuctionRound: auction.currentRound ?? 1,
            auctionId,
            updatedAt: now,
          },
        },
        { session },
      );
      if (playerUpdate.modifiedCount !== 1) throw new Error("Player state changed during this sale; reload and try again.");

      const transactionId = randomUUID();
      const saleEvent = await appendHistory(collections, auction, "PLAYER_SOLD", session, admin, {
        playerId,
        teamId,
        amount,
        before: { status: "on_auction", currentBid: auction.currentBid, highestTeamId: teamId },
        after: { status: "sold", teamId, soldPrice: amount, soldRound: auction.currentRound ?? 1 },
      });
      await collections.transactions.insertOne({
        transactionId,
        eventId: saleEvent.eventId,
        auctionId,
        tournamentId: auction.tournamentId,
        gender: auction.gender,
        playerId,
        teamId,
        amount,
        round: auction.currentRound ?? 1,
        type: "purchase",
        createdAt: now,
      }, { session });
      const auctionUpdate = await collections.auctions.updateOne(
        { id: auctionId, status: "live", currentPlayerId: playerId, lastActionEventId: saleEvent.eventId },
        {
          $set: {
            awaitingAdvance: true,
            lastSaleEventId: saleEvent.eventId,
            lastResult: {
              eventId: saleEvent.eventId,
              outcome: "sold",
              playerId,
              playerName: player.name ?? player.fullName ?? "Unnamed player",
              playerInitials: player.initials ?? (player.name ?? player.fullName ?? "P").slice(0, 2).toUpperCase(),
              ...(player.photoUrl ? { playerPhotoUrl: player.photoUrl } : {}),
              teamId: storedTeam.id,
              teamName: storedTeam.name,
              teamShortName: storedTeam.shortName,
              amount,
              createdAt: saleEvent.createdAt,
              displayUntil: new Date(saleEvent.createdAt.getTime() + auctionResultDisplayMs),
            },
            updatedAt: saleEvent.createdAt,
          },
        },
        { session },
      );
      if (auctionUpdate.modifiedCount !== 1) throw new Error("Auction changed before the sale could be finalized.");
    });
  } finally {
    await session.endSession();
  }

  const auction = await collections.auctions.findOne({ id: auctionId });
  if (!auction) throw new Error("Auction not found after sale.");
  return getAuctionRoom(auction.tournamentId, auction.gender);
}

export async function undoLatestAuctionSale(
  auctionId: string,
  saleEventIdValue: unknown,
  admin: AdminUser,
  requestId?: string,
) {
  if (typeof saleEventIdValue !== "string" || !saleEventIdValue) throw new Error("Sale event ID is required to undo a sale.");
  const saleEventId = saleEventIdValue;
  const collections = await getCollections();
  await ensurePurchaseIndex(collections.transactions);
  await ensureHistoryIndexes(collections.history);
  if (requestId && await collections.history.findOne({ requestId })) {
    const persisted = await collections.auctions.findOne({ id: auctionId });
    if (!persisted) throw new Error("Auction not found after duplicate undo request.");
    return getAuctionRoom(persisted.tournamentId, persisted.gender);
  }

  const session = collections.database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const auction = await collections.auctions.findOne({ id: auctionId }, { session });
      if (!auction || auction.status !== "live" || !auction.awaitingAdvance || auction.lastSaleEventId !== saleEventId || auction.lastActionEventId !== saleEventId) {
        throw new Error("Undo is only available for the current sale before any later auction action. Continue with a controlled correction instead.");
      }
      const saleEvent = await collections.history.findOne({ eventId: saleEventId, auctionId }, { session });
      if (!saleEvent || (saleEvent.action !== "PLAYER_SOLD" && saleEvent.action !== "SALE_CORRECTED") || !saleEvent.playerId) {
        throw new Error("The sale event is unavailable or is a legacy record without correction metadata.");
      }
      const playerId = saleEvent.playerId;
      const transaction = await collections.transactions.findOne({ auctionId, eventId: saleEventId, type: { $in: ["purchase", "correction"] } }, { session });
      if (!transaction?.transactionId) throw new Error("This sale has no reversible transaction record.");
      const alreadyReversed = await collections.transactions.findOne({ reversesTransactionId: transaction.transactionId, type: "reversal" }, { session });
      if (alreadyReversed) throw new Error("This sale has already been reversed.");

      const entry = await collections.tournamentPlayers.findOne({
        tournamentId: auction.tournamentId,
        gender: auction.gender,
        playerId,
        status: "sold",
        auctionId,
        teamId: transaction.teamId,
      }, { session });
      if (!entry) throw new Error("The sold player record no longer matches this sale; automatic undo is unsafe.");
      const team = await collections.teams.findOne({ id: transaction.teamId, tournamentId: auction.tournamentId, gender: auction.gender }, { session });
      if (!team) throw new Error("The sale's team record is unavailable; automatic undo is unsafe.");

      const baselineTeam = (await getTeamViews(collections, auction, session, transaction.transactionId))
        .find((candidate) => candidate.id === team.id);
      if (!baselineTeam) throw new Error("The sale's team is no longer eligible; automatic undo is unsafe.");

      const teamUpdate = await collections.teams.updateOne(
        { id: team.id, tournamentId: auction.tournamentId, gender: auction.gender, playersCount: team.playersCount, remainingBudget: team.remainingBudget },
        { $set: { playersCount: baselineTeam.playersCount, remainingBudget: baselineTeam.remainingBudget, updatedAt: new Date() } },
        { session },
      );
      if (teamUpdate.modifiedCount !== 1) throw new Error("Team state changed during undo; reload and retry.");

      const playerUpdate = await collections.tournamentPlayers.updateOne(
        { tournamentId: auction.tournamentId, gender: auction.gender, playerId, status: "sold", auctionId, teamId: team.id },
        {
          $set: { status: "on_auction", updatedAt: new Date() },
          $unset: { teamId: "", soldPrice: "", soldRound: "" },
        },
        { session },
      );
      if (playerUpdate.modifiedCount !== 1) throw new Error("Player state changed during undo; reload and retry.");

      const reversalEvent = await appendHistory(collections, auction, "SALE_REVERSED", session, admin, {
        ...(requestId ? { requestId } : {}),
        playerId,
        teamId: team.id,
        amount: transaction.amount,
        reversesEventId: saleEventId,
        before: { status: "sold", teamId: team.id, soldPrice: transaction.amount },
        after: { status: "on_auction", teamId: null, soldPrice: null },
      });
      await collections.transactions.insertOne({
        transactionId: randomUUID(),
        eventId: reversalEvent.eventId,
        reversesTransactionId: transaction.transactionId,
        auctionId,
        tournamentId: auction.tournamentId,
        gender: auction.gender,
        playerId,
        teamId: team.id,
        amount: transaction.amount,
        round: auction.currentRound ?? 1,
        type: "reversal",
        createdAt: reversalEvent.createdAt,
      }, { session });

      const auctionUpdate = await collections.auctions.updateOne(
        { id: auctionId, status: "live", currentPlayerId: playerId, awaitingAdvance: true, lastActionEventId: reversalEvent.eventId },
        {
          $set: { currentBid: entry.basePrice, awaitingAdvance: false, updatedAt: reversalEvent.createdAt },
          $unset: { highestTeamId: "", lastSaleEventId: "", lastResult: "" },
        },
        { session },
      );
      if (auctionUpdate.modifiedCount !== 1) throw new Error("Auction changed during undo; reload and retry.");
    });
  } finally {
    await session.endSession();
  }

  const auction = await collections.auctions.findOne({ id: auctionId });
  if (!auction) throw new Error("Auction not found after undo.");
  return getAuctionRoom(auction.tournamentId, auction.gender);
}

export async function previewLatestSaleCorrection(auctionId: string, saleEventId: string) {
  const collections = await getCollections();
  const auction = await collections.auctions.findOne({ id: auctionId });
  if (!auction || auction.status !== "live" || !auction.awaitingAdvance || auction.lastSaleEventId !== saleEventId || auction.lastActionEventId !== saleEventId) {
    throw new Error("Only the current sale can be previewed for automatic correction. Later activity requires controlled recovery.");
  }
  const event = await collections.history.findOne({ eventId: saleEventId, auctionId });
  if (!event || (event.action !== "PLAYER_SOLD" && event.action !== "SALE_CORRECTED") || !event.playerId) {
    throw new Error("This sale does not contain enough metadata for a safe correction preview.");
  }
  const transaction = await collections.transactions.findOne({ auctionId, eventId: saleEventId, type: { $in: ["purchase", "correction"] } });
  if (!transaction?.transactionId) throw new Error("This sale has no correction-linked transaction.");
  const entry = await collections.tournamentPlayers.findOne({
    tournamentId: auction.tournamentId,
    gender: auction.gender,
    playerId: event.playerId,
    status: "sold",
    auctionId,
    teamId: transaction.teamId,
  });
  const player = await collections.players.findOne({ id: event.playerId }, { projection: { id: 1, name: 1, fullName: 1, role: 1, category: 1, age: 1 } });
  if (!entry || !player) throw new Error("Current sale player is missing or changed; correction is unsafe.");
  const teams = await getTeamViews(collections, auction, undefined, transaction.transactionId);
  return {
    eventId: event.eventId,
    player: { id: player.id, name: player.name ?? player.fullName ?? "Unnamed player", role: player.role, category: player.category },
    currentTeamId: transaction.teamId,
    currentAmount: transaction.amount,
    basePrice: entry.basePrice,
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      remainingBudget: team.remainingBudget,
      playersCount: team.playersCount,
      maximumAffordableBid: team.maximumAffordableBid,
      eligible: team.playersCount < auction.maximumSquadSize,
    })),
  };
}

export async function correctLatestAuctionSale(
  auctionId: string,
  input: { saleEventId?: unknown; teamId?: unknown; amount?: unknown; reason?: unknown; requestId?: unknown },
  admin: AdminUser,
) {
  if (typeof input.saleEventId !== "string" || !input.saleEventId) throw new Error("Sale event ID is required.");
  if (typeof input.teamId !== "string" || !input.teamId) throw new Error("Select the corrected team.");
  if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount < 0) throw new Error("Corrected sale price must be a non-negative number.");
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 5 || reason.length > 500) throw new Error("Enter a correction reason between 5 and 500 characters.");
  const saleEventId = input.saleEventId;
  const correctedTeamId = input.teamId;
  const correctedAmount = input.amount;
  const requestId = typeof input.requestId === "string" && /^[\w-]{8,120}$/.test(input.requestId) ? input.requestId : undefined;

  const collections = await getCollections();
  await ensurePurchaseIndex(collections.transactions);
  await ensureHistoryIndexes(collections.history);
  if (requestId && await collections.history.findOne({ requestId })) {
    const persisted = await collections.auctions.findOne({ id: auctionId });
    if (!persisted) throw new Error("Auction not found after duplicate correction request.");
    return getAuctionRoom(persisted.tournamentId, persisted.gender);
  }

  const session = collections.database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const auction = await collections.auctions.findOne({ id: auctionId }, { session });
      if (!auction || auction.status !== "live" || !auction.awaitingAdvance || auction.lastSaleEventId !== saleEventId || auction.lastActionEventId !== saleEventId) {
        throw new Error("This sale is no longer the current reviewable action. Later auction activity prevents automatic correction.");
      }
      if (!auction.teamIds.includes(correctedTeamId)) throw new Error("Corrected team is not configured for this tournament competition.");

      const saleEvent = await collections.history.findOne({ eventId: saleEventId, auctionId }, { session });
      if (!saleEvent || (saleEvent.action !== "PLAYER_SOLD" && saleEvent.action !== "SALE_CORRECTED") || !saleEvent.playerId) {
        throw new Error("This sale event has no safe correction metadata.");
      }
      const playerId = saleEvent.playerId;
      const transaction = await collections.transactions.findOne({ auctionId, eventId: saleEvent.eventId, type: { $in: ["purchase", "correction"] } }, { session });
      if (!transaction?.transactionId) throw new Error("This sale has no correction-linked transaction.");
      if (await collections.transactions.findOne({ reversesTransactionId: transaction.transactionId }, { session })) {
        throw new Error("This sale transaction has already been reversed or replaced.");
      }

      const entry = await collections.tournamentPlayers.findOne({
        tournamentId: auction.tournamentId,
        gender: auction.gender,
        playerId,
        status: "sold",
        auctionId,
        teamId: transaction.teamId,
      }, { session });
      if (!entry || !Number.isFinite(entry.basePrice) || correctedAmount < entry.basePrice) {
        throw new Error("The sold player is unavailable or the corrected price is below base price.");
      }

      const currentTeam = await collections.teams.findOne({ id: transaction.teamId, tournamentId: auction.tournamentId, gender: auction.gender }, { session });
      const correctedTeam = await collections.teams.findOne({ id: correctedTeamId, tournamentId: auction.tournamentId, gender: auction.gender, status: "active" }, { session });
      if (!currentTeam || !correctedTeam) throw new Error("Original or corrected team is unavailable in this competition.");

      const baselineTeams = await getTeamViews(collections, auction, session, transaction.transactionId);
      const originalBaseline = baselineTeams.find((team) => team.id === currentTeam.id);
      const correctedBaseline = baselineTeams.find((team) => team.id === correctedTeam.id);
      if (!originalBaseline || !correctedBaseline) throw new Error("A team is no longer eligible; automatic correction is unsafe.");
      if (correctedBaseline.playersCount >= auction.maximumSquadSize) throw new Error("Corrected team has reached the maximum squad size.");
      if (correctedAmount > correctedBaseline.remainingBudget || correctedAmount > correctedBaseline.maximumAffordableBid) {
        throw new Error("Corrected team cannot afford this price while preserving its minimum squad reserve.");
      }

      const now = new Date();
      if (currentTeam.id === correctedTeam.id) {
        const teamUpdate = await collections.teams.updateOne(
          { id: currentTeam.id, tournamentId: auction.tournamentId, gender: auction.gender, playersCount: currentTeam.playersCount, remainingBudget: currentTeam.remainingBudget },
          { $set: {
            playersCount: originalBaseline.playersCount + 1,
            remainingBudget: originalBaseline.remainingBudget - correctedAmount,
            updatedAt: now,
          } },
          { session },
        );
        if (teamUpdate.modifiedCount !== 1) throw new Error("Team changed during correction; reload and retry.");
      } else {
        const originalTeamUpdate = await collections.teams.updateOne(
          { id: currentTeam.id, tournamentId: auction.tournamentId, gender: auction.gender, playersCount: currentTeam.playersCount, remainingBudget: currentTeam.remainingBudget },
          { $set: {
            playersCount: originalBaseline.playersCount,
            remainingBudget: originalBaseline.remainingBudget,
            updatedAt: now,
          } },
          { session },
        );
        if (originalTeamUpdate.modifiedCount !== 1) throw new Error("Original team changed during correction; reload and retry.");

        const correctedTeamUpdate = await collections.teams.updateOne(
          { id: correctedTeam.id, tournamentId: auction.tournamentId, gender: auction.gender, playersCount: correctedTeam.playersCount, remainingBudget: correctedTeam.remainingBudget },
          { $set: {
            playersCount: correctedBaseline.playersCount + 1,
            remainingBudget: correctedBaseline.remainingBudget - correctedAmount,
            updatedAt: now,
          } },
          { session },
        );
        if (correctedTeamUpdate.modifiedCount !== 1) throw new Error("Corrected team changed during correction; reload and retry.");
      }

      const playerUpdate = await collections.tournamentPlayers.updateOne(
        { tournamentId: auction.tournamentId, gender: auction.gender, playerId, status: "sold", teamId: currentTeam.id, auctionId },
        { $set: { teamId: correctedTeam.id, soldPrice: correctedAmount, updatedAt: now } },
        { session },
      );
      if (playerUpdate.modifiedCount !== 1) throw new Error("Player sale changed during correction; reload and retry.");

      const correctionEvent = await appendHistory(collections, auction, "SALE_CORRECTED", session, admin, {
        ...(requestId ? { requestId } : {}),
        playerId,
        teamId: correctedTeam.id,
        amount: correctedAmount,
        correctsEventId: saleEvent.eventId,
        reason,
        before: { teamId: currentTeam.id, amount: transaction.amount },
        after: { teamId: correctedTeam.id, amount: input.amount },
      });
      await collections.transactions.insertOne({
        transactionId: randomUUID(),
        eventId: correctionEvent.eventId,
        reversesTransactionId: transaction.transactionId,
        auctionId,
        tournamentId: auction.tournamentId,
        gender: auction.gender,
        playerId,
        teamId: correctedTeam.id,
        amount: correctedAmount,
        round: auction.currentRound ?? 1,
        type: "correction",
        createdAt: correctionEvent.createdAt,
      }, { session });
      const correctedResult = auction.lastResult
        ? {
            ...auction.lastResult,
            teamId: correctedTeam.id,
            teamName: correctedTeam.name,
            teamShortName: correctedTeam.shortName,
            amount: correctedAmount,
          }
        : undefined;
      const auctionUpdate = await collections.auctions.updateOne(
        { id: auctionId, status: "live", currentPlayerId: playerId, awaitingAdvance: true, lastActionEventId: correctionEvent.eventId },
        { $set: {
          currentBid: correctedAmount,
          highestTeamId: correctedTeam.id,
          lastSaleEventId: correctionEvent.eventId,
          ...(correctedResult ? { lastResult: correctedResult } : {}),
          updatedAt: correctionEvent.createdAt,
        } },
        { session },
      );
      if (auctionUpdate.modifiedCount !== 1) throw new Error("Auction changed during correction; reload and retry.");
    });
  } catch (error) {
    const duplicate = error && typeof error === "object" && "code" in error && error.code === 11000;
    if (!requestId || !duplicate || !await collections.history.findOne({ requestId })) throw error;
  } finally {
    await session.endSession();
  }

  const auction = await collections.auctions.findOne({ id: auctionId });
  if (!auction) throw new Error("Auction not found after correction.");
  return getAuctionRoom(auction.tournamentId, auction.gender);
}

export async function submitAuctionBid(
  auctionId: string,
  teamId: unknown,
  amountValue: unknown,
  admin: AdminUser,
  requestIdValue?: unknown,
) {
  if (typeof teamId !== "string" || !teamId.trim()) throw new Error("Select an eligible team for the bid.");
  if (amountValue !== undefined && amountValue !== null && (typeof amountValue !== "number" || !Number.isFinite(amountValue) || amountValue < 0)) {
    throw new Error("Bid must be a valid non-negative number.");
  }
  const requestId = typeof requestIdValue === "string" && /^[\w-]{8,120}$/.test(requestIdValue)
    ? requestIdValue
    : undefined;

  const collections = await getCollections();
  await ensureHistoryIndexes(collections.history);
  if (requestId && await collections.history.findOne({ requestId })) {
    const persisted = await collections.auctions.findOne({ id: auctionId });
    if (!persisted) throw new Error("Auction not found after duplicate bid request.");
    return getAuctionRoom(persisted.tournamentId, persisted.gender);
  }
  const session = collections.database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const auction = await collections.auctions.findOne({ id: auctionId }, { session });
      if (!auction || auction.status !== "live") throw new Error("Bids can only be entered while the auction is live.");
      if (auction.awaitingAdvance) throw new Error("Advance to the next player before placing another bid.");
      if (typeof auction.currentBid !== "number") throw new Error("Auction bid state is incomplete; reinitialize the auction.");
      const playerId = auction.currentPlayerId;
      if (!playerId || !auction.playerPoolIds?.includes(playerId)) throw new Error("There is no eligible current player.");
      if (!auction.teamIds.includes(teamId)) throw new Error("This team is not configured for the auction.");

      const entry = await collections.tournamentPlayers.findOne({
        tournamentId: auction.tournamentId,
        gender: auction.gender,
        playerId,
        status: "on_auction",
      }, { session });
      const player = await collections.players.findOne({ id: playerId }, { session });
      const team = await collections.teams.findOne({
        id: teamId,
        tournamentId: auction.tournamentId,
        gender: auction.gender,
        status: "active",
      }, { session });
      if (!entry || !player || player.gender !== auction.gender) throw new Error("Current player is not eligible for this auction.");
      if (!Number.isFinite(entry.basePrice) || entry.basePrice < 0) throw new Error("Current player has an invalid base price.");
      if (!team) throw new Error("Selected team is not active in this tournament competition.");
      if (auction.highestTeamId === teamId) {
        throw new Error("The leading team cannot bid twice in a row. Another team must raise the bid first.");
      }

      const teamViews = await getTeamViews(collections, auction, session);
      const selectedTeam = teamViews.find((candidate) => candidate.id === teamId);
      if (!selectedTeam) throw new Error("Selected team is not eligible for this auction.");
      if (selectedTeam.playersCount >= auction.maximumSquadSize) throw new Error("This team has reached the maximum squad size.");

      const minimumBid = auction.highestTeamId
        ? auction.currentBid + auction.bidIncrement
        : entry.basePrice;
      const amount = amountValue === undefined || amountValue === null ? minimumBid : amountValue;
      if (amount < minimumBid) throw new Error(`The minimum valid bid is ${minimumBid}.`);
      if (amount > selectedTeam.remainingBudget) throw new Error("Bid exceeds this team's available budget.");
      if (amount > selectedTeam.maximumAffordableBid) {
        throw new Error(`Bid exceeds the team's maximum affordable amount of ${selectedTeam.maximumAffordableBid}, after reserving for its minimum squad.`);
      }

      const auctionFilter: Filter<AuctionDocument> = {
        id: auctionId,
        status: "live",
        $or: [{ awaitingAdvance: false }, { awaitingAdvance: { $exists: false } }],
        currentPlayerId: playerId,
        currentBid: auction.currentBid,
        ...(auction.highestTeamId ? { highestTeamId: auction.highestTeamId } : { highestTeamId: { $exists: false } }),
      };
      const result = await collections.auctions.updateOne(
        auctionFilter,
        { $set: { currentBid: amount, highestTeamId: teamId, updatedAt: new Date() } },
        { session },
      );
      if (result.modifiedCount !== 1) throw new Error("Auction changed while saving this bid. Reload and try again.");

      await appendHistory(collections, auction, "BID_UPDATED", session, admin, {
        ...(requestId ? { requestId } : {}),
        playerId,
        teamId,
        amount,
        before: { currentBid: auction.currentBid, highestTeamId: auction.highestTeamId ?? null },
        after: { currentBid: amount, highestTeamId: teamId },
      });
    });
  } catch (error) {
    const isDuplicateKey = error && typeof error === "object" && "code" in error && error.code === 11000;
    if (!requestId || !isDuplicateKey || !await collections.history.findOne({ requestId })) throw error;
  } finally {
    await session.endSession();
  }

  const auction = await collections.auctions.findOne({ id: auctionId });
  if (!auction) throw new Error("Auction not found after saving bid.");
  return getAuctionRoom(auction.tournamentId, auction.gender);
}

export async function transitionAuction(auctionId: string, action: AuctionLifecycleAction, admin: AdminUser) {
  const collections = await getCollections();
  await ensureHistoryIndexes(collections.history);
  const auction = await collections.auctions.findOne({ id: auctionId });
  if (!auction) throw new Error("Auction not found.");

  const statusesByAction: Record<AuctionLifecycleAction, AuctionConfig["status"][]> = {
    start: ["ready"],
    pause: ["live"],
    resume: ["paused"],
    complete: ["live", "paused"],
  };
  const allowedStatuses = statusesByAction[action];
  if (!allowedStatuses.includes(auction.status)) {
    throw new Error(`Cannot ${action} an auction with status ${auction.status}.`);
  }
  if (action === "complete" && auction.roundStatus !== "complete") {
    throw new Error("Complete the current round before completing the auction.");
  }

  const session = collections.database.client.startSession();
  try {
    await session.withTransaction(async () => {
      if (action === "start") {
        const playerId = auction.currentPlayerId ?? auction.playerPoolIds?.[0];
        if (!playerId || !auction.playerPoolIds?.includes(playerId)) throw new Error("The initialized player pool is unavailable.");
        const playerUpdate = await collections.tournamentPlayers.updateOne(
          { tournamentId: auction.tournamentId, gender: auction.gender, playerId, status: "available" },
          { $set: { status: "on_auction", auctionId: auction.id, updatedAt: new Date() } },
          { session },
        );
        if (playerUpdate.modifiedCount !== 1) throw new Error("The current player is no longer eligible for auction.");
      }
      if (action === "complete") {
        const underfilledTeams = (await getTeamViews(collections, auction, session))
          .filter((team) => team.playersCount < auction.minimumSquadSize);
        if (underfilledTeams.length > 0) {
          throw new Error(`Every team must have at least ${auction.minimumSquadSize} players before completion. Still short: ${underfilledTeams.map((team) => team.name).join(", ")}.`);
        }
      }

      const nextStatus = action === "start" || action === "resume" ? "live" : action === "pause" ? "paused" : "completed";
      const set: Record<string, unknown> = { status: nextStatus, updatedAt: new Date() };
      if (action === "start") set.roundStatus = "in_progress";
      if (action === "complete") set.completedAt = new Date();
      const result = await collections.auctions.updateOne(
        { id: auctionId, status: { $in: allowedStatuses }, ...(action === "complete" ? { roundStatus: "complete" } : {}) },
        { $set: set },
        { session },
      );
      if (result.modifiedCount !== 1) throw new Error("Auction state changed concurrently; reload and try again.");
      const historyAction: Record<AuctionLifecycleAction, string> = {
        start: "AUCTION_STARTED",
        pause: "AUCTION_PAUSED",
        resume: "AUCTION_RESUMED",
        complete: "AUCTION_COMPLETED",
      };
      await appendHistory(collections, auction, historyAction[action], session, admin, {
        before: { status: auction.status },
        after: { status: nextStatus },
      });
    });
  } finally {
    await session.endSession();
  }

  return getAuctionRoom(auction.tournamentId, auction.gender);
}

async function advanceAuctionPlayer(
  collections: Awaited<ReturnType<typeof getCollections>>,
  auction: AuctionConfig,
  completedPlayerId: string,
  session: ClientSession,
  admin: AdminUser,
) {
  const currentRound = auction.currentRound ?? 1;
  const roundPlayerIds = auction.roundPlayerIds ?? auction.playerPoolIds ?? [];
  const candidates = await collections.tournamentPlayers.find({
    tournamentId: auction.tournamentId,
    gender: auction.gender,
    playerId: { $in: roundPlayerIds },
    status: { $in: ["available", "unsold"] },
    $or: [
      { lastAuctionRound: { $exists: false } },
      { lastAuctionRound: { $lt: currentRound } },
    ],
  }, { session }).toArray();
  candidates.sort((left, right) => roundPlayerIds.indexOf(left.playerId) - roundPlayerIds.indexOf(right.playerId));

  let nextPlayer: TournamentPlayerDocument | undefined;
  for (const candidate of candidates) {
    const player = await collections.players.findOne({ id: candidate.playerId }, { session });
    if (!player || player.gender !== auction.gender) {
      throw new Error("A remaining auction player is missing or no longer matches this competition's gender.");
    }
    if (!Number.isFinite(candidate.basePrice) || candidate.basePrice < 0) {
      throw new Error("A remaining auction player has an invalid base price.");
    }
    const result = await collections.tournamentPlayers.updateOne(
      {
        tournamentId: auction.tournamentId,
        gender: auction.gender,
        playerId: candidate.playerId,
        status: candidate.status,
        $or: [
          { lastAuctionRound: { $exists: false } },
          { lastAuctionRound: { $lt: currentRound } },
        ],
      },
      { $set: { status: "on_auction", auctionId: auction.id, updatedAt: new Date() } },
      { session },
    );
    if (result.modifiedCount === 1) {
      nextPlayer = candidate;
      break;
    }
  }

  if (nextPlayer) {
    const result = await collections.auctions.updateOne(
      { id: auction.id, status: "live", currentPlayerId: completedPlayerId },
      {
        $set: {
          currentPlayerId: nextPlayer.playerId,
          currentBid: nextPlayer.basePrice,
          roundStatus: "in_progress",
          awaitingAdvance: false,
          updatedAt: new Date(),
        },
        $unset: { highestTeamId: "" },
      },
      { session },
    );
    if (result.modifiedCount !== 1) throw new Error("Auction state changed while advancing to the next player.");
    await appendHistory(collections, auction, "PLAYER_PUT_ON_AUCTION", session, admin, {
      playerId: nextPlayer.playerId,
      before: { currentPlayerId: completedPlayerId, round: currentRound },
      after: { currentPlayerId: nextPlayer.playerId, basePrice: nextPlayer.basePrice, round: currentRound },
    });
    return;
  }

  const result = await collections.auctions.updateOne(
    { id: auction.id, status: "live", currentPlayerId: completedPlayerId },
    {
      $set: { currentBid: 0, roundStatus: "complete", awaitingAdvance: false, updatedAt: new Date() },
      $unset: { currentPlayerId: "", highestTeamId: "" },
    },
    { session },
  );
  if (result.modifiedCount !== 1) throw new Error("Auction state changed while completing the round.");
  await appendHistory(collections, auction, "ROUND_COMPLETED", session, admin, {
    before: { currentPlayerId: completedPlayerId, round: currentRound },
    after: { roundStatus: "complete" },
  });
}

export async function advanceAuctionToNextPlayer(
  auctionId: string,
  admin: AdminUser,
  expectedResultEventId?: string,
) {
  const collections = await getCollections();
  await ensureHistoryIndexes(collections.history);
  const session = collections.database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const auction = await collections.auctions.findOne({ id: auctionId }, { session });
      if (!auction || auction.status !== "live" || auction.roundStatus !== "in_progress") {
        throw new Error("The auction is not ready to advance to another player.");
      }
      if (!auction.awaitingAdvance || !auction.currentPlayerId) {
        throw new Error("Record the current player's SOLD or UNSOLD outcome before advancing.");
      }
      if (expectedResultEventId && auction.lastResult?.eventId !== expectedResultEventId) {
        throw new Error("The auction result changed before it could advance.");
      }
      if (auction.lastResult && auction.lastResult.displayUntil.getTime() > Date.now()) {
        throw new Error("The result display must finish before advancing.");
      }
      await advanceAuctionPlayer(collections, auction, auction.currentPlayerId, session, admin);
    });
  } finally {
    await session.endSession();
  }

  const auction = await collections.auctions.findOne({ id: auctionId });
  if (!auction) throw new Error("Auction not found after advancing.");
  return getAuctionRoom(auction.tournamentId, auction.gender);
}