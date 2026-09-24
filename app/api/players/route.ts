import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { createPlayer, getPlayers } from "@/lib/services/players";
import type { PlayerInput } from "@/types/firestore";

function errorResponse(error: unknown) {
  if (error instanceof AdminApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Player API request failed.");
  return NextResponse.json({ error: "Unable to complete the player request." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    return NextResponse.json({ players: await getPlayers() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = await request.json() as PlayerInput;
    const playerId = await createPlayer(input);
    return NextResponse.json({ id: playerId }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}