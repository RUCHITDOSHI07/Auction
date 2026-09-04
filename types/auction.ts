export type AuctionType = "men" | "women";
export type AuctionStatus = "NOT_STARTED" | "READY" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";
export type PlayerStatus = "AVAILABLE" | "ON_AUCTION" | "SOLD" | "UNSOLD";

export interface Team {
  id: string;
  name: string;
  shortName: string;
  color: string;
  purse: number;
  squadCount: number;
  squadSize: number;
  status: "Active" | "Complete";
  players: string[];
}

export interface Player {
  id: string;
  name: string;
  initials: string;
  role: string;
  category: string;
  age: number;
  basePrice: number;
  status: PlayerStatus;
  teamId?: string;
  soldPrice?: number;
  batting: string;
  bowling: string;
  accent: string;
}

export interface Bid {
  id: string;
  teamId: string;
  amount: number;
  time: string;
}

export interface Auction {
  id: string;
  type: AuctionType;
  name: string;
  status: AuctionStatus;
  round: number;
  currentPlayerId: string;
  currentBid: number;
  highestTeamId: string;
  bidIncrement: number;
  startingPurse: number;
  squadSize: number;
  totalPlayers: number;
  soldPlayers: number;
  unsoldPlayers: number;
}

export interface Activity {
  id: string;
  label: string;
  detail: string;
  time: string;
  tone: "lime" | "orange" | "blue";
}
