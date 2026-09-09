import { assignAdminClaim } from "../lib/firebase/admin.mjs";

const uid = process.argv[2]?.trim();
if (!uid) {
  console.error("Usage: node scripts/set-admin-claim.mjs <firebase-auth-uid>");
  process.exit(1);
}

try {
  await assignAdminClaim(uid);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to assign admin claim.");
  process.exit(1);
}

console.log(`Assigned admin claim to UID ${uid}. Sign out and sign in again, or force-refresh the ID token.`);
