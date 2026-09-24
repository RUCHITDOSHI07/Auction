import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { importPlayersIntoTournament } from "@/lib/services/tournament-players";
import type { PlayerInput } from "@/types/firestore";

export async function POST(request: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  try {
    await requireAdmin();
    const { tournamentId } = await params;
    const body = await request.json() as { players?: unknown };
    if (!Array.isArray(body.players)) return NextResponse.json({ error: "The request must contain a players array." }, { status: 400 });
    return NextResponse.json(await importPlayersIntoTournament(tournamentId, body.players as PlayerInput[]));
  } catch (error) {
    if (error instanceof AdminApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to import players." }, { status: 500 });
  }
}
