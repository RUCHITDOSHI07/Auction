import assert from "node:assert/strict";
import test from "node:test";
import { processAuctionBidBatch } from "../../lib/auction/bid-batch.ts";

test("saves every bid in order and reports completion", async () => {
  const saved = [];
  const result = await processAuctionBidBatch(
    [{ amount: 100 }, { amount: 200 }, { amount: 300 }],
    async (bid) => { saved.push(bid.amount); },
  );

  assert.deepEqual(saved, [100, 200, 300]);
  assert.deepEqual(result, { success: true, savedCount: 3 });
});

test("stops at the first failed bid and reports earlier persisted bids", async () => {
  const saved = [];
  const result = await processAuctionBidBatch(
    [{ amount: 100 }, { amount: 200 }, { amount: 300 }],
    async (bid) => {
      if (bid.amount === 200) throw new Error("Bid is no longer valid.");
      saved.push(bid.amount);
    },
  );

  assert.deepEqual(saved, [100]);
  assert.deepEqual(result, {
    success: false,
    savedCount: 1,
    failedIndex: 1,
    error: "Bid is no longer valid.",
  });
});

test("rejects empty or oversized batches", async () => {
  await assert.rejects(processAuctionBidBatch([], async () => {}), /between 1 and 50/);
  await assert.rejects(
    processAuctionBidBatch(Array.from({ length: 51 }, (_, amount) => amount), async () => {}),
    /between 1 and 50/,
  );
});
