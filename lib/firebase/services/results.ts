import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { rethrowFirebaseError } from "@/lib/firebase/errors";
import type { AuctionResult, AuctionResultInput } from "@/types/firestore";

const resultsCollection = "auctionResults";

function toAuctionResult(id: string, data: Record<string, unknown>) {
  return { id, ...data } as AuctionResult;
}

export async function getAuctionResults(auctionId?: string): Promise<AuctionResult[]> {
  try {
    const resultsReference = collection(getFirebaseDb(), resultsCollection);
    const snapshot = await getDocs(auctionId ? query(resultsReference, where("auctionId", "==", auctionId)) : resultsReference);
    return snapshot.docs.map((item) => toAuctionResult(item.id, item.data()));
  } catch (error) {
    return rethrowFirebaseError("Failed to load auction results", error);
  }
}

export async function getAuctionResultById(resultId: string): Promise<AuctionResult | null> {
  try {
    const snapshot = await getDoc(doc(getFirebaseDb(), resultsCollection, resultId));
    return snapshot.exists() ? toAuctionResult(snapshot.id, snapshot.data()) : null;
  } catch (error) {
    return rethrowFirebaseError(`Failed to load auction result ${resultId}`, error);
  }
}

export async function createAuctionResult(input: AuctionResultInput): Promise<string> {
  try {
    const database = getFirebaseDb();
    if (input.id) {
      const resultData = { ...input };
      delete resultData.id;
      await setDoc(doc(database, resultsCollection, input.id), {
        ...resultData,
        timestamp: serverTimestamp(),
      });
      return input.id;
    }

    const result = await addDoc(collection(database, resultsCollection), {
      ...input,
      timestamp: serverTimestamp(),
    });
    return result.id;
  } catch (error) {
    return rethrowFirebaseError("Failed to create auction result", error);
  }
}
