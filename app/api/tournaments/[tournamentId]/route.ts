import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { getTournamentById, updateTournament } from "@/lib/services/tournaments";
import type { TournamentInput, TournamentStatus } from "@/types/tournament";

type RouteContext = {
  params: Promise<{ tournamentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { tournamentId } = await context.params;
    const tournament = await getTournamentById(tournamentId);

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
    }

    return NextResponse.json({ tournament });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load tournament." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { tournamentId } = await context.params;
    const body = await request.json() as Partial<TournamentInput> & { status?: TournamentStatus };

    const tournament = await updateTournament(tournamentId, body);
    return NextResponse.json({ tournament });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update tournament." },
      { status: 400 },
    );
  }
}
