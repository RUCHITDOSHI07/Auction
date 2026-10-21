import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { createTournament, getTournaments } from "@/lib/services/tournaments";
import { getAdminDashboardSummary } from "@/lib/services/admin-dashboard";
import type { TournamentInput } from "@/types/tournament";

export async function GET() {
  try {
    await requireAdmin();
    const tournaments = await getTournaments();
    const summary = await getAdminDashboardSummary(tournaments);
    return NextResponse.json({ tournaments, competitionCounts: summary.competitions });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load tournaments." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json() as Partial<TournamentInput>;

    const tournament = await createTournament({
      name: body.name ?? "",
      season: Number(body.season),
      description: body.description,
      competitions: {
        male: Boolean(body.competitions?.male),
        female: Boolean(body.competitions?.female),
      },
      categoryRules: body.categoryRules,
    });

    return NextResponse.json({ tournament }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create tournament." },
      { status: 400 },
    );
  }
}
