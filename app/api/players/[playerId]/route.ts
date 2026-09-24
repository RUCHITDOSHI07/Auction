import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { deletePlayer, getPlayerById, updatePlayer } from "@/lib/services/players";
import type { Player } from "@/types/firestore";

type RouteContext = { params: Promise<{ playerId: string }> };

function errorResponse(error: unknown) {
  if (error instanceof AdminApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Player API request failed.");
  return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to complete the player request." }, { status: 500 });
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { playerId } = await context.params;
    const player = await getPlayerById(playerId);
    return player ? NextResponse.json({ player }) : NextResponse.json({ error: "Player not found." }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { playerId } = await context.params;
    const changes = await request.json() as Partial<Omit<Player, "id" | "createdAt" | "updatedAt">>;
    await updatePlayer(playerId, changes);
    return NextResponse.json({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { playerId } = await context.params;
    await deletePlayer(playerId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}