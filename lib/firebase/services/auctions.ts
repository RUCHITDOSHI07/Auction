import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { rethrowFirebaseError } from "@/lib/firebase/errors";
import type { Auction, AuctionInput } from "@/types/firestore";

const auctionsCollection = "auctions";

function toAuction(id: string, data: Record<string, unknown>) {
  return { id, ...data } as Auction;
}

export async function getAuctions(): Promise<Auction[]> {
  try {
    const snapshot = await getDocs(collection(getFirebaseDb(), auctionsCollection));
    return snapshot.docs.map((item) => toAuction(item.id, item.data()));
  } catch (error) {
    return rethrowFirebaseError("Failed to load auctions", error);
  }
}

export async function getAuction(auctionId: string): Promise<Auction | null> {
  try {
    const snapshot = await getDoc(doc(getFirebaseDb(), auctionsCollection, auctionId));
    return snapshot.exists() ? toAuction(snapshot.id, snapshot.data()) : null;
  } catch (error) {
    return rethrowFirebaseError(`Failed to load auction ${auctionId}`, error);
  }
}

export async function createAuction(input: AuctionInput): Promise<string> {
  try {
    const database = getFirebaseDb();
    const auctionId = input.id ?? doc(collection(database, auctionsCollection)).id;
    const auctionData = { ...input };
    delete auctionData.id;
    await setDoc(doc(database, auctionsCollection, auctionId), {
      ...auctionData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return auctionId;
  } catch (error) {
    return rethrowFirebaseError("Failed to create auction", error);
  }
}

export async function updateAuction(auctionId: string, changes: Partial<Omit<Auction, "id" | "createdAt" | "updatedAt">>) {
  try {
    await updateDoc(doc(getFirebaseDb(), auctionsCollection, auctionId), {
      ...changes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    return rethrowFirebaseError(`Failed to update auction ${auctionId}`, error);
  }
}

export async function deleteAuction(auctionId: string) {
  try {
    await deleteDoc(doc(getFirebaseDb(), auctionsCollection, auctionId));
  } catch (error) {
    return rethrowFirebaseError(`Failed to delete auction ${auctionId}`, error);
  }
}
