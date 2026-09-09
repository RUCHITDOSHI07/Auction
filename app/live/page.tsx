import Link from "next/link";
import { auctions } from "@/mock/data";
import { StatusBadge } from "@/components/ui/Primitives";

export default function LiveLandingPage() {
  return (
    <main className="live-landing">
      <div className="live-brand">
        <span className="brand-mark">CA</span>
        <span>
          THE FOUNDERS CUP
          <br />
          <b>LIVE</b>
        </span>
      </div>

      <div className="live-intro">
        <span className="eyebrow">PUBLIC DISPLAY · 2026</span>
        <h1>
          Choose your
          <br />
          <i>auction room.</i>
        </h1>
        <p>Follow the latest bids in real time, with separate men’s and women’s rooms.</p>
      </div>

      <div className="live-room-grid">
        {auctions.map((auction) => (
          <Link href={`/live/${auction.type}`} className="live-room-card" key={auction.id}>
            <span className="live-room-number">0{auction.type === "men" ? "1" : "2"}</span>
            <div>
              <StatusBadge tone={auction.status === "IN_PROGRESS" ? "live" : "success"}>
                {auction.status.replace("_", " ")}
              </StatusBadge>
              <h2>{auction.type === "men" ? "Men's" : "Women's"} Premier</h2>
              <p>
                {auction.totalPlayers} players · Round {auction.round}
              </p>
            </div>
            <span className="live-arrow">↗</span>
          </Link>
        ))}
      </div>

      <footer>Read-only public display · Admin-controlled auction room</footer>
    </main>
  );
}
