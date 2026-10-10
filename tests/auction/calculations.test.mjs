import assert from "node:assert/strict";
import test from "node:test";
import { calculateTeamAuctionBudget } from "../../lib/auction/calculations.ts";
import { getEffectiveAuctionPurchases } from "../../lib/auction/transactions.ts";

test("calculates the remaining purse, minimum reserve, and next bid", () => {
  const result = calculateTeamAuctionBudget({
    startingPurse: 1000,
    completedSpend: 200,
    playersPurchased: 1,
    minimumSquadSize: 3,
    maximumSquadSize: 5,
    bidIncrement: 25,
    currentBid: 100,
    basePrice: 50,
    hasHighestBidder: true,
    hasCurrentPlayer: true,
    remainingPlayerBasePrices: [60, 40, 80],
  });

  assert.equal(result.remainingBudget, 800);
  assert.equal(result.playersNeeded, 2);
  assert.equal(result.minimumReserve, 40);
  assert.equal(result.maximumAffordableBid, 760);
  assert.equal(result.minimumNextBid, 125);
  assert.equal(result.canPlaceNextBid, true);
});

test("uses base price for the opening bid", () => {
  const result = calculateTeamAuctionBudget({
    startingPurse: 500,
    completedSpend: 0,
    playersPurchased: 0,
    minimumSquadSize: 1,
    maximumSquadSize: 3,
    bidIncrement: 10,
    currentBid: 20,
    basePrice: 35,
    hasHighestBidder: false,
    hasCurrentPlayer: true,
    remainingPlayerBasePrices: [],
  });

  assert.equal(result.minimumNextBid, 35);
  assert.equal(result.minimumReserve, 0);
  assert.equal(result.canPlaceNextBid, true);
});

test("does not allow the leading team to bid twice in a row", () => {
  const result = calculateTeamAuctionBudget({
    startingPurse: 500,
    completedSpend: 0,
    playersPurchased: 0,
    minimumSquadSize: 1,
    maximumSquadSize: 3,
    bidIncrement: 10,
    currentBid: 50,
    basePrice: 20,
    hasHighestBidder: true,
    isLeadingTeam: true,
    hasCurrentPlayer: true,
    remainingPlayerBasePrices: [],
  });

  assert.equal(result.minimumNextBid, 60);
  assert.equal(result.canPlaceNextBid, false);
});

test("reserves base price for two remaining mandatory slots", () => {
  const result = calculateTeamAuctionBudget({
    startingPurse: 10000,
    completedSpend: 0,
    playersPurchased: 0,
    minimumSquadSize: 3,
    maximumSquadSize: 11,
    bidIncrement: 1000,
    currentBid: 2000,
    basePrice: 2000,
    hasHighestBidder: false,
    hasCurrentPlayer: true,
    remainingPlayerBasePrices: [2000, 2000],
  });

  assert.equal(result.playersNeeded, 3);
  assert.equal(result.minimumReserve, 4000);
  assert.equal(result.maximumAffordableBid, 6000);
  assert.equal(result.canPlaceNextBid, true);
});

test("disables bidding at maximum squad size", () => {
  const result = calculateTeamAuctionBudget({
    startingPurse: 500,
    completedSpend: 200,
    playersPurchased: 3,
    minimumSquadSize: 2,
    maximumSquadSize: 3,
    bidIncrement: 10,
    currentBid: 20,
    basePrice: 20,
    hasHighestBidder: false,
    hasCurrentPlayer: true,
    remainingPlayerBasePrices: [],
  });

  assert.equal(result.canAddPlayer, false);
  assert.equal(result.maximumAffordableBid, 0);
  assert.equal(result.canPlaceNextBid, false);
});

test("disables bidding when reserve slots cannot be filled", () => {
  const result = calculateTeamAuctionBudget({
    startingPurse: 500,
    completedSpend: 0,
    playersPurchased: 0,
    minimumSquadSize: 3,
    maximumSquadSize: 4,
    bidIncrement: 10,
    currentBid: 20,
    basePrice: 20,
    hasHighestBidder: false,
    hasCurrentPlayer: true,
    remainingPlayerBasePrices: [15],
  });

  assert.equal(result.minimumReserve, Number.POSITIVE_INFINITY);
  assert.equal(result.maximumAffordableBid, 0);
  assert.equal(result.canPlaceNextBid, false);
});

test("rejects invalid eligible base prices", () => {
  assert.throws(() => calculateTeamAuctionBudget({
    startingPurse: 500,
    completedSpend: 0,
    playersPurchased: 0,
    minimumSquadSize: 1,
    maximumSquadSize: 2,
    bidIncrement: 10,
    currentBid: 20,
    basePrice: 20,
    hasHighestBidder: false,
    hasCurrentPlayer: true,
    remainingPlayerBasePrices: [-1],
  }), /base prices must be non-negative/);
});

  test("a corrected sale replaces the original without deleting its ledger row", () => {
    const transactions = [
      { transactionId: "sale-1", type: "purchase", amount: 100, teamId: "team-a" },
      { transactionId: "correction-1", type: "correction", reversesTransactionId: "sale-1", amount: 120, teamId: "team-b" },
    ];

    assert.equal(transactions.length, 2);
    assert.deepEqual(getEffectiveAuctionPurchases(transactions).map(({ amount, teamId }) => ({ amount, teamId })), [
      { amount: 120, teamId: "team-b" },
    ]);
  });

  test("a reversal removes a sale from effective purse and squad totals", () => {
    const transactions = [
      { transactionId: "sale-1", type: "purchase", amount: 100, teamId: "team-a" },
      { transactionId: "reversal-1", type: "reversal", reversesTransactionId: "sale-1", amount: 100, teamId: "team-a" },
    ];

    assert.deepEqual(getEffectiveAuctionPurchases(transactions), []);
  });

  test("a reversal of a correction leaves the sale reversed", () => {
    const transactions = [
      { transactionId: "sale-1", type: "purchase", amount: 100, teamId: "team-a" },
      { transactionId: "correction-1", type: "correction", reversesTransactionId: "sale-1", amount: 120, teamId: "team-b" },
      { transactionId: "reversal-1", type: "reversal", reversesTransactionId: "correction-1", amount: 120, teamId: "team-b" },
    ];

    assert.deepEqual(getEffectiveAuctionPurchases(transactions), []);
  });