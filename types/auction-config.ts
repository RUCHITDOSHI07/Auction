import type { CompetitionGender } from "@/types/tournament";

export interface AuctionResultSnapshot {
  eventId: string;
  outcome: "sold" | "unsold";
  playerId: string;
  playerName: string;
  playerInitials: string;
  playerPhotoUrl?: string;
  teamId?: string;
  teamName?: string;
  teamShortName?: string;
  amount?: number;
  createdAt: Date;
  displayUntil: Date;
}

export interface AuctionConfig {
  id: string;
  tournamentId: string;
  gender: CompetitionGender;
  teamIds: string[];
  pursePerTeam: number;
  minimumSquadSize: number;
  maximumSquadSize: number;
  bidIncrement: number;
  status: "draft" | "ready" | "live" | "paused" | "completed";
  currentRound?: number;
  roundPlayerIds?: string[];
  roundStatus?: "not_started" | "in_progress" | "complete";
  playerPoolIds?: string[];
  currentPlayerId?: string;
  currentBid?: number;
  highestTeamId?: string;
  awaitingAdvance?: boolean;
  lastResult?: AuctionResultSnapshot;
  lastActionEventId?: string;
  lastSaleEventId?: string;
  initializedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type AuctionConfigInput = Omit<
  AuctionConfig,
  | "id"
  | "status"
  | "currentRound"
  | "roundPlayerIds"
  | "roundStatus"
  | "playerPoolIds"
  | "currentPlayerId"
  | "currentBid"
  | "highestTeamId"
  | "awaitingAdvance"
  | "lastResult"
  | "lastActionEventId"
  | "lastSaleEventId"
  | "initializedAt"
  | "completedAt"
  | "createdAt"
  | "updatedAt"
>;
