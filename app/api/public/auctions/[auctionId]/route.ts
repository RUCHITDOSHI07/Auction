import { NextResponse } from "next/server";
import { getPublicAuction } from "@/lib/services/public-auctions";

type RouteContext = { params: Promise<{ auctionId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { auctionId } = await context.params;
    const auction = await getPublicAuction(auctionId);
    if (!auction) return NextResponse.json({ error: "Auction not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ auction }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load public auction." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}