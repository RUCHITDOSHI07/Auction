import assert from "node:assert/strict";
import test from "node:test";
import { appendAuctionBid } from "../../lib/auction/bid-trail.ts";

function bid(requestId, amount) {
  return {
    requestId,
    teamId: `team-${requestId}`,
    teamName: `Team ${requestId}`,
    amount,
    admin: { userId: "admin-1" },
    createdAt: new Date(amount),
  };
}

test("appends accepted bids in order for the same player", () => {
  const first = appendAuctionBid(undefined, "player-1", bid("bid-1", 100));
  const second = appendAuctionBid(first.trail, "player-1", bid("bid-2", 200));

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, false);
  assert.deepEqual(second.trail.bids.map((entry) => entry.amount), [100, 200]);
});

test("does not append a duplicate request ID", () => {
  const original = appendAuctionBid(undefined, "player-1", bid("bid-1", 100));
  const duplicate = appendAuctionBid(original.trail, "player-1", bid("bid-1", 100));

  assert.equal(duplicate.duplicate, true);
  assert.strictEqual(duplicate.trail, original.trail);
});

test("starts a fresh trail when the current player changes", () => {
  const original = appendAuctionBid(undefined, "player-1", bid("bid-1", 100));
  const nextPlayer = appendAuctionBid(original.trail, "player-2", bid("bid-2", 200));

  assert.deepEqual(nextPlayer.trail, { playerId: "player-2", bids: [bid("bid-2", 200)] });
});
