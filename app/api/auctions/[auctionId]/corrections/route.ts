import { NextResponse } from "next/server";
import { AdminApiError, requireAdmin } from "@/lib/auth/admin-api";
import { correctLatestAuctionSale, previewLatestSaleCorrection, undoLatestAuctionSale } from "@/lib/services/auctions";

type RouteContext = { params: Promise<{ auctionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { auctionId } = await context.params;
    const saleEventId = new URL(request.url).searchParams.get("saleEventId") ?? "";
    if (!saleEventId) return NextResponse.json({ error: "saleEventId is required." }, { status: 400 });
    return NextResponse.json({ preview: await previewLatestSaleCorrection(auctionId, saleEventId) });
  } catch (error) {
    if (error instanceof AdminApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to preview sale correction." }, { status: 400 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { auctionId } = await context.params;
    const body = await request.json() as {
      action?: unknown;
      saleEventId?: unknown;
      teamId?: unknown;
      amount?: unknown;
      reason?: unknown;
      requestId?: unknown;
    };
    if (body.action === "undo") {
      return NextResponse.json({ room: await undoLatestAuctionSale(auctionId, body.saleEventId, admin, typeof body.requestId === "string" ? body.requestId : undefined) });
    }
    if (body.action === "correct") {
      return NextResponse.json({ room: await correctLatestAuctionSale(auctionId, body, admin) });
    }
    return NextResponse.json({ error: "Correction action must be undo or correct." }, { status: 400 });
  } catch (error) {
    if (error instanceof AdminApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to correct sale." }, { status: 400 });
  }
}