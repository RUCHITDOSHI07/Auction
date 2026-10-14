import assert from "node:assert/strict";
import test from "node:test";
import {
  auctionResultDeliveryGraceMs,
  auctionResultDisplayMs,
  shouldPresentAuctionResult,
} from "../../lib/auction/results.ts";

test("result animation is limited to one persisted event ID", () => {
  const createdAt = new Date(10_000);

  assert.equal(shouldPresentAuctionResult("event-1", null, createdAt, 11_000), true);
  assert.equal(shouldPresentAuctionResult("event-1", "event-1", createdAt, 11_000), false);
});

test("result display and reconnect grace are bounded", () => {
  const createdAt = new Date(10_000);

  assert.equal(auctionResultDisplayMs, 2500);
  assert.equal(shouldPresentAuctionResult("event-2", null, createdAt, 10_000 + auctionResultDeliveryGraceMs), true);
  assert.equal(shouldPresentAuctionResult("event-3", null, createdAt, 10_001 + auctionResultDeliveryGraceMs), false);
});