import { NextResponse } from "next/server";
import { adminSessionCookie, deleteCurrentAdminSession } from "@/lib/auth/session";

export async function POST() {
  try {
    await deleteCurrentAdminSession();
  } finally {
    const response = NextResponse.json({ loggedOut: true });
    response.cookies.set(adminSessionCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  }
}
