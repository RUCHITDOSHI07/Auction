import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { deleteTeam, getTeamById, updateTeam } from "@/lib/services/teams";

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
    await requireAdmin();
    const { teamId } = await context.params;
    return NextResponse.json({ team: await updateTeam(teamId, await request.json()) });
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
