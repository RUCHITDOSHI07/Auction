import { redirect } from "next/navigation";

export default async function AuctionRoomRedirect({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = await params;
  redirect(`/live/${encodeURIComponent(auctionId)}`);
}