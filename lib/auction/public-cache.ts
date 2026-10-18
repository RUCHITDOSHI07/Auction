import { createHash } from "node:crypto";

export function createInFlightCoalescer<Key, Value>() {
  const inFlight = new Map<Key, Promise<Value>>();

  return {
    run(key: Key, work: () => Promise<Value> | Value): Promise<Value> {
      const existing = inFlight.get(key);
      if (existing) return existing;

      const pending = Promise.resolve().then(work);
      inFlight.set(key, pending);
      const cleanup = () => {
        if (inFlight.get(key) === pending) inFlight.delete(key);
      };
      void pending.then(cleanup, cleanup);
      return pending;
    },
    get size() {
      return inFlight.size;
    },
    has(key: Key) {
      return inFlight.has(key);
    },
  };
}

export function createPublicAuctionEtag(state: unknown, variation: unknown = null) {
  const digest = createHash("sha256")
    .update(JSON.stringify([state, variation]))
    .digest("base64url");
  return `"${digest}"`;
}

export function matchesIfNoneMatch(header: string | undefined, etag: string) {
  return header?.split(",").some((candidate) => {
    const normalized = candidate.trim().replace(/^W\//, "");
    return normalized === "*" || normalized === etag;
  }) ?? false;
}

export function publicAuctionReadKey(auctionId: string, etag: string) {
  return JSON.stringify([auctionId, etag]);
}

export function publicRevisionUpdate(field: "publicMetadataRevision" | "publicPlayerRevision", updatedAt = new Date()) {
  return {
    $inc: { [field]: 1 },
    $set: { updatedAt },
  };
}

export function publicPlayerAuctionFilter(playerId: string) {
  return { currentPlayerId: playerId };
}

export function publicTeamAuctionFilter(tournamentId: string, gender: string, teamId: string) {
  return { tournamentId, gender, teamIds: teamId };
}

export function publicTournamentAuctionFilter(tournamentId: string) {
  return { tournamentId };
}