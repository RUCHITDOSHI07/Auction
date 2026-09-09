import type { Timestamp } from "firebase/firestore";

export type FirestorePlayerStatus = "available" | "on_auction" | "sold" | "unsold";
export type FirestoreAuctionStatus = "upcoming" | "live" | "paused" | "completed";
export type UserRole = "admin" | "viewer";

export interface Player {
  id: string;
  playerCode?: string;
  name: string;
  fullName?: string;
  category: string;
  role: string;
  age?: number;
  dateOfBirth?: string;
  wingFlatNumber?: string;
  phoneNumber?: string;
  photoUrl?: string;
  battingStyle?: string;
  bowlingStyle?: string;
  batting?: string;
  bowling?: string;
  basePrice: number;
  status: FirestorePlayerStatus;
  soldTo?: string;
  teamId?: string;
  soldPrice?: number;
  soldRound?: number;
  isSold: boolean;
  initials?: string;
  accent?: string;
  instagramId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logoUrl?: string;
  color?: string;
  ownerName?: string;
  totalBudget: number;
  remainingBudget: number;
  playersCount: number;
  squadCount?: number;
  squadSize: number;
  status?: "Active" | "Complete";
  playerIds?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Auction {
  id: string;
  type?: "men" | "women";
  name: string;
  status: FirestoreAuctionStatus;
  currentPlayerId?: string;
  currentBid: number;
  currentTeamId?: string;
  highestTeamId?: string;
  bidIncrement: number;
  startingPurse: number;
  squadSize: number;
  round: number;
  totalPlayers?: number;
  soldPlayers?: number;
  unsoldPlayers?: number;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AuctionResult {
  id: string;
  auctionId: string;
  playerId: string;
  playerName: string;
  teamId?: string;
  teamName?: string;
  soldPrice?: number;
  status: "sold" | "unsold";
  timestamp: Timestamp;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  createdAt: Timestamp;
}

export interface AuctionSettings {
  id: string;
  auctionName: string;
  defaultBudget: number;
  minimumBidIncrement: number;
  minimumSquadSize: number;
  maximumSquadSize: number;
  auctionStatus: FirestoreAuctionStatus;
  updatedAt: Timestamp;
}

export type PlayerInput = Omit<Player, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};
export type TeamInput = Omit<Team, "id" | "createdAt" | "updatedAt"> & { id?: string };
export type AuctionInput = Omit<Auction, "id" | "createdAt" | "updatedAt"> & { id?: string };
export type AuctionResultInput = Omit<AuctionResult, "id" | "timestamp"> & { id?: string };
export type UserInput = Omit<User, "createdAt">;
export type AuctionSettingsInput = Omit<AuctionSettings, "updatedAt">;
