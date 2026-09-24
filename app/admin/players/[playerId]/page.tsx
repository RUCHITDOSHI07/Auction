import PlayerDetail from "@/components/players/PlayerDetail";

export default async function AdminPlayerDetailPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  return <PlayerDetail playerId={playerId} adminMode />;
}