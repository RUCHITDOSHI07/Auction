export const maxAuctionBidBatchSize = 50;

export type AuctionBidBatchResult = {
  success: boolean;
  savedCount: number;
  failedIndex?: number;
  error?: string;
};

export async function processAuctionBidBatch<T>(
  bids: readonly T[],
  saveBid: (bid: T) => Promise<void>,
): Promise<AuctionBidBatchResult> {
  if (bids.length === 0 || bids.length > maxAuctionBidBatchSize) {
    throw new RangeError(`A bid batch must contain between 1 and ${maxAuctionBidBatchSize} bids.`);
  }

  for (const [index, bid] of bids.entries()) {
    try {
      await saveBid(bid);
    } catch (error) {
      return {
        success: false,
        savedCount: index,
        failedIndex: index,
        error: error instanceof Error ? error.message : "Unable to save bid.",
      };
    }
  }

  return { success: true, savedCount: bids.length };
}
