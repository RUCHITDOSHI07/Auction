import type { Collection, Filter, UpdateFilter } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import type { Player, PlayerInput } from "@/types/firestore";
import { normalizePlayerGender } from "@/lib/players";

export type MongoPlayer = Omit<Player, "createdAt" | "updatedAt"> & {
  createdAt?: Date;
  updatedAt?: Date;
};

type PlayerDocument = MongoPlayer;
type PlayerCounter = { _id: "players"; value: number };

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
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );
}

function normalizePlayerInput(input: PlayerInput) {
  const gender = normalizePlayerGender(input.gender);
  if (!gender) {
    throw new Error(
      `Gender is required for player "${input.name || input.fullName || "unknown"}".`,
    );
  }

  return removeUndefinedFields({
    ...input,
    gender,
    id: undefined,
    playerCode: undefined,
    createdAt: undefined,
    updatedAt: undefined,
  });
}

async function reservePlayerIds(count: number): Promise<string[]> {
  if (count <= 0) return [];

  const database = await getMongoDb();
  const counters = database.collection<PlayerCounter>("counters");

  const sequenceResult = await counters.findOneAndUpdate(
    { _id: "players" },
    { $inc: { value: count } },
    { upsert: true, returnDocument: "after" },
  );

  const sequenceDocument = sequenceResult;

  if (!sequenceDocument) {
    throw new Error("Unable to generate permanent player IDs.");
  }

  const firstId = sequenceDocument.value - count + 1;
  return Array.from({ length: count }, (_, index) =>
    `P${String(firstId + index).padStart(3, "0")}`,
  );
}

function toPlayerChanges(input: PlayerInput, playerId: string) {
  return {
    ...normalizePlayerInput(input),
    id: playerId,
  } as Partial<PlayerDocument> & { id: string };
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
  const [playerId] = await reservePlayerIds(1);
  const now = new Date();

  await collection.insertOne({
    ...toPlayerChanges(input, playerId),
    createdAt: now,
    updatedAt: now,
  } as PlayerDocument);

  return playerId;
}

export async function updatePlayer(
  playerId: string,
  changes: Partial<Omit<Player, "id" | "createdAt" | "updatedAt">>,
) {
  const collection = await getPlayersCollection();
  await ensurePlayerIndex(collection);

  const update = removeUndefinedFields({
    ...changes,
    gender: normalizePlayerGender(changes.gender),
    updatedAt: new Date(),
  });

  const result = await collection.updateOne({ id: playerId }, { $set: update });
  if (result.matchedCount === 0) {
    throw new Error(`Player ${playerId} was not found.`);
  }
}

export async function deletePlayer(playerId: string) {
  const collection = await getPlayersCollection();
  await ensurePlayerIndex(collection);
  const result = await collection.deleteOne({ id: playerId });
  if (result.deletedCount === 0) {
    throw new Error(`Player ${playerId} was not found.`);
  }
}

export async function bulkUpsertPlayers(
  inputs: PlayerInput[],
): Promise<BulkPlayerImportResult> {
  if (inputs.length === 0) {
    return {
      processed: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      duplicateRows: 0,
    };
  }

  const collection = await getPlayersCollection();
  await ensurePlayerIndex(collection);

  const uniqueInputs = new Map<string, PlayerInput>();
  for (const input of inputs) {
    const name = (input.fullName || input.name || "").trim().toLowerCase();
    const phone = (input.phoneNumber || "").trim().replace(/\D/g, "");
    const key = `${name}|${phone}`;

    if (uniqueInputs.has(key)) continue;
    uniqueInputs.set(key, input);
  }

  const duplicateRows = inputs.length - uniqueInputs.size;
  const normalizedInputs = [...uniqueInputs.values()];
  const playerIds = await reservePlayerIds(normalizedInputs.length);

  const operations = normalizedInputs.map((input, index) => {
    const now = new Date();
    const playerId = playerIds[index];

    const update: UpdateFilter<PlayerDocument> = {
      $set: {
        ...toPlayerChanges(input, playerId),
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
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

  return {
    processed: normalizedInputs.length,
    inserted: result.upsertedCount,
    updated: result.modifiedCount,
    unchanged: result.matchedCount - result.modifiedCount,
    duplicateRows,
  };
}
