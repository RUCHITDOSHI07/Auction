export interface TeamAuctionBudgetInput {
  startingPurse: number;
  completedSpend: number;
  playersPurchased: number;
  minimumSquadSize: number;
  maximumSquadSize: number;
  bidIncrement: number;
  currentBid: number;
  basePrice: number;
  hasHighestBidder: boolean;
  isLeadingTeam?: boolean;
  hasCurrentPlayer: boolean;
  remainingPlayerBasePrices: number[];
}

export interface TeamAuctionBudget {
  remainingBudget: number;
  playersPurchased: number;
  playersNeeded: number;
  minimumReserve: number;
  maximumAffordableBid: number;
  minimumNextBid: number;
  canAddPlayer: boolean;
  canPlaceNextBid: boolean;
}

export function calculateTeamAuctionBudget(input: TeamAuctionBudgetInput): TeamAuctionBudget {
  const {
    startingPurse,
    completedSpend,
    playersPurchased,
    minimumSquadSize,
    maximumSquadSize,
    bidIncrement,
    currentBid,
    basePrice,
    hasHighestBidder,
    isLeadingTeam = false,
    hasCurrentPlayer,
    remainingPlayerBasePrices,
  } = input;

  if (!Number.isFinite(startingPurse) || startingPurse < 0) {
    throw new Error("Starting purse must be a non-negative number.");
  }
  if (!Number.isFinite(completedSpend) || completedSpend < 0) {
    throw new Error("Completed spend must be a non-negative number.");
  }
  if (!Number.isInteger(playersPurchased) || playersPurchased < 0) {
    throw new Error("Players purchased must be a non-negative whole number.");
  }
  if (!Number.isInteger(minimumSquadSize) || minimumSquadSize < 0) {
    throw new Error("Minimum squad size must be a non-negative whole number.");
  }
  if (!Number.isInteger(maximumSquadSize) || maximumSquadSize < minimumSquadSize) {
    throw new Error("Maximum squad size must be a whole number at least as large as the minimum.");
  }
  if (!Number.isFinite(bidIncrement) || bidIncrement <= 0) {
    throw new Error("Bid increment must be greater than 0.");
  }
  if (!Number.isFinite(currentBid) || currentBid < 0 || !Number.isFinite(basePrice) || basePrice < 0) {
    throw new Error("Current bid and base price must be non-negative numbers.");
  }
  if (remainingPlayerBasePrices.some((price) => !Number.isFinite(price) || price < 0)) {
    throw new Error("Eligible player base prices must be non-negative numbers.");
  }

  const remainingBudget = Math.max(0, startingPurse - completedSpend);
  const playersNeeded = Math.max(0, minimumSquadSize - playersPurchased);
  const canAddPlayer = playersPurchased < maximumSquadSize;
  const reserveSlotsAfterPurchase = Math.max(0, minimumSquadSize - playersPurchased - 1);
  const prices = [...remainingPlayerBasePrices].sort((left, right) => left - right);
  const canReserveMinimumSquad = prices.length >= reserveSlotsAfterPurchase;
  const minimumReserve = canReserveMinimumSquad
    ? prices.slice(0, reserveSlotsAfterPurchase).reduce((total, price) => total + price, 0)
    : Number.POSITIVE_INFINITY;
  const maximumAffordableBid = canAddPlayer && canReserveMinimumSquad
    ? Math.max(0, remainingBudget - minimumReserve)
    : 0;
  const minimumNextBid = hasHighestBidder ? currentBid + bidIncrement : basePrice;

  return {
    remainingBudget,
    playersPurchased,
    playersNeeded,
    minimumReserve,
    maximumAffordableBid,
    minimumNextBid,
    canAddPlayer,
    canPlaceNextBid: canAddPlayer && canReserveMinimumSquad && hasCurrentPlayer && !isLeadingTeam && maximumAffordableBid >= minimumNextBid,
  };
}