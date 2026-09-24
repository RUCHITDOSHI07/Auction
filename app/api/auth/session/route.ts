import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/session";

export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    return admin ? NextResponse.json({ authenticated: true, admin }) : NextResponse.json({ authenticated: false }, { status: 401 });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
