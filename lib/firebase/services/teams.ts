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
import type { Team, TeamInput } from "@/types/firestore";

const teamsCollection = "teams";

function toTeam(id: string, data: Record<string, unknown>) {
  return { id, ...data } as Team;
}

export async function getTeams(): Promise<Team[]> {
  try {
    const snapshot = await getDocs(collection(getFirebaseDb(), teamsCollection));
    return snapshot.docs.map((item) => toTeam(item.id, item.data()));
  } catch (error) {
    return rethrowFirebaseError("Failed to load teams", error);
  }
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  try {
    const snapshot = await getDoc(doc(getFirebaseDb(), teamsCollection, teamId));
    return snapshot.exists() ? toTeam(snapshot.id, snapshot.data()) : null;
  } catch (error) {
    return rethrowFirebaseError(`Failed to load team ${teamId}`, error);
  }
}

export async function createTeam(input: TeamInput): Promise<string> {
  try {
    const database = getFirebaseDb();
    const teamId = input.id ?? doc(collection(database, teamsCollection)).id;
    const teamData = { ...input };
    delete teamData.id;
    await setDoc(doc(database, teamsCollection, teamId), {
      ...teamData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return teamId;
  } catch (error) {
    return rethrowFirebaseError("Failed to create team", error);
  }
}

export async function updateTeam(teamId: string, changes: Partial<Omit<Team, "id" | "createdAt" | "updatedAt">>) {
  try {
    await updateDoc(doc(getFirebaseDb(), teamsCollection, teamId), {
      ...changes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    return rethrowFirebaseError(`Failed to update team ${teamId}`, error);
  }
}

export async function deleteTeam(teamId: string) {
  try {
    await deleteDoc(doc(getFirebaseDb(), teamsCollection, teamId));
  } catch (error) {
    return rethrowFirebaseError(`Failed to delete team ${teamId}`, error);
  }
}
