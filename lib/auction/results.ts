export const auctionResultDisplayMs = 2500;
export const auctionResultDeliveryGraceMs = 15_000;

export function shouldPresentAuctionResult(
  eventId: string,
  handledEventId: string | null,
  createdAt: Date | string,
  now = Date.now(),
) {
  if (!eventId || eventId === handledEventId) return false;
  const age = now - new Date(createdAt).getTime();
  return age >= -5000 && age <= auctionResultDeliveryGraceMs;
}