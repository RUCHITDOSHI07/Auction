import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { assignPreAuctionIconPlayers } from "@/lib/services/auctions";
import type { CompetitionGender } from "@/types/tournament";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json() as {
      tournamentId?: unknown;
      gender?: unknown;
      assignments?: unknown;
    };
    if (typeof body.tournamentId !== "string" || !body.tournamentId.trim()) {
      return NextResponse.json({ error: "tournamentId is required." }, { status: 400 });
    }
    if (body.gender !== "male" && body.gender !== "female") {
      return NextResponse.json({ error: "Competition must be male or female." }, { status: 400 });
    }
    if (!Array.isArray(body.assignments)) {
      return NextResponse.json({ error: "assignments must be a list." }, { status: 400 });
    }
    const assignments = body.assignments.map((value) => {
      if (!value || typeof value !== "object") throw new Error("Each assignment must include a team and player.");
      const assignment = value as Record<string, unknown>;
      if (typeof assignment.teamId !== "string" || typeof assignment.playerId !== "string") {
        throw new Error("Each assignment must include a team and player.");
      }
      return { teamId: assignment.teamId, playerId: assignment.playerId };
    });
    const result = await assignPreAuctionIconPlayers(
      body.tournamentId,
      body.gender as CompetitionGender,
      assignments,
      admin,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to assign icon players." },
      { status: 400 },
    );
  }
}
