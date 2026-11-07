import type { AuctionBidTrailEntry, AuctionPlayerBidTrail } from "@/types/auction-config";

export function appendAuctionBid(
  currentTrail: AuctionPlayerBidTrail | undefined,
  playerId: string,
  bid: AuctionBidTrailEntry,
): { trail: AuctionPlayerBidTrail; duplicate: boolean } {
  const bids = currentTrail?.playerId === playerId ? currentTrail.bids : [];
  if (bid.requestId && currentTrail?.playerId === playerId
    && bids.some((savedBid) => savedBid.requestId === bid.requestId)) {
    return { trail: currentTrail, duplicate: true };
  }
  return {
    trail: { playerId, bids: [...bids, bid] },
    duplicate: false,
  };
}
