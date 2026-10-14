import { NextResponse } from "next/server";
import { getPublicAuction } from "@/lib/services/public-auctions";

type RouteContext = { params: Promise<{ auctionId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { auctionId } = await context.params;
    const result = await getPublicAuction(auctionId, _request.headers.get("if-none-match") ?? undefined);
    if (!result) return NextResponse.json({ error: "Auction not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    if (result.notModified) {
      return new Response(null, {
        status: 304,
        headers: { "Cache-Control": "no-store", ETag: result.etag },
      });
    }
    return NextResponse.json({ auction: result.data }, {
      headers: { "Cache-Control": "no-store", ETag: result.etag },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load public auction." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}