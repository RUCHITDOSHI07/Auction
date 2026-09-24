import { NextResponse } from "next/server";

import { getMongoDb } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const database = await getMongoDb();
    await database.command({ ping: 1 });

    return NextResponse.json({ connected: true });
  } catch {
    return NextResponse.json({ connected: false }, { status: 503 });
  }
}