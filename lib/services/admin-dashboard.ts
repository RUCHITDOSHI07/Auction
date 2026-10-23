import { getMongoDb } from "@/lib/mongodb";
import { getTournaments } from "@/lib/services/tournaments";
import type { CompetitionGender, Tournament } from "@/types/tournament";

type CountGroup = { _id: { tournamentId: string; gender: CompetitionGender; status?: string }; count: number };
type AuctionSummary = { id: string; tournamentId: string; gender: CompetitionGender; status: string; currentRound?: number; playerPoolIds?: string[]; currentPlayerId?: string; currentBid?: number; highestTeamId?: string };

export async function getTournamentCompetitionCounts(tournaments: Tournament[]) {
  if (tournaments.length === 0) return [];

  const database = await getMongoDb();
  const tournamentIds = tournaments.map((tournament) => tournament.id);
  const [teamCounts, playerCounts] = await Promise.all([
    database.collection("teams").aggregate<CountGroup>([
      { $match: { tournamentId: { $in: tournamentIds } } },
      { $group: { _id: { tournamentId: "$tournamentId", gender: "$gender" }, count: { $sum: 1 } } },
    ]).toArray(),
    database.collection("tournamentPlayers").aggregate<CountGroup>([
      { $match: { tournamentId: { $in: tournamentIds } } },
      { $group: { _id: { tournamentId: "$tournamentId", gender: "$gender" }, count: { $sum: 1 } } },
    ]).toArray(),
  ]);
  const teamCountByCompetition = new Map(teamCounts.map((group) => [
    `${group._id.tournamentId}:${group._id.gender}`,
    group.count,
  ]));
  const playerCountByCompetition = new Map(playerCounts.map((group) => [
    `${group._id.tournamentId}:${group._id.gender}`,
    group.count,
  ]));

  return tournaments.flatMap((tournament) => (["male", "female"] as const)
    .filter((gender) => tournament.competitions[gender].enabled)
    .map((gender) => {
      const key = `${tournament.id}:${gender}`;
      return {
        tournamentId: tournament.id,
        gender,
        teamCount: teamCountByCompetition.get(key) ?? 0,
        playerCount: playerCountByCompetition.get(key) ?? 0,
      };
    }));
}

export async function getAdminDashboardSummary(tournamentList?: Tournament[]) {
  const database = await getMongoDb();
  const [tournaments, teamCounts, playerCounts, auctions] = await Promise.all([
    tournamentList ?? getTournaments(),
    database.collection("teams").aggregate<CountGroup>([
      { $group: { _id: { tournamentId: "$tournamentId", gender: "$gender" }, count: { $sum: 1 } } },
    ]).toArray(),
    database.collection("tournamentPlayers").aggregate<CountGroup>([
      { $group: { _id: { tournamentId: "$tournamentId", gender: "$gender", status: "$status" }, count: { $sum: 1 } } },
    ]).toArray(),
    database.collection<AuctionSummary>("auctions").find({}, {
      projection: { id: 1, tournamentId: 1, gender: 1, status: 1, currentRound: 1, playerPoolIds: 1, currentPlayerId: 1, currentBid: 1, highestTeamId: 1 },
    }).toArray(),
  ]);
  const tournamentById = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  const teamCount = (tournamentId: string, gender: CompetitionGender) => teamCounts.find((group) => group._id.tournamentId === tournamentId && group._id.gender === gender)?.count ?? 0;
  const playerCount = (tournamentId: string, gender: CompetitionGender) => playerCounts
    .filter((group) => group._id.tournamentId === tournamentId && group._id.gender === gender)
    .reduce((sum, group) => sum + group.count, 0);
  const competitions = auctions.map((auction) => ({
    ...auction,
    tournamentName: tournamentById.get(auction.tournamentId)?.name ?? "Tournament",
    season: tournamentById.get(auction.tournamentId)?.season ?? null,
  }));
  const enabledCompetitions = tournaments.flatMap((tournament) => (["male", "female"] as const)
    .filter((gender) => tournament.competitions[gender].enabled)
    .map((gender) => ({
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      season: tournament.season,
      gender,
      teamCount: teamCount(tournament.id, gender),
      playerCount: playerCount(tournament.id, gender),
      auction: competitions.find((auction) => auction.tournamentId === tournament.id && auction.gender === gender) ?? null,
    })));

  return {
    tournamentCount: tournaments.length,
    teamCount: teamCounts.reduce((sum, group) => sum + group.count, 0),
    playerCount: playerCounts.reduce((sum, group) => sum + group.count, 0),
    liveAuctionCount: competitions.filter((auction) => auction.status === "live").length,
    tournaments,
    competitions: enabledCompetitions,
  };
}