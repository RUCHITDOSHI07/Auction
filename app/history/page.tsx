"use client";

import Link from "next/link";
import { startTransition, useEffect, useState, type FormEvent } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { PageHeader, StatusBadge } from "@/components/ui/Primitives";

type HistoryEvent = {
  eventId?: string;
  auctionId: string;
  tournamentId: string;
  gender: "male" | "female";
  action: string;
  round?: number;
  admin?: { userId?: string; name?: string };
  playerId?: string;
  playerName?: string | null;
  teamId?: string;
  teamName?: string | null;
  teamShortName?: string | null;
  amount?: number;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reversesEventId?: string;
  correctsEventId?: string;
  reason?: string;
  createdAt?: string;
  metadataAvailable: boolean;
  canCorrect: boolean;
  correctionBlockedReason?: string | null;
};

type HistoryResponse = {
  events: HistoryEvent[];
  total: number;
  page: number;
  limit: number;
  options?: {
    tournaments: { id: string; name: string; season: number }[];
    teams: { id: string; name: string; shortName: string; tournamentId: string; gender: "male" | "female" }[];
  };
};

const actions = ["AUCTION_INITIALIZED", "AUCTION_STARTED", "AUCTION_PAUSED", "AUCTION_RESUMED", "AUCTION_COMPLETED", "BID_UPDATED", "PLAYER_SOLD", "PLAYER_UNSOLD", "ROUND_STARTED", "ROUND_COMPLETED", "SALE_REVERSED", "SALE_CORRECTED"];

function formatAmount(amount?: number) {
  return amount === undefined ? "Unavailable" : `₹${amount.toLocaleString("en-IN")}`;
}

function formatAction(action: string) {
  return action.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatTimestamp(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return "Timestamp unavailable";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function HistoryPage() {
  const [filters, setFilters] = useState({ q: "", tournamentId: "", gender: "", teamId: "", action: "", from: "", to: "" });
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [options, setOptions] = useState<NonNullable<HistoryResponse["options"]>>({ tournaments: [], teams: [] });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHistory(nextPage = page, nextFilters = filters) {
    const query = new URLSearchParams({ page: String(nextPage), limit: "30" });
    for (const [key, value] of Object.entries(nextFilters)) if (value) query.set(key, value);
    try {
      const response = await fetch(`/api/auction-history?${query}`, { cache: "no-store" });
      const result = await response.json() as HistoryResponse & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load auction history.");
      startTransition(() => {
        setData(result);
        if (result.options) setOptions(result.options);
        setPage(nextPage);
        setError(null);
        setLoading(false);
      });
    } catch (loadError) {
      startTransition(() => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load auction history.");
        setLoading(false);
      });
    }
  }

  useEffect(() => {
    void fetch("/api/auction-history?page=1&limit=30", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as HistoryResponse & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load auction history.");
        startTransition(() => { setData(result); if (result.options) setOptions(result.options); setLoading(false); setError(null); });
      })
      .catch((loadError: unknown) => startTransition(() => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load auction history.");
        setLoading(false);
      }));
  }, []);

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    void loadHistory(1, filters);
  }

  return (
    <AdminShell>
      <div className="content-wrap narrow-content">
        <PageHeader eyebrow="AUDIT TRAIL" title="Auction history" description="Persisted auction actions, bids, sales, and correction links." />
        <form className="history-filter-panel" onSubmit={submitFilters}>
          <label>Player name or ID<input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Search player" /></label>
          <label>Tournament<select value={filters.tournamentId} onChange={(event) => setFilters({ ...filters, tournamentId: event.target.value })}><option value="">All tournaments</option>{options.tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name} · {tournament.season}</option>)}</select></label>
          <label>Competition<select value={filters.gender} onChange={(event) => setFilters({ ...filters, gender: event.target.value })}><option value="">All competitions</option><option value="male">Men</option><option value="female">Women</option></select></label>
          <label>Team<select value={filters.teamId} onChange={(event) => setFilters({ ...filters, teamId: event.target.value })}><option value="">All teams</option>{options.teams.filter((team) => !filters.tournamentId || team.tournamentId === filters.tournamentId).filter((team) => !filters.gender || team.gender === filters.gender).map((team) => <option key={team.id} value={team.id}>{team.name} · {team.shortName}</option>)}</select></label>
          <label>Action<select value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })}><option value="">All actions</option>{actions.map((action) => <option key={action} value={action}>{formatAction(action)}</option>)}</select></label>
          <label>From<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
          <label>To<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
          <button className="button button-dark" type="submit" disabled={loading}>{loading ? "Filtering..." : "Apply filters"}</button>
        </form>

        {error && <section className="panel history-state" role="alert"><p>{error}</p><button className="button button-outline" type="button" onClick={() => { setLoading(true); void loadHistory(1); }}>Retry</button></section>}
        {loading && <section className="panel history-state"><p>Loading persisted auction history...</p></section>}
        {!loading && !error && data?.events.length === 0 && <section className="panel history-state"><h2>No matching events</h2><p>Try broadening the filters, or check back after auction activity is recorded.</p></section>}

        {!loading && !error && data && data.events.length > 0 && <>
          <div className="history-results-heading"><span>{data.total.toLocaleString("en-IN")} events</span><span>Newest first</span></div>
          <div className="audit-event-list">
            {data.events.map((event, index) => <article className="audit-event" key={event.eventId ?? `${event.auctionId}-${event.createdAt ?? "legacy"}-${index}`}>
              <div className="audit-event-marker"><StatusBadge tone={event.action.includes("SOLD") ? "success" : event.action.includes("UNSOLD") ? "warning" : "neutral"}>{formatAction(event.action)}</StatusBadge><time>{formatTimestamp(event.createdAt)}</time></div>
              <div className="audit-event-main"><div className="audit-event-title"><div><h2>{event.playerName ?? event.playerId ?? formatAction(event.action)}</h2><p>{event.playerId ? `${event.playerId} · ` : ""}{event.teamName ?? event.teamId ?? "No team recorded"} · {event.gender === "female" ? "Women's" : "Men's"} · Round {event.round ?? "unavailable"}</p></div>{event.amount !== undefined && <strong>{formatAmount(event.amount)}</strong>}</div>
                <div className="audit-event-meta"><span>{event.admin?.name ?? event.admin?.userId ?? "Admin metadata unavailable"}</span><span>{event.metadataAvailable ? `Event ${event.eventId}` : "Legacy record · metadata unavailable"}</span>{event.correctsEventId && <span>Corrects {event.correctsEventId}</span>}{event.reversesEventId && <span>Reverses {event.reversesEventId}</span>}</div>
                {event.reason && <p className="audit-reason">Reason: {event.reason}</p>}
                {event.correctionBlockedReason && <p className="audit-correction-blocked">{event.correctionBlockedReason} <Link href={`/admin/auction?tournamentId=${encodeURIComponent(event.tournamentId)}&gender=${event.gender}`}>Review current auction</Link></p>}
                {(event.before || event.after) && <details className="audit-snapshots"><summary>Before / after details</summary><div><section><b>Before</b><pre>{JSON.stringify(event.before ?? null, null, 2)}</pre></section><section><b>After</b><pre>{JSON.stringify(event.after ?? null, null, 2)}</pre></section></div></details>}
                {event.canCorrect && event.eventId && <Link className="button button-outline audit-correct-link" href={`/admin/auction?tournamentId=${encodeURIComponent(event.tournamentId)}&gender=${event.gender}&saleEventId=${encodeURIComponent(event.eventId)}`}>Review / correct latest sale</Link>}
              </div>
            </article>)}
          </div>
          <div className="history-pagination"><button className="button button-outline" type="button" disabled={page <= 1 || loading} onClick={() => { setLoading(true); void loadHistory(page - 1); }}>Previous</button><span>Page {page} of {Math.max(1, Math.ceil(data.total / data.limit))}</span><button className="button button-outline" type="button" disabled={page * data.limit >= data.total || loading} onClick={() => { setLoading(true); void loadHistory(page + 1); }}>Next</button></div>
        </>}
      </div>
    </AdminShell>
  );
}