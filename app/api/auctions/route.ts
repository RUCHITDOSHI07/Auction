import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { getAuctionRoom, initializeAuction } from "@/lib/services/auctions";

function errorResponse(error: unknown, status = 400) {
  if (error instanceof AdminApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unable to load auction." },
    { status },
  );
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const tournamentId = url.searchParams.get("tournamentId")?.trim();
    const gender = url.searchParams.get("gender");
    if (!tournamentId || !gender) {
      return NextResponse.json({ error: "tournamentId and gender are required." }, { status: 400 });
    }
    return NextResponse.json({ room: await getAuctionRoom(tournamentId, gender) });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json() as { action?: unknown; tournamentId?: unknown; gender?: unknown };
    if (body.action !== "initialize" || typeof body.tournamentId !== "string") {
      return NextResponse.json({ error: "An initialize action, tournamentId, and gender are required." }, { status: 400 });
    }
    return NextResponse.json({ room: await initializeAuction(body.tournamentId, body.gender, admin) });
  } catch (error) {
    return errorResponse(error);
  }
}