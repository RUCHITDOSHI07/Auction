import type { Collection } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { publicPlayerAuctionFilter, publicRevisionUpdate } from "@/lib/auction/public-cache";
import type { Player, PlayerInput } from "@/types/firestore";
import { normalizePlayerGender } from "@/lib/players";
import { excludeAuctionStateFromPlayerImport, findPlayerIdentityMatch, playerImportIdentity, playerImportName } from "@/lib/players/import-identity";
import { downloadGoogleDriveImage } from "@/lib/storage/google-drive";
import { cloudinaryPublicIdFromUrl, isCloudinaryImageUrl, isManagedCloudinaryPublicId } from "@/lib/storage/image-url";
import { deleteImage, uploadImage } from "@/lib/storage/cloudinary";
import { createUniqueImagePublicId } from "@/lib/storage/cloudinary-core";

export type MongoPlayer = Omit<Player, "createdAt" | "updatedAt"> & {
  createdAt?: Date;
  updatedAt?: Date;
};

type PlayerDocument = MongoPlayer;
type PlayerCounter = { _id: "players"; value: number };
type ImportCandidate = {
  identity: string;
  input: PlayerInput;
  existing?: PlayerDocument;
  failure?: string;
};

export type BulkPlayerImportResult = {
  processed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  duplicateRows: number;
  imagesUploaded: number;
  imagesUpdated: number;
  imagesSkipped: number;
  imageFailures: { playerName: string; reason: string }[];
  rowFailures: { playerName: string; reason: string }[];
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

async function reservePlayerIds(count: number, highestExistingId = 0): Promise<string[]> {
  if (count <= 0) return [];

  const database = await getMongoDb();
  const counters = database.collection<PlayerCounter>("counters");

  const sequenceDocument = await counters.findOneAndUpdate(
    { _id: "players" },
    [{
      $set: {
        value: {
          $add: [
            { $max: [{ $ifNull: ["$value", 0] }, highestExistingId] },
            count,
          ],
        },
      },
    }],
    { upsert: true, returnDocument: "after" },
  );

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

function playerName(input: PlayerInput) {
  return (input.fullName || input.name || "Unnamed player").trim();
}

async function resolveImportedPhoto(sourceUrl: string, playerId: string) {
  if (isCloudinaryImageUrl(sourceUrl)) {
    const publicId = cloudinaryPublicIdFromUrl(sourceUrl, process.env.CLOUDINARY_CLOUD_NAME);
    const managedPlayerPrefix = `pnpl/players/${playerId}`;
    return {
      photoUrl: sourceUrl,
      cloudinaryPublicId: publicId === managedPlayerPrefix || publicId?.startsWith(`${managedPlayerPrefix}-`)
        ? publicId
        : undefined,
      uploaded: false,
    };
  }
  const { bytes, contentType } = await downloadGoogleDriveImage(sourceUrl);
  const uploaded = await uploadImage(
    bytes,
    createUniqueImagePublicId(`pnpl/players/${playerId}`),
    contentType,
  );
  return { ...uploaded, uploaded: true };
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
  await (await getMongoDb()).collection("auctions").updateMany(
    publicPlayerAuctionFilter(playerId),
    publicRevisionUpdate("publicPlayerRevision"),
  );
}

export async function removePlayerImage(playerId: string) {
  const result = await updatePlayerImageReference(playerId, null);
  return result.warning;
}

export async function updatePlayerImageReference(
  playerId: string,
  image: { photoUrl: string; cloudinaryPublicId: string } | null,
) {
  const collection = await getPlayersCollection();
  await ensurePlayerIndex(collection);
  const result = await collection.updateOne({ id: playerId }, {
    ...(image
      ? { $set: { ...image, updatedAt: new Date() } }
      : { $unset: { photoUrl: "", cloudinaryPublicId: "" }, $set: { updatedAt: new Date() } }),
  });
  if (result.matchedCount === 0) throw new Error(`Player ${playerId} was not found.`);
  try {
    await (await getMongoDb()).collection("auctions").updateMany(
      publicPlayerAuctionFilter(playerId),
      publicRevisionUpdate("publicPlayerRevision"),
    );
    return { warning: undefined };
  } catch (error) {
    return { warning: `Photo reference was saved, but public image caches could not be refreshed: ${error instanceof Error ? error.message : "Cache refresh failed."}` };
  }
}

export async function deletePlayer(playerId: string) {
  const collection = await getPlayersCollection();
  await ensurePlayerIndex(collection);
  const result = await collection.deleteOne({ id: playerId });
  if (result.deletedCount === 0) {
    throw new Error(`Player ${playerId} was not found.`);
  }
  await (await getMongoDb()).collection("auctions").updateMany(
    publicPlayerAuctionFilter(playerId),
    publicRevisionUpdate("publicPlayerRevision"),
  );
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
      imagesUploaded: 0,
      imagesUpdated: 0,
      imagesSkipped: 0,
      imageFailures: [],
      rowFailures: [],
    };
  }

  const unnamedInputs = inputs.filter((input) => !playerImportName(input));
  const validInputs = inputs.filter((input) => playerImportName(input));
  const invalidNameFailures = unnamedInputs.map(() => ({
    playerName: "Unnamed player",
    reason: "Full Name is required.",
  }));
  if (validInputs.length === 0) {
    return {
      processed: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      duplicateRows: 0,
      imagesUploaded: 0,
      imagesUpdated: 0,
      imagesSkipped: 0,
      imageFailures: [],
      rowFailures: invalidNameFailures,
    };
  }

  const collection = await getPlayersCollection();
  await ensurePlayerIndex(collection);

  const existingPlayers = await collection.find({}, {
    projection: { id: 1, name: 1, fullName: 1, phoneNumber: 1, gender: 1, photoUrl: 1, cloudinaryPublicId: 1 },
  }).toArray();
  const uniqueInputs = new Map<string, PlayerInput>();
  for (const input of validInputs) {
    const key = playerImportIdentity(input.fullName || input.name, input.phoneNumber, input.gender);

    if (uniqueInputs.has(key)) continue;
    uniqueInputs.set(key, input);
  }

  const duplicateRows = validInputs.length - uniqueInputs.size;
  const candidates: ImportCandidate[] = [...uniqueInputs.entries()].map(([identity, input]) => {
    const match = findPlayerIdentityMatch(input, existingPlayers);
    if (match.ambiguous) return { identity, input, failure: "More than one existing player matches this name or phone number." };
    return { identity, input, existing: match.player };
  });
  const newPlayers = candidates.filter((candidate) => !candidate.failure && !candidate.existing);
  const highestExistingId = existingPlayers.reduce((highest, player) => {
    const match = player.id.match(/^P(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  const reservedIds = await reservePlayerIds(newPlayers.length, highestExistingId);
  let newPlayerIndex = 0;
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let imagesUploaded = 0;
  let imagesUpdated = 0;
  let imagesSkipped = 0;
  const imageFailures: BulkPlayerImportResult["imageFailures"] = [];
  const rowFailures: BulkPlayerImportResult["rowFailures"] = invalidNameFailures;

  for (const candidate of candidates) {
    const name = playerName(candidate.input);
    if (candidate.failure) {
      rowFailures.push({ playerName: name, reason: candidate.failure });
      continue;
    }

    const existing = candidate.existing;
    const playerId = existing?.id ?? reservedIds[newPlayerIndex++];
    if (!playerId) {
      rowFailures.push({ playerName: name, reason: "Unable to assign a permanent Player ID." });
      continue;
    }
    let importedPhoto: Awaited<ReturnType<typeof resolveImportedPhoto>> | undefined;
    const sourceUrl = typeof candidate.input.photoUrl === "string" ? candidate.input.photoUrl.trim() : "";
    if (sourceUrl) {
      try {
        importedPhoto = await resolveImportedPhoto(sourceUrl, playerId);
      } catch (error) {
        imagesSkipped += 1;
        imageFailures.push({
          playerName: name,
          reason: error instanceof Error ? error.message : "Image processing failed.",
        });
      }
    } else {
      imagesSkipped += 1;
    }

    const changes = toPlayerChanges(candidate.input, playerId) as Record<string, unknown>;
    delete changes.photoUrl;
    delete changes.cloudinaryPublicId;
    const playerChanges = existing ? excludeAuctionStateFromPlayerImport(changes) : changes;
    const unset: Record<string, ""> = {};
    if (importedPhoto) {
      playerChanges.photoUrl = importedPhoto.photoUrl;
      if (importedPhoto.cloudinaryPublicId) playerChanges.cloudinaryPublicId = importedPhoto.cloudinaryPublicId;
      else if (existing?.photoUrl !== importedPhoto.photoUrl) unset.cloudinaryPublicId = "";
    }

    const now = new Date();
    let result;
    try {
      result = await collection.updateOne(
        { id: playerId },
        {
          $set: { ...playerChanges, updatedAt: now },
          $setOnInsert: { createdAt: now },
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        },
        { upsert: true },
      );
    } catch (error) {
      if (importedPhoto?.uploaded && importedPhoto.cloudinaryPublicId && importedPhoto.cloudinaryPublicId !== existing?.cloudinaryPublicId) {
        try {
          await deleteImage(importedPhoto.cloudinaryPublicId);
        } catch (cleanupError) {
          console.error("Unable to clean up an image after a failed player import.", cleanupError);
        }
      }
      rowFailures.push({
        playerName: name,
        reason: error instanceof Error ? error.message : "Unable to save this player.",
      });
      continue;
    }

    if (result.upsertedCount) inserted += 1;
    else if (result.modifiedCount) updated += 1;
    else unchanged += 1;

    if (importedPhoto?.uploaded) imagesUploaded += 1;
    if (
      existing &&
      importedPhoto &&
      (existing.photoUrl !== importedPhoto.photoUrl ||
        existing.cloudinaryPublicId !== importedPhoto.cloudinaryPublicId)
    ) imagesUpdated += 1;

    const candidatePublicId = existing?.cloudinaryPublicId ?? cloudinaryPublicIdFromUrl(existing?.photoUrl, process.env.CLOUDINARY_CLOUD_NAME);
    const previousPublicId = isManagedCloudinaryPublicId(candidatePublicId, `pnpl/players/${playerId}`)
      ? candidatePublicId
      : undefined;
    if (
      importedPhoto &&
      existing?.photoUrl !== importedPhoto.photoUrl &&
      previousPublicId &&
      previousPublicId !== importedPhoto.cloudinaryPublicId
    ) {
      try {
        await deleteImage(previousPublicId);
      } catch (error) {
        imageFailures.push({
          playerName: name,
          reason: `The new photo was saved, but the previous Cloudinary image could not be deleted: ${error instanceof Error ? error.message : "Cloudinary delete failed."}`,
        });
      }
    }
    try {
      await (await getMongoDb()).collection("auctions").updateMany(
        publicPlayerAuctionFilter(playerId),
        publicRevisionUpdate("publicPlayerRevision"),
      );
    } catch (error) {
      rowFailures.push({
        playerName: name,
        reason: `Player was saved, but the public image cache could not be refreshed: ${error instanceof Error ? error.message : "Cache refresh failed."}`,
      });
    }
  }

  return {
    processed: inserted + updated + unchanged,
    inserted,
    updated,
    unchanged,
    duplicateRows,
    imagesUploaded,
    imagesUpdated,
    imagesSkipped,
    imageFailures,
    rowFailures,
  };
}
