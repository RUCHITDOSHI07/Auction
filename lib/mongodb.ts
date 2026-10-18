import "server-only";

import { MongoClient, type Db } from "mongodb";
import { resolveMongoDatabaseName } from "@/lib/mongodb-config.mjs";

declare global {
  var mongoClientPromise: Promise<MongoClient> | undefined;
}

function readPoolSetting(name: string, fallback: number, minimum: number, maximum: number) {
  const configured = process.env[name];
  if (configured === undefined || configured.trim() === "") return fallback;

  const value = Number(configured);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function getMongoClientPromise() {
  if (globalThis.mongoClientPromise) {
    return globalThis.mongoClientPromise;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  const maxPoolSize = readPoolSetting("MONGODB_MAX_POOL_SIZE", 5, 1, 10);
  const maxConnecting = readPoolSetting("MONGODB_MAX_CONNECTING", 2, 1, 5);
  const waitQueueTimeoutMS = readPoolSetting("MONGODB_WAIT_QUEUE_TIMEOUT_MS", 5000, 1000, 30000);
  if (maxConnecting > maxPoolSize) {
    throw new Error("MONGODB_MAX_CONNECTING cannot exceed MONGODB_MAX_POOL_SIZE.");
  }

  const client = new MongoClient(uri, {
    maxPoolSize,
    minPoolSize: 0,
    maxConnecting,
    waitQueueTimeoutMS,
  });
  const clientPromise = client.connect();
  globalThis.mongoClientPromise = clientPromise;

  void clientPromise.catch(async () => {
    if (globalThis.mongoClientPromise === clientPromise) {
      globalThis.mongoClientPromise = undefined;
    }
    await client.close().catch(() => undefined);
  });

  return clientPromise;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClientPromise();
  return client.db(resolveMongoDatabaseName());
}