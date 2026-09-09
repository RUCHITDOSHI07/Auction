import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { rethrowFirebaseError } from "@/lib/firebase/errors";
import type { User, UserInput } from "@/types/firestore";

const usersCollection = "users";

export async function getUserProfile(uid: string): Promise<User | null> {
  try {
    const snapshot = await getDoc(doc(getFirebaseDb(), usersCollection, uid));
    return snapshot.exists() ? ({ uid: snapshot.id, ...snapshot.data() } as User) : null;
  } catch (error) {
    return rethrowFirebaseError(`Failed to load user profile ${uid}`, error);
  }
}

export async function createUserProfile(input: UserInput) {
  try {
    await setDoc(doc(getFirebaseDb(), usersCollection, input.uid), {
      ...input,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    return rethrowFirebaseError(`Failed to create user profile ${input.uid}`, error);
  }
}
