import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { getAuctionHistory } from "@/lib/services/auction-history";

const actionTypes = new Set([
  "AUCTION_INITIALIZED", "AUCTION_STARTED", "AUCTION_PAUSED", "AUCTION_RESUMED", "AUCTION_COMPLETED",
  "BID_UPDATED", "PLAYER_SOLD", "PLAYER_UNSOLD", "PLAYER_PUT_ON_AUCTION", "ROUND_STARTED", "ROUND_COMPLETED",
  "SALE_REVERSED", "SALE_CORRECTED",
]);

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const genderValue = url.searchParams.get("gender");
    if (genderValue && genderValue !== "male" && genderValue !== "female") {
      return NextResponse.json({ error: "gender must be male or female." }, { status: 400 });
    }
    const action = url.searchParams.get("action") ?? undefined;
    if (action && !actionTypes.has(action)) return NextResponse.json({ error: "Unsupported history action." }, { status: 400 });
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
      return NextResponse.json({ error: "Date filters must be valid dates." }, { status: 400 });
    }
    if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(to ?? "")) toDate.setHours(23, 59, 59, 999);
    const result = await getAuctionHistory({
      tournamentId: url.searchParams.get("tournamentId") ?? undefined,
      auctionId: url.searchParams.get("auctionId") ?? undefined,
      gender: genderValue as "male" | "female" | undefined,
      teamId: url.searchParams.get("teamId") ?? undefined,
      action,
      query: url.searchParams.get("q") ?? undefined,
      from: fromDate,
      to: toDate,
      page: Number.isInteger(page) ? page : 1,
      limit: Number.isInteger(limit) ? limit : 30,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdminApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load auction history." }, { status: 500 });
  }
}