import { NextResponse } from "next/server";
import { getPublicAuctions } from "@/lib/services/public-auctions";

export async function GET() {
  try {
    return NextResponse.json({ auctions: await getPublicAuctions() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load public auctions." }, { status: 503 });
  }
}