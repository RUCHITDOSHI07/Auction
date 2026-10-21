export type CompetitionGender = "male" | "female";
export type TournamentStatus = "draft" | "active" | "completed" | "archived";

export type TournamentPlayerCategory = "A" | "B" | "C" | "General";

export interface TournamentCategoryPrices {
  A: number;
  B: number;
  C: number;
  General: number;
}

export interface TournamentCategoryRules {
  enabled: boolean;
  basePrices: TournamentCategoryPrices;
  generalIconPrice: number;
  maxPremiumPlayersPerTeam: 2;
}

export interface TournamentCompetition {
  enabled: boolean;
  categoryRules?: TournamentCategoryRules;
}

export interface Tournament {
  id: string;
  name: string;
  season: number;
  description?: string;
  status: TournamentStatus;
  competitions: {
    male: TournamentCompetition;
    female: TournamentCompetition;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type TournamentInput = {
  name: string;
  season: number;
  description?: string;
  competitions: {
    male: boolean;
    female: boolean;
  };
  categoryRules?: Record<CompetitionGender, TournamentCategoryRules>;
};
