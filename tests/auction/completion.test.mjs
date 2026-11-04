import assert from "node:assert/strict";
import test from "node:test";
import { areAllAuctionTeamsFull } from "../../lib/auction/completion.ts";

test("recognizes when every configured team has reached its maximum squad size", () => {
  assert.equal(areAllAuctionTeamsFull([{ playersCount: 11 }, { playersCount: 12 }], 2, 11), true);
});

test("does not treat an incomplete or underfilled team list as full", () => {
  assert.equal(areAllAuctionTeamsFull([], 0, 11), false);
  assert.equal(areAllAuctionTeamsFull([{ playersCount: 11 }], 2, 11), false);
  assert.equal(areAllAuctionTeamsFull([{ playersCount: 11 }, { playersCount: 10 }], 2, 11), false);
});
