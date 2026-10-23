import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { deleteTeam, getTeamById, updateTeam } from "@/lib/services/teams";
import { assignConfiguredTeamIconPlayers } from "@/lib/services/auctions";
import type { TeamInput } from "@/types/team";

type RouteContext = { params: Promise<{ teamId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { teamId } = await context.params;
    const team = await getTeamById(teamId);
    if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });
    return NextResponse.json({ team });
  } catch (error) {
    if (error instanceof AdminApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load team." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { teamId } = await context.params;
    const changes = await request.json() as Partial<Omit<TeamInput, "tournamentId" | "gender">>;
    const team = await updateTeam(teamId, changes);
    let warning: string | undefined;
    if (typeof changes.iconPlayerId === "string" && changes.iconPlayerId.trim()) {
      try {
        await assignConfiguredTeamIconPlayers(team.tournamentId, team.gender, admin);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unexpected error.";
        warning = `Team was updated, but the icon-player purchase was not completed: ${reason} You can retry by editing the team or saving auction settings again.`;
      }
    }
    return NextResponse.json({ team: await getTeamById(teamId) ?? team, ...(warning ? { warning } : {}) });
  } catch (error) {
    if (error instanceof AdminApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update team." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { teamId } = await context.params;
    await deleteTeam(teamId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete team." }, { status: 400 });
  }
}
