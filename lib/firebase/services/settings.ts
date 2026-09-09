import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { rethrowFirebaseError } from "@/lib/firebase/errors";
import type { AuctionSettings, AuctionSettingsInput } from "@/types/firestore";

const settingsCollection = "settings";
const defaultSettingsId = "default";

export async function getSettings(settingsId = defaultSettingsId): Promise<AuctionSettings | null> {
  try {
    const snapshot = await getDoc(doc(getFirebaseDb(), settingsCollection, settingsId));
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as AuctionSettings) : null;
  } catch (error) {
    return rethrowFirebaseError(`Failed to load settings ${settingsId}`, error);
  }
}

export async function updateSettings(input: AuctionSettingsInput) {
  try {
    const { id, ...settingsData } = input;
    await setDoc(doc(getFirebaseDb(), settingsCollection, id), {
      ...settingsData,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    return rethrowFirebaseError(`Failed to update settings ${input.id}`, error);
  }
}
