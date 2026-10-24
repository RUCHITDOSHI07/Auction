import { getMongoDb } from "@/lib/mongodb";
import type { CompetitionGender } from "@/types/tournament";
import { getTournamentById } from "@/lib/services/tournaments";

export type PublicTournamentPlayer = {
  id: string;
  name: string;
  fullName?: string;
  initials?: string;
  accent?: string;
  photoUrl?: string;
  role: string;
  category: string;
  gender: CompetitionGender;
  age?: number;
  battingStyle?: string;
  batting?: string;
  basePrice: number;
  status: "available" | "on_auction" | "sold" | "unsold";
};

type TournamentPlayerEntry = {
  playerId: string;
  gender: CompetitionGender;
  category?: string;
  basePrice: number;
  status: PublicTournamentPlayer["status"];
};

type PublicPlayerDocument = Omit<PublicTournamentPlayer, "gender" | "basePrice" | "status"> & {
  gender?: CompetitionGender;
};

export async function getPublicTournamentPlayers(tournamentId: string, gender: CompetitionGender) {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  if (!tournament.competitions[gender].enabled) {
    throw new Error(`${gender === "male" ? "Men's" : "Women's"} competition is not enabled for this tournament.`);
  }

  const database = await getMongoDb();
  const entries = await database.collection<TournamentPlayerEntry>("tournamentPlayers")
    .find({ tournamentId, gender })
    .sort({ createdAt: 1, playerId: 1 })
    .toArray();
  if (entries.length === 0) return [];

  const players = await database.collection<PublicPlayerDocument>("players")
    .find({ id: { $in: entries.map((entry) => entry.playerId) }, gender }, {
      projection: {
        _id: 0,
        id: 1,
        name: 1,
        fullName: 1,
        initials: 1,
        accent: 1,
        photoUrl: 1,
        role: 1,
        category: 1,
        gender: 1,
        age: 1,
        battingStyle: 1,
        batting: 1,
      },
    })
    .toArray();
  const playersById = new Map(players.map((player) => [player.id, player]));

  return entries.flatMap((entry) => {
    const player = playersById.get(entry.playerId);
    if (!player) return [];
    return [{
      ...player,
      name: player.name || player.fullName || "Unnamed player",
      category: entry.category ?? player.category ?? "General",
      gender,
      basePrice: entry.basePrice,
      status: entry.status,
    }];
  });
}
