import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { rethrowFirebaseError } from "@/lib/firebase/errors";
import type { Player, PlayerInput } from "@/types/firestore";

const playersCollection = "players";

function removeUndefinedFields(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function toPlayer(id: string, data: Record<string, unknown>) {
  return { id, ...data } as Player;
}

export async function getPlayers(): Promise<Player[]> {
  try {
    const snapshot = await getDocs(collection(getFirebaseDb(), playersCollection));
    return snapshot.docs.map((item) => toPlayer(item.id, item.data()));
  } catch (error) {
    return rethrowFirebaseError("Failed to load players", error);
  }
}

export async function getPlayerById(playerId: string): Promise<Player | null> {
  try {
    const snapshot = await getDoc(doc(getFirebaseDb(), playersCollection, playerId));
    return snapshot.exists() ? toPlayer(snapshot.id, snapshot.data()) : null;
  } catch (error) {
    return rethrowFirebaseError(`Failed to load player ${playerId}`, error);
  }
}

export async function createPlayer(input: PlayerInput): Promise<string> {
  try {
    const database = getFirebaseDb();
    const playerId = input.id ?? input.playerCode ?? doc(collection(database, playersCollection)).id;
    const playerData = removeUndefinedFields({ ...input });
    delete playerData.id;
    await setDoc(doc(database, playersCollection, playerId), {
      ...playerData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return playerId;
  } catch (error) {
    return rethrowFirebaseError("Failed to create player", error);
  }
}

export async function upsertPlayer(input: PlayerInput): Promise<string> {
  try {
    const database = getFirebaseDb();
    const playerId = input.id ?? input.playerCode ?? doc(collection(database, playersCollection)).id;
    const playerData = removeUndefinedFields({ ...input });
    delete playerData.id;
    const existingPlayer = await getDoc(doc(database, playersCollection, playerId));
    await setDoc(doc(database, playersCollection, playerId), {
      ...playerData,
      ...(existingPlayer.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return playerId;
  } catch (error) {
    return rethrowFirebaseError("Failed to upsert player", error);
  }
}

export async function upsertPlayers(inputs: PlayerInput[]): Promise<number> {
  if (inputs.length === 0) return 0;

  try {
    const database = getFirebaseDb();
    const playerIds = inputs.map((input) => input.id ?? input.playerCode ?? doc(collection(database, playersCollection)).id);

    const batch = writeBatch(database);
    inputs.forEach((input, index) => {
      const playerId = playerIds[index];
      const playerData = removeUndefinedFields({ ...input });
      delete playerData.id;
      batch.set(doc(database, playersCollection, playerId), {
        ...playerData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });

    await batch.commit();
    return inputs.length;
  } catch (error) {
    return rethrowFirebaseError(`Failed to batch upsert ${inputs.length} players`, error);
  }
}

export async function updatePlayer(playerId: string, changes: Partial<Omit<Player, "id" | "createdAt" | "updatedAt">>) {
  try {
    await updateDoc(doc(getFirebaseDb(), playersCollection, playerId), {
      ...changes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    return rethrowFirebaseError(`Failed to update player ${playerId}`, error);
  }
}

export async function deletePlayer(playerId: string) {
  try {
    await deleteDoc(doc(getFirebaseDb(), playersCollection, playerId));
  } catch (error) {
    return rethrowFirebaseError(`Failed to delete player ${playerId}`, error);
  }
}
