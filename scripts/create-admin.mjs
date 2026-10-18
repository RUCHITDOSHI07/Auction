import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";

const userId = process.env.ADMIN_USER_ID?.trim();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || undefined;

if (!userId || !password) {
  console.error("Set ADMIN_USER_ID and ADMIN_PASSWORD before running this script.");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI ?? "");
try {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured.");
  await client.connect();
  const collection = client.db("pnpl-auction").collection("admins");
  await collection.createIndex({ userId: 1 }, { unique: true, name: "admins_user_id_unique" });
  const existing = await collection.findOne({ userId });
  if (existing) throw new Error(`Admin '${userId}' already exists; no password was changed.`);
  const now = new Date();
  await collection.insertOne({ userId, passwordHash: await bcrypt.hash(password, 12), ...(name ? { name } : {}), role: "admin", createdAt: now, updatedAt: now });
  console.log(`Created admin '${userId}'.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to create admin.");
  process.exitCode = 1;
} finally {
  await client.close();
}
