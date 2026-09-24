export type CompetitionGender = "male" | "female";
export type TournamentStatus = "draft" | "active" | "completed" | "archived";

export interface TournamentCompetition {
  enabled: boolean;
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
};
