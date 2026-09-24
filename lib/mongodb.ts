import { MongoClient, type Db } from "mongodb";

const databaseName = "pnpl-auction";

declare global {
  var mongoClientPromise: Promise<MongoClient> | undefined;
}

function getMongoClientPromise() {
  if (globalThis.mongoClientPromise) {
    return globalThis.mongoClientPromise;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  const clientPromise = new MongoClient(uri).connect();

  if (process.env.NODE_ENV !== "production") {
    globalThis.mongoClientPromise = clientPromise;
  }

  return clientPromise;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClientPromise();
  return client.db(databaseName);
}