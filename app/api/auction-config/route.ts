import { NextResponse } from "next/server";
import { requireAdmin, AdminApiError } from "@/lib/auth/admin-api";
import { getAuctionConfig, saveAuctionConfig } from "@/lib/services/auction-config";
import { assignConfiguredTeamIconPlayers } from "@/lib/services/auctions";
import type { AuctionConfigInput } from "@/types/auction-config";
import type { CompetitionGender } from "@/types/tournament";

function fail(error: unknown) {
  if (error instanceof AdminApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to configure auction." }, { status: 400 });
}
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const tournamentId = url.searchParams.get("tournamentId") ?? "";
    const gender = url.searchParams.get("gender") as CompetitionGender;
    if (!tournamentId || !gender) return NextResponse.json({ error: "tournamentId and gender are required." }, { status: 400 });
    return NextResponse.json({ config: await getAuctionConfig(tournamentId, gender) });
  } catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const input = await request.json() as AuctionConfigInput;
    const config = await saveAuctionConfig(input);
    await assignConfiguredTeamIconPlayers(input.tournamentId, input.gender, admin);
    return NextResponse.json({ config });
  } catch (error) { return fail(error); }
}
