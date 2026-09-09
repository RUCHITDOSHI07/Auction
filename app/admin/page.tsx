import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { activity, teams } from "@/mock/data";
import { PageHeader, SectionHeading, StatCard, StatusBadge } from "@/components/ui/Primitives";

export default function AdminDashboardPage() {
  return (
    <AdminShell>
      <div className="content-wrap">
        <PageHeader
          eyebrow="FRIDAY · 04 SEPTEMBER 2026"
          title="Auction control room"
          description="Everything is in place for the live room, prepared for a seamless public viewing experience."
          action={
            <Link className="button button-dark" href="/admin/auction">
              Enter auction room <span>↗</span>
            </Link>
          }
        />

        <div className="stats-grid">
          <StatCard label="Teams" value="08" detail="All squads approved" accent="#d9ef75" />
          <StatCard label="Players" value="120" detail="88 remaining" accent="#8fd7e7" />
          <StatCard label="Purse pool" value="₹10Cr" detail="Across active teams" accent="#f28b58" />
          <StatCard label="Sold" value="32" detail="Players completed" accent="#c4b8ed" />
        </div>

        <div className="dashboard-grid">
          <section className="panel">
            <SectionHeading
              title="Active auction"
              action={<Link className="text-link" href="/admin/auction">Open room ↗</Link>}
            />

            <div className="floor-player">
              <div className="player-portrait portrait-large" style={{ background: "#e0c18e" }}>
                DP
              </div>
              <div>
                <span className="eyebrow">CURRENT PLAYER · #05</span>
                <h2>Dev Patel</h2>
                <p>Batter · Emerging · Base ₹3L</p>
                <div className="bid-line">
                  <span>Current bid</span>
                  <strong>₹55L</strong>
                  <StatusBadge tone="live">LIVE</StatusBadge>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <SectionHeading title="Auction status" action={<StatusBadge tone="live">IN PROGRESS</StatusBadge>} />
            <div className="schedule-row">
              <span className="schedule-time">10:00</span>
              <div>
                <b>{"Women's auction"}</b>
                <small>Ready to open at 11:00</small>
              </div>
              <StatusBadge tone="success">READY</StatusBadge>
            </div>
            <div className="schedule-row">
              <span className="schedule-time">14:00</span>
              <div>
                <b>{"Men's auction"}</b>
                <small>Round 2 live</small>
              </div>
              <StatusBadge tone="live">LIVE</StatusBadge>
            </div>
          </section>
        </div>

        <div className="dashboard-grid">
          <section className="panel">
            <SectionHeading title="Recent activity" />
            {activity.map((item) => (
              <div className="activity-row" key={item.id}>
                <span className={`activity-dot ${item.tone}`} />
                <div>
                  <b>{item.label}</b>
                  <small>{item.detail}</small>
                </div>
                <time>{item.time}</time>
              </div>
            ))}
          </section>

          <section className="panel">
            <SectionHeading title="Quick actions" />
            <div className="quick-actions-stack">
              <Link className="button button-dark" href="/admin/players/import">
                Import players
              </Link>
              <Link className="button button-outline" href="/admin/auction/setup">
                Configure auction
              </Link>
              <Link className="button button-outline" href="/admin/results/export">
                Export results
              </Link>
            </div>
          </section>
        </div>

        <section className="panel" style={{ marginTop: "1.2rem" }}>
          <SectionHeading title="Teams summary" />
          <div className="team-grid">
            {teams.map((team) => (
              <div className="team-card" key={team.id}>
                <div className="team-card-top">
                  <span className="team-logo" style={{ background: team.color }}>{team.shortName}</span>
                  <div>
                    <b>{team.name}</b>
                    <small>{team.squadCount} players</small>
                  </div>
                </div>
                <div className="team-card-row">
                  <span>Remaining purse</span>
                  <strong>{team.purse} cr</strong>
                </div>
                <div className="mini-progress">
                  <span style={{ width: `${(team.purse / 100) * 100}%`, background: team.color }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
