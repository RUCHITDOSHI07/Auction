import AdminShell from "@/components/admin/AdminShell";
import { players, teams } from "@/mock/data";
import { PageHeader, SectionHeading, StatCard, StatusBadge } from "@/components/ui/Primitives";

export default function AdminResultsPage() {
  const sold = players.filter((player) => player.status === "SOLD");

  return (
    <AdminShell>
      <div className="content-wrap">
        <PageHeader
          eyebrow="AUCTION SUMMARY · ROUND 2"
          title="Results"
          description="Final team allocations, sold players, and the current auction summary are organized for reporting."
          action={<button className="button button-outline" type="button">Download report ↓</button>}
        />

        <div className="stats-grid">
          <StatCard label="Total spend" value="₹63L" detail="Across 4 sales" accent="#d9ef75" />
          <StatCard label="Highest sale" value="₹21L" detail="Arjun Mehta · NS" accent="#f28b58" />
          <StatCard label="Sold" value="04" detail="In the active auction" accent="#8fd7e7" />
          <StatCard label="Unsold" value="01" detail="Returns in future round" accent="#c4b8ed" />
        </div>

        <div className="results-grid">
          <section className="panel">
            <SectionHeading title="Sold players" action={<StatusBadge tone="success">ROUND 1</StatusBadge>} />
            {sold.map((player) => {
              const team = player.teamId ? teams.find((item) => item.id === player.teamId) : undefined;

              return (
                <div className="result-row" key={player.id}>
                  <div className="player-portrait" style={{ background: player.accent }}>{player.initials}</div>
                  <div>
                    <b>{player.name}</b>
                    <small>
                      {player.role} · {player.category}
                    </small>
                  </div>
                  <span className="result-team">{team?.shortName}</span>
                  <strong>{player.soldPrice}L</strong>
                </div>
              );
            })}
          </section>

          <section className="panel">
            <SectionHeading title="Teams spending" />
            <div className="spending-list">
              {teams.map((team) => (
                <div className="spending-row" key={team.id}>
                  <div>
                    <span className="team-logo team-logo-small" style={{ background: team.color }}>{team.shortName}</span>
                    <b>{team.name}</b>
                  </div>
                  <strong>{team.purse} cr</strong>
                  <div className="progress">
                    <span style={{ width: `${(team.purse / 100) * 100}%`, background: team.color }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="panel" style={{ marginTop: "1.2rem" }}>
          <SectionHeading title="Unsold players" action={<StatusBadge tone="warning">1 PLAYER</StatusBadge>} />
          <div className="empty-state compact">
            <span>↻</span>
            <h3>Rohan Das</h3>
            <p>Base price ₹2L · Will return in the next round.</p>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
