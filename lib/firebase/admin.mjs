import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getAdminCredentials() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, or FIREBASE_ADMIN_PRIVATE_KEY.");
  }

  return { projectId, clientEmail, privateKey };
}

export function getFirebaseAdminAuth() {
  const app = getApps()[0] ?? initializeApp({ credential: cert(getAdminCredentials()) });
  return getAuth(app);
}

export async function assignAdminClaim(uid) {
  if (!uid?.trim()) throw new Error("A Firebase Auth UID is required.");

  const auth = getFirebaseAdminAuth();
  const user = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, { ...user.customClaims, admin: true });
}