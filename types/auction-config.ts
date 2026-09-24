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
  status: "draft" | "ready";
  createdAt: Date;
  updatedAt: Date;
}

export type AuctionConfigInput = Omit<AuctionConfig, "id" | "createdAt" | "updatedAt">;
