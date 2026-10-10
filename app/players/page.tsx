import { getPlayers } from "@/lib/services/players";
import PlayerDirectory from "@/components/players/PlayerDirectory";
import { connection } from "next/server";

export default async function PlayersPage() {
  await connection();
  const players = await getPlayers();
  return <PlayerDirectory players={players} />;
}
