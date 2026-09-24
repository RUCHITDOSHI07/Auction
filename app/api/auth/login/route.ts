import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { adminSessionCookie, createAdminSession, sessionCookieOptions } from "@/lib/auth/session";
import { getMongoDb } from "@/lib/mongodb";

type AdminDocument = { userId: string; passwordHash: string; name?: string; role: "admin" };

export async function POST(request: Request) {
  try {
    const body = await request.json() as { userId?: unknown; password?: unknown };
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!userId || !password) return NextResponse.json({ error: "User ID and password are required." }, { status: 400 });
    const admin = await (await getMongoDb()).collection<AdminDocument>("admins").findOne({ userId, role: "admin" });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    const session = await createAdminSession({ userId: admin.userId, name: admin.name, role: "admin" });
    const response = NextResponse.json({ authenticated: true, admin: { userId: admin.userId, name: admin.name, role: admin.role } });
    response.cookies.set(adminSessionCookie, session.token, sessionCookieOptions(session.expiresAt));
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to sign in." }, { status: 500 });
  }
}
