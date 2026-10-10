import Link from "next/link";
import { connection } from "next/server";
import { getPublicAuctions } from "@/lib/services/public-auctions";
import { StatusBadge } from "@/components/ui/Primitives";

export default async function LiveLandingPage() {
  await connection();
  const auctions = await getPublicAuctions().catch(() => null);
  return (
    <main className="live-landing">
      <div className="live-brand">
        <span className="brand-mark">CA</span>
        <span>
          THE FOUNDERS CUP
          <br />
          <b>LIVE DISPLAY</b>
        </span>
      </div>

      <div className="live-intro">
        <span className="eyebrow">PUBLIC DISPLAY · READ ONLY</span>
        <h1>
          Choose your
          <br />
          <i>auction room.</i>
        </h1>
        <p>Persisted auction state, updated every few seconds.</p>
      </div>

      {!auctions && <section className="public-empty-state"><h2>Live auctions unavailable</h2><p>We could not load tournament auction data. Refresh this page to retry.</p></section>}
      {auctions?.length === 0 && <section className="public-empty-state"><h2>No public auctions yet</h2><p>Configured auctions will appear here once they have been initialized.</p></section>}
      {Boolean(auctions?.length) && <div className="live-room-grid">{auctions?.map((auction, index) => (
        <Link href={`/live/${encodeURIComponent(auction.id)}`} className="live-room-card" key={auction.id}>
          <span className="live-room-number">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <StatusBadge tone={auction.status === "live" ? "live" : auction.status === "completed" ? "success" : "warning"}>{auction.status.toUpperCase()}</StatusBadge>
            <h2>{auction.tournamentName}</h2>
            <p>{auction.gender === "male" ? "Men's" : "Women's"} · {auction.season ?? "Season unavailable"} · {auction.playerCount} players · Round {auction.currentRound ?? "-"}</p>
          </div>
          <span className="live-arrow">↗</span>
        </Link>
      ))}</div>}

      <footer>Read-only public display · Admin-controlled auction room</footer>
    </main>
  );
}
