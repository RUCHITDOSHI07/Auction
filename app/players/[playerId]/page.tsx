import PlayerDetail from "@/components/players/PlayerDetail";
import { getPlayerById } from "@/lib/services/players";

export default async function PlayerDetailPage({ params }: { params: Promise<{ playerId: string }> }) {
	const { playerId } = await params;
	const player = await getPlayerById(playerId);
	return <PlayerDetail playerId={playerId} initialPlayer={player ?? undefined} />;
}
