import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { bulkUpsertPlayers } from "@/lib/services/players";
import type { PlayerInput } from "@/types/firestore";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json() as { players?: unknown };
    if (!Array.isArray(body.players)) {
      return NextResponse.json({ error: "The request must contain a players array." }, { status: 400 });
    }

    const result = await bulkUpsertPlayers(body.players as PlayerInput[]);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Player import failed.");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to import players." }, { status: 500 });
  }
}