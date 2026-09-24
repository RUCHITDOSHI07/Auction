import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getMongoDb } from "@/lib/mongodb";

export const adminSessionCookie = "pnpl_admin_session";
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;

export type AdminUser = { userId: string; name?: string; role: "admin" };

export class AdminAuthError extends Error {
  readonly status = 401 as const;
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getSessionsCollection() {
  const database = await getMongoDb();
  return database.collection<{ tokenHash: string; userId: string; expiresAt: Date; createdAt: Date; updatedAt: Date }>("adminSessions");
}

export async function createAdminSession(admin: AdminUser) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionLifetimeSeconds * 1000);
  const sessions = await getSessionsCollection();
  await sessions.createIndex({ tokenHash: 1 }, { unique: true, name: "admin_sessions_token_unique" });
  await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "admin_sessions_expiry" });
  await sessions.insertOne({ tokenHash: hashSessionToken(token), userId: admin.userId, expiresAt, createdAt: now, updatedAt: now });
  return { token, expiresAt };
}

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const token = (await cookies()).get(adminSessionCookie)?.value;
  if (!token) return null;
  const sessions = await getSessionsCollection();
  const session = await sessions.findOne({ tokenHash: hashSessionToken(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const database = await getMongoDb();
  return database.collection<AdminUser>("admins").findOne({ userId: session.userId, role: "admin" }, { projection: { _id: 0, userId: 1, name: 1, role: 1 } });
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new AdminAuthError("Authentication is required.");
  return admin;
}

export async function deleteCurrentAdminSession() {
  const token = (await cookies()).get(adminSessionCookie)?.value;
  if (!token) return;
  const sessions = await getSessionsCollection();
  await sessions.deleteOne({ tokenHash: hashSessionToken(token) });
}

export function sessionCookieOptions(expiresAt: Date) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", expires: expiresAt };
}
