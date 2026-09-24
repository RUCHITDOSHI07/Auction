import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { getTournamentPlayers } from "@/lib/services/tournament-players";
import type { CompetitionGender } from "@/types/tournament";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const tournamentId = url.searchParams.get("tournamentId");
    const gender = url.searchParams.get("gender") as CompetitionGender | null;
    if (!tournamentId) return NextResponse.json({ error: "tournamentId is required." }, { status: 400 });
    return NextResponse.json({ players: await getTournamentPlayers(tournamentId, gender ?? undefined) });
  } catch (error) {
    if (error instanceof AdminApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load tournament players." }, { status: 500 });
  }
}
