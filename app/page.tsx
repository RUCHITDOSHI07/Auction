import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <div className="landing-brand">
        <span className="brand-mark">CA</span>
        <span>
          CRICKET
          <br />
          <b>AUCTION</b>
        </span>
      </div>

      <div className="landing-content">
        <span className="eyebrow">THE FOUNDERS CUP · 2026</span>
        <h1>
          The auction is
          <br />
          <i>live.</i>
        </h1>
        <p>Follow the room in real time from the floor, the stands, or the screenroom.</p>

        <div className="landing-actions">
          <Link className="button button-dark" href="/live">
            Watch live auction <span>→</span>
          </Link>
          <Link className="button button-quiet" href="/players">
            Players
          </Link>
          <Link className="button button-quiet" href="/results">
            Results
          </Link>
        </div>
      </div>

      <div className="landing-foot">
        <span>PUBLIC EXPERIENCE</span>
        <span>
          <Link href="/admin">Admin access</Link>
        </span>
      </div>
    </main>
  );
}
