import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { teams } from "@/mock/data";
import { PageHeader, StatusBadge } from "@/components/ui/Primitives";

export default function TeamsPage() {
  return (
    <main className="public-live">
      <PublicHeader>
        <StatusBadge tone="live">PUBLIC</StatusBadge>
        <span>SQUAD DIRECTORY</span>
      </PublicHeader>

      <div className="content-wrap">
        <PageHeader
          eyebrow="DIRECTORY · 05 TEAMS"
          title="Teams"
          description="Five squads. One purse each. Every decision counts."
          action={<Link className="button button-outline" href="/">Back to home</Link>}
        />

        <div className="toolbar">
          <div className="search-box">⌕ <input placeholder="Search teams" /></div>
          <button className="filter-button" type="button">All auctions⌄</button>
          <button className="filter-button" type="button">Sort: purse⌄</button>
        </div>

        <section className="team-grid">
          {teams.map((team, index) => (
            <Link className="team-card" href={`/teams/${team.id}`} key={team.id}>
              <div className="team-card-top">
                <span className="team-logo team-logo-large" style={{ background: team.color }}>{team.shortName}</span>
                <StatusBadge tone={team.status === "Complete" ? "success" : "live"}>{team.status}</StatusBadge>
              </div>
              <h2>{team.name}</h2>
              <p>{"Men's Premier Auction"}</p>
              <div className="team-card-stats">
                <div>
                  <small>Remaining purse</small>
                  <strong>{team.purse} cr</strong>
                </div>
                <div>
                  <small>Squad</small>
                  <strong>{team.squadCount}<em>/{team.squadSize}</em></strong>
                </div>
              </div>
              <div className="progress-label">
                <span>Squad progress</span>
                <span>{Math.round((team.squadCount / team.squadSize) * 100)}%</span>
              </div>
              <div className="progress">
                <span style={{ width: `${(team.squadCount / team.squadSize) * 100}%`, background: team.color }} />
              </div>
              <span className="card-index">0{index + 1} ↗</span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
