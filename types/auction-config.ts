import type { CompetitionGender } from "@/types/tournament";

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
  | "lastActionEventId"
  | "lastSaleEventId"
  | "initializedAt"
  | "completedAt"
  | "createdAt"
  | "updatedAt"
>;
