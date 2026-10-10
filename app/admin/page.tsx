import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { PageHeader, SectionHeading, StatCard, StatusBadge } from "@/components/ui/Primitives";
import { getCurrentAdmin } from "@/lib/auth/session";
import { getAdminDashboardSummary } from "@/lib/services/admin-dashboard";
import { redirect } from "next/navigation";

export default async function AdminDashboardPage() {
  const admin = await getCurrentAdmin().catch(() => null);
  if (!admin) redirect(`/admin/login?next=${encodeURIComponent("/admin")}`);
  const summary = await getAdminDashboardSummary().catch(() => null);
  if (!summary) {
    return <AdminShell><div className="content-wrap"><PageHeader eyebrow="ADMIN OVERVIEW" title="Auction control" description="Tournament and competition status from the persisted workspace." /><section className="panel history-state"><h2>Dashboard data unavailable</h2><p>Could not read the MongoDB tournament summary.</p><Link className="button button-outline" href="/admin/tournaments">Open tournaments</Link></section></div></AdminShell>;
  }

  const competitionsWithAuctions = summary.competitions.filter((competition) => competition.auction);
  return (
    <AdminShell>
      <div className="content-wrap">
        <PageHeader eyebrow="ADMIN OVERVIEW" title="Auction control" description="Tournament readiness, separate competition pools, and current auction state." action={<Link className="button button-dark" href="/admin/tournaments/new">New tournament</Link>} />
        <div className="stats-grid">
          <StatCard label="Tournaments" value={String(summary.tournamentCount).padStart(2, "0")} detail="Stored editions" accent="#a7d87a" />
          <StatCard label="Teams" value={String(summary.teamCount).padStart(2, "0")} detail="Across enabled competitions" accent="#82c6d0" />
          <StatCard label="Tournament players" value={summary.playerCount.toLocaleString("en-IN")} detail="Competition pool entries" accent="#e99a70" />
          <StatCard label="Live auctions" value={String(summary.liveAuctionCount).padStart(2, "0")} detail="Persisted live rooms" accent="#b9b0d9" />
        </div>

        {summary.tournamentCount === 0 ? <section className="panel dashboard-onboarding"><span className="eyebrow">GET STARTED</span><h2>Create your first tournament</h2><p>Then add separate men’s and women’s teams, import the tournament player pool, and configure each auction.</p><Link className="button button-dark" href="/admin/tournaments/new">Create tournament</Link></section> : <>
          <section className="dashboard-section">
            <SectionHeading title="Competitions" action={<Link className="text-link" href="/admin/tournaments">All tournaments →</Link>} />
            {summary.competitions.length === 0 ? <div className="panel history-state"><h2>No enabled competitions</h2><p>Enable at least one competition in a tournament before configuring teams and players.</p></div> : <div className="competition-dashboard-grid">{summary.competitions.map((competition) => {
              const auction = competition.auction;
              const status = auction?.status ?? "not configured";
              const genderLabel = competition.gender === "male" ? "Men’s" : "Women’s";
              return <article className="competition-dashboard-card" key={`${competition.tournamentId}-${competition.gender}`}>
                <div className="competition-dashboard-heading"><div><span className="eyebrow">{genderLabel} · {competition.season}</span><h2>{competition.tournamentName}</h2></div><StatusBadge tone={status === "live" ? "live" : status === "completed" ? "success" : "warning"}>{status.toUpperCase()}</StatusBadge></div>
                <div className="competition-dashboard-metrics"><span><small>TEAMS</small><b>{competition.teamCount}</b></span><span><small>PLAYER POOL</small><b>{competition.playerCount}</b></span><span><small>ROUND</small><b>{auction?.currentRound ?? "-"}</b></span></div>
                <div className="competition-links"><Link href={`/admin/teams?tournamentId=${encodeURIComponent(competition.tournamentId)}&gender=${competition.gender}`}>Teams</Link><Link href={`/admin/players?tournamentId=${encodeURIComponent(competition.tournamentId)}&gender=${competition.gender}`}>Player pool</Link><Link href={`/admin/tournaments/${encodeURIComponent(competition.tournamentId)}/auction-config?gender=${competition.gender}`}>Configuration</Link>{auction && <Link className="primary" href={`/admin/auction?tournamentId=${encodeURIComponent(competition.tournamentId)}&gender=${competition.gender}`}>Auction room</Link>}</div>
              </article>;
            })}</div>}
          </section>
          {competitionsWithAuctions.length > 0 && <section className="panel dashboard-quick-actions"><SectionHeading title="Quick actions" /><div className="quick-actions-stack"><Link className="button button-outline" href="/admin/tournaments">Manage tournaments</Link><Link className="button button-outline" href="/admin/players/import">Import master players</Link><Link className="button button-outline" href="/history">Review audit history</Link></div></section>}
        </>}
      </div>
    </AdminShell>
  );
}