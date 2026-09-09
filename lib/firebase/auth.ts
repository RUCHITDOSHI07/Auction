"use client";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

export async function signInWithEmailPassword(email: string, password: string) {
  const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  const token = await result.user.getIdTokenResult(true);
  if (token.claims.admin !== true) {
    await signOut(getFirebaseAuth());
    throw new Error("This account does not have the Firebase admin claim.");
  }
  return { user: result.user, claims: token.claims };
}

export function subscribeToAuthState(listener: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(getFirebaseAuth(), listener);
}

export async function refreshAuthenticatedUserToken(user: User | null = getFirebaseAuth().currentUser) {
  if (!user) throw new Error("No authenticated Firebase user is available.");
  return user.getIdToken(true);
}

export async function refreshAuthenticatedUserClaims(user: User | null = getFirebaseAuth().currentUser) {
  if (!user) throw new Error("No authenticated Firebase user is available.");
  const token = await user.getIdTokenResult(true);
  return token.claims;
}

export async function getAuthenticatedUserToken() {
  const user = getFirebaseAuth().currentUser;
  return user ? user.getIdToken() : null;
}
