import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { createTeam, getTeamById, getTeams } from "@/lib/services/teams";
import { assignConfiguredTeamIconPlayers } from "@/lib/services/auctions";
import type { CompetitionGender } from "@/types/tournament";
import type { TeamInput } from "@/types/team";

function errorResponse(error: unknown) {
  if (error instanceof AdminApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unable to complete the team request." },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const tournamentId = url.searchParams.get("tournamentId")?.trim();
    const gender = url.searchParams.get("gender") as CompetitionGender | null;

    if (!tournamentId || !gender) {
      return NextResponse.json({ error: "tournamentId and gender are required." }, { status: 400 });
    }

    return NextResponse.json({ teams: await getTeams(tournamentId, gender) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const input = await request.json() as TeamInput;
    const team = await createTeam(input);
    let warning: string | undefined;
    if (input.iconPlayerId) {
      try {
        await assignConfiguredTeamIconPlayers(input.tournamentId, input.gender, admin);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unexpected error.";
        warning = `Team was created, but the icon-player purchase was not completed: ${reason} You can retry by editing the team or saving auction settings again.`;
      }
    }
    return NextResponse.json({ team: await getTeamById(team.id) ?? team, ...(warning ? { warning } : {}) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
