import { getMongoDb } from "@/lib/mongodb";
import type { CompetitionGender } from "@/types/tournament";

type HistoryDocument = {
  _id: unknown;
  eventId?: string;
  requestId?: string;
  auctionId: string;
  tournamentId: string;
  gender: CompetitionGender;
  action: string;
  round?: number;
  admin?: { userId?: string; name?: string };
  playerId?: string;
  teamId?: string;
  amount?: number;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reversesEventId?: string;
  correctsEventId?: string;
  reason?: string;
  createdAt?: Date;
};

export interface AuctionHistoryFilters {
  tournamentId?: string;
  auctionId?: string;
  gender?: CompetitionGender;
  teamId?: string;
  action?: string;
  query?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getAuctionHistory(filters: AuctionHistoryFilters) {
  const database = await getMongoDb();
  const history = database.collection<HistoryDocument>("auctionHistory");
  const filter: Record<string, unknown> = {};
  if (filters.tournamentId) filter.tournamentId = filters.tournamentId;
  if (filters.auctionId) filter.auctionId = filters.auctionId;
  if (filters.gender) filter.gender = filters.gender;
  if (filters.teamId) filter.teamId = filters.teamId;
  if (filters.action) filter.action = filters.action;
  if (filters.from || filters.to) {
    filter.createdAt = { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.to ? { $lte: filters.to } : {}) };
  }

  if (filters.query) {
    const pattern = new RegExp(escapeRegex(filters.query.trim()), "i");
    const [players, directEvents] = await Promise.all([
      database.collection("players").find({ $or: [{ id: pattern }, { name: pattern }, { fullName: pattern }] }, { projection: { id: 1 } }).toArray(),
      history.find({ ...filter, $or: [{ playerId: pattern }, { teamId: pattern }] }).project({ _id: 1 }).toArray(),
    ]);
    const eventIds = directEvents.map((event) => event._id);
    filter.$or = [
      { playerId: { $in: players.map((player) => player.id) } },
      { playerId: pattern },
      { teamId: pattern },
      { _id: { $in: eventIds } },
    ];
  }

  const [events, total] = await Promise.all([
    history.find(filter).sort({ createdAt: -1, _id: -1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).toArray(),
    history.countDocuments(filter),
  ]);
  const playerIds = [...new Set(events.flatMap((event) => event.playerId ? [event.playerId] : []))];
  const teamIds = [...new Set(events.flatMap((event) => event.teamId ? [event.teamId] : []))];
  const auctionIds = [...new Set(events.map((event) => event.auctionId))];
  const [players, teams, auctions, tournamentOptions, teamOptions] = await Promise.all([
    database.collection("players").find({ id: { $in: playerIds } }, { projection: { id: 1, name: 1, fullName: 1 } }).toArray(),
    database.collection("teams").find({ id: { $in: teamIds } }, { projection: { id: 1, name: 1, shortName: 1 } }).toArray(),
    database.collection<{ id: string; lastActionEventId?: string; lastSaleEventId?: string; awaitingAdvance?: boolean }>("auctions").find({ id: { $in: auctionIds } }, { projection: { id: 1, lastActionEventId: 1, lastSaleEventId: 1, awaitingAdvance: 1 } }).toArray(),
    database.collection<{ id: string; name: string; season: number }>("tournaments").find({}, { projection: { id: 1, name: 1, season: 1 } }).sort({ season: -1 }).toArray(),
    database.collection<{ id: string; name: string; shortName: string; tournamentId: string; gender: CompetitionGender }>("teams").find({}, { projection: { id: 1, name: 1, shortName: 1, tournamentId: 1, gender: 1 } }).sort({ name: 1 }).toArray(),
  ]);
  const playerById = new Map(players.map((player) => [player.id, player]));
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const auctionById = new Map(auctions.map((auction) => [auction.id, auction]));

  return {
    events: events.map((event) => {
      const auction = auctionById.get(event.auctionId);
      const eligibleSale = event.action === "PLAYER_SOLD" || event.action === "SALE_CORRECTED";
      const canCorrect = Boolean(event.eventId && eligibleSale && auction?.awaitingAdvance && auction.lastSaleEventId === event.eventId && auction.lastActionEventId === event.eventId);
      const correctionBlockedReason = !eligibleSale || canCorrect
        ? null
        : !event.eventId || !event.admin
          ? "This legacy sale lacks the event metadata needed for a safe automatic correction."
          : !auction
            ? "The auction record is unavailable, so this sale cannot be corrected automatically."
            : "Later auction activity exists. Automatic correction is blocked to avoid rewinding dependent bids or sales.";
      const record = { ...event };
      delete record._id;
      return {
        ...record,
        playerName: event.playerId ? (playerById.get(event.playerId)?.name ?? playerById.get(event.playerId)?.fullName ?? null) : null,
        teamName: event.teamId ? (teamById.get(event.teamId)?.name ?? null) : null,
        teamShortName: event.teamId ? (teamById.get(event.teamId)?.shortName ?? null) : null,
        metadataAvailable: Boolean(event.eventId && event.admin),
        canCorrect,
        correctionBlockedReason,
      };
    }),
    page: filters.page,
    limit: filters.limit,
    total,
    options: { tournaments: tournamentOptions, teams: teamOptions },
  };
}