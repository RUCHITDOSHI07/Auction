import type { CompetitionGender } from "@/types/tournament";

export type TeamStatus = "active" | "inactive";

export interface Team {
  id: string;
  tournamentId: string;
  gender: CompetitionGender;
  name: string;
  shortName: string;
  ownerName?: string;
  logoUrl?: string;
  totalBudget: number;
  remainingBudget: number;
  squadSize: number;
  playersCount: number;
  status: TeamStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type TeamInput = {
  tournamentId: string;
  gender: CompetitionGender;
  name: string;
  shortName: string;
  ownerName?: string;
  logoUrl?: string;
  totalBudget: number;
  squadSize: number;
};
