import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import {
  markCurrentAuctionPlayerUnsold,
  advanceAuctionToNextPlayer,
  sellCurrentAuctionPlayer,
  startNextAuctionRound,
  submitAuctionBid,
  transitionAuction,
  type AuctionLifecycleAction,
} from "@/lib/services/auctions";

type RouteContext = { params: Promise<{ auctionId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { auctionId } = await context.params;
    const body = await request.json() as { action?: unknown; teamId?: unknown; amount?: unknown; requestId?: unknown; expectedResultEventId?: unknown };
    if (body.action === "bid" || body.action === "bid-next") {
      const room = await submitAuctionBid(auctionId, body.teamId, body.action === "bid-next" ? undefined : body.amount, admin, body.requestId);
      return NextResponse.json({ room });
    }
    if (body.action === "sold") {
      return NextResponse.json({ room: await sellCurrentAuctionPlayer(auctionId, admin) });
    }
    if (body.action === "unsold") {
      return NextResponse.json({ room: await markCurrentAuctionPlayerUnsold(auctionId, admin) });
    }
    if (body.action === "next-player") {
      return NextResponse.json({ room: await advanceAuctionToNextPlayer(
        auctionId,
        admin,
        typeof body.expectedResultEventId === "string" ? body.expectedResultEventId : undefined,
      ) });
    }
    if (body.action === "next-round") {
      return NextResponse.json({ room: await startNextAuctionRound(auctionId, admin) });
    }
    if (body.action !== "start" && body.action !== "pause" && body.action !== "resume" && body.action !== "complete") {
      return NextResponse.json({ error: "Unsupported auction action." }, { status: 400 });
    }
    const room = await transitionAuction(auctionId, body.action as AuctionLifecycleAction, admin);
    return NextResponse.json({ room });
  } catch (error) {
    if (error instanceof AdminApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update auction." },
      { status: 400 },
    );
  }
}