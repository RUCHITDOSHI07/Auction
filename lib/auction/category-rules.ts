import type {
  TournamentCategoryPrices,
  TournamentPlayerCategory,
} from "@/types/tournament";

export const DEFAULT_TOURNAMENT_CATEGORY_PRICES: TournamentCategoryPrices = {
  A: 50000,
  B: 40000,
  C: 30000,
  General: 1000,
};

export const MAX_PREMIUM_PLAYERS_PER_TEAM = 2 as const;

export function normalizeTournamentPlayerCategory(
  value: unknown,
): TournamentPlayerCategory | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "a") return "A";
  if (normalized === "b") return "B";
  if (normalized === "c") return "C";
  if (normalized === "general") return "General";
  return null;
}

export function isPremiumPlayerCategory(value: unknown): boolean {
  const category = normalizeTournamentPlayerCategory(value);
  return category === "A" || category === "B" || category === "C";
}

export function canAddPremiumPlayer(
  category: unknown,
  currentPremiumPlayers: number,
  limit: number = MAX_PREMIUM_PLAYERS_PER_TEAM,
): boolean {
  return !isPremiumPlayerCategory(category) || currentPremiumPlayers < limit;
}

export function getTournamentCategoryBasePrice(
  category: unknown,
  prices: TournamentCategoryPrices,
): number {
  const normalized = normalizeTournamentPlayerCategory(category);
  if (!normalized) throw new Error("Player category must be A, B, C, or General.");
  return prices[normalized];
}
