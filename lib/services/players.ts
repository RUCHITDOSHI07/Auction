import type { Collection, Filter, UpdateFilter } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import type { Player, PlayerInput } from "@/types/firestore";
import { normalizePlayerGender } from "@/lib/players";

export type MongoPlayer = Omit<Player, "createdAt" | "updatedAt"> & {
  createdAt?: Date;
  updatedAt?: Date;
};

type PlayerDocument = MongoPlayer;

export type BulkPlayerImportResult = {
  processed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  duplicateRows: number;
};

let playerIndexPromise: Promise<string> | undefined;

async function getPlayersCollection(): Promise<Collection<PlayerDocument>> {
  const database = await getMongoDb();
  return database.collection<PlayerDocument>("players");
}

async function ensurePlayerIndex(collection: Collection<PlayerDocument>) {
  playerIndexPromise ??= collection.createIndex(
    { id: 1 },
    {
      name: "players_id_unique",
      unique: true,
      partialFilterExpression: { id: { $type: "string" } },
    },
  );
  await playerIndexPromise;
}

function toPlayer(document: PlayerDocument & { _id?: unknown }): MongoPlayer {
  const player = { ...document };
  delete player._id;
  return player;
}

function removeUndefinedFields(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function getStablePlayerId(input: PlayerInput) {
  const playerId = input.id ?? input.playerCode;
  if (!playerId?.trim()) {
    throw new Error("Each player must have a stable id or playerCode.");
  }
  return playerId.trim();
}

function toPlayerChanges(input: PlayerInput, playerId: string) {
  const changes = removeUndefinedFields({ ...input, id: playerId, gender: normalizePlayerGender(input.gender) });
  delete changes.createdAt;
  delete changes.updatedAt;
  return changes as Partial<PlayerDocument> & { id: string };
}

export async function getPlayers(): Promise<MongoPlayer[]> {
  const collection = await getPlayersCollection();
  await ensurePlayerIndex(collection);
  const documents = await collection.find({}).sort({ name: 1 }).toArray();
  return documents.map(toPlayer);
}

export async function getPlayerById(playerId: string): Promise<MongoPlayer | null> {
  const collection = await getPlayersCollection();
  await ensurePlayerIndex(collection);
  const document = await collection.findOne({ id: playerId });
  return document ? toPlayer(document) : null;
}

export async function createPlayer(input: PlayerInput): Promise<string> {
  const collection = await getPlayersCollection();
  await ensurePlayerIndex(collection);
  const playerId = getStablePlayerId(input);
  const now = new Date();
  await collection.insertOne({
    ...toPlayerChanges(input, playerId),
    createdAt: now,
    updatedAt: now,
  } as PlayerDocument);
  return playerId;
}

export async function updatePlayer(playerId: string, changes: Partial<Omit<Player, "id" | "createdAt" | "updatedAt">>) {
  const collection = await getPlayersCollection();
  await ensurePlayerIndex(collection);
  const update = removeUndefinedFields({ ...changes, gender: normalizePlayerGender(changes.gender), updatedAt: new Date() });
  const result = await collection.updateOne({ id: playerId }, { $set: update });
  if (result.matchedCount === 0) throw new Error(`Player ${playerId} was not found.`);
}

export async function deletePlayer(playerId: string) {
  const collection = await getPlayersCollection();
  await ensurePlayerIndex(collection);
  const result = await collection.deleteOne({ id: playerId });
  if (result.deletedCount === 0) throw new Error(`Player ${playerId} was not found.`);
}

export async function bulkUpsertPlayers(inputs: PlayerInput[]): Promise<BulkPlayerImportResult> {
  if (inputs.length === 0) {
    return { processed: 0, inserted: 0, updated: 0, unchanged: 0, duplicateRows: 0 };
  }

  const collection = await getPlayersCollection();
  await ensurePlayerIndex(collection);
  const uniqueInputs = new Map<string, PlayerInput>();

  for (const input of inputs) {
    uniqueInputs.set(getStablePlayerId(input), input);
  }

  const operations = [...uniqueInputs.entries()].map(([playerId, input]) => {
    const now = new Date();
    const update: UpdateFilter<PlayerDocument> = {
      $set: { ...toPlayerChanges(input, playerId), updatedAt: now },
      $setOnInsert: { createdAt: now },
    };
    return {
      updateOne: {
        filter: { id: playerId } as Filter<PlayerDocument>,
        update,
        upsert: true,
      },
    };
  });

  const result = await collection.bulkWrite(operations, { ordered: false });
  const inserted = result.upsertedCount;
  const updated = result.modifiedCount;
  const unchanged = result.matchedCount - updated;

  return {
    processed: uniqueInputs.size,
    inserted,
    updated,
    unchanged,
    duplicateRows: inputs.length - uniqueInputs.size,
  };
}