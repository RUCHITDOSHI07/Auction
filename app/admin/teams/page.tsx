import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { teams } from "@/mock/data";
import { PageHeader, SectionHeading } from "@/components/ui/Primitives";

export default function AdminTeamsPage() {
  return (
    <AdminShell>
      <div className="content-wrap">
        <PageHeader
          eyebrow="TEAMS · 08 REGISTERED"
          title="Teams"
          description="Each squad and purse is tracked centrally for the active auction and future reporting."
          action={<Link className="button button-dark" href="/admin/auction/setup">+ Add team</Link>}
        />

        <div className="team-grid">
          {teams.map((team) => (
            <article className="team-card" key={team.id}>
              <div className="team-card-top">
                <span className="team-logo team-logo-large" style={{ background: team.color }}>{team.shortName}</span>
                <div>
                  <b>{team.name}</b>
                  <small>{team.status}</small>
                </div>
              </div>

              <div className="team-card-row">
                <span>Remaining purse</span>
                <strong>{team.purse} cr</strong>
              </div>
              <div className="team-card-row">
                <span>Squad</span>
                <strong>{team.squadCount}/{team.squadSize}</strong>
              </div>
              <div className="progress">
                <span style={{ width: `${(team.squadCount / team.squadSize) * 100}%`, background: team.color }} />
              </div>
            </article>
          ))}
        </div>

        <section className="panel" style={{ marginTop: "1.2rem" }}>
          <SectionHeading title="Team allocation overview" />
          <div className="table-panel">
            <div className="table-head">
              <span>TEAM</span>
              <span>PURSE</span>
              <span>SQUAD</span>
              <span>STATUS</span>
            </div>
            {teams.map((team) => (
              <div className="table-row" key={`${team.id}-row`}>
                <div className="player-cell">
                  <span className="team-logo team-logo-small" style={{ background: team.color }}>{team.shortName}</span>
                  <div>
                    <b>{team.name}</b>
                    <small>{team.players.length} players</small>
                  </div>
                </div>
                <span>{team.purse} cr</span>
                <span>{team.squadCount}/{team.squadSize}</span>
                <span>{team.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
