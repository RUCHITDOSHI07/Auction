import { getPlayers } from "@/lib/services/players";
import PlayerDirectory from "@/components/players/PlayerDirectory";

export default async function PlayersPage() {
  const players = await getPlayers();
  return <PlayerDirectory players={players} />;
}
