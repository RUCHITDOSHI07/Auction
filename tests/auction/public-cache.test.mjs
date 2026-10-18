import assert from "node:assert/strict";
import test from "node:test";
import {
  createInFlightCoalescer,
  createPublicAuctionEtag,
  matchesIfNoneMatch,
  publicPlayerAuctionFilter,
  publicAuctionReadKey,
  publicRevisionUpdate,
  publicTeamAuctionFilter,
  publicTournamentAuctionFilter,
} from "../../lib/auction/public-cache.ts";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("concurrent requests for one auction version share one in-flight computation", async () => {
  const cache = createInFlightCoalescer();
  const pending = deferred();
  let workCount = 0;
  const work = () => { workCount += 1; return pending.promise; };

  const first = cache.run(publicAuctionReadKey("auction-a", '"v1"'), work);
  const second = cache.run(publicAuctionReadKey("auction-a", '"v1"'), work);

  assert.strictEqual(first, second);
  await Promise.resolve();
  assert.equal(workCount, 1);
  pending.resolve({ currentBid: 100 });
  assert.deepEqual(await Promise.all([first, second]), [{ currentBid: 100 }, { currentBid: 100 }]);
  assert.equal(cache.size, 0);
});

test("different auctions and public state versions do not share work", async () => {
  const cache = createInFlightCoalescer();
  let workCount = 0;

  const first = cache.run(publicAuctionReadKey("auction-a", '"v1"'), () => ++workCount);
  const otherAuction = cache.run(publicAuctionReadKey("auction-b", '"v1"'), () => ++workCount);
  const otherVersion = cache.run(publicAuctionReadKey("auction-a", '"v2"'), () => ++workCount);

  assert.deepEqual(await Promise.all([first, otherAuction, otherVersion]), [1, 2, 3]);
  assert.equal(cache.size, 0);
});

test("failed computations are removed and a later request can retry", async () => {
  const cache = createInFlightCoalescer();
  const pending = deferred();
  let workCount = 0;
  const work = () => {
    workCount += 1;
    return workCount === 1 ? pending.promise : "recovered";
  };
  const first = cache.run("key", work);
  const joined = cache.run("key", work);
  assert.strictEqual(first, joined);
  pending.reject(new Error("database unavailable"));
  await assert.rejects(first, /database unavailable/);
  assert.equal(cache.size, 0);
  assert.equal(await cache.run("key", work), "recovered");
  assert.equal(workCount, 2);
  assert.equal(cache.size, 0);
});

test("successful results are not retained after their in-flight work completes", async () => {
  const cache = createInFlightCoalescer();
  let workCount = 0;

  assert.equal(await cache.run("key", () => ++workCount), 1);
  assert.equal(cache.size, 0);
  assert.equal(await cache.run("key", () => ++workCount), 2);
});

test("ETags change with auction state and player or metadata revisions", () => {
  const baseline = { status: "live", currentBid: 100, publicPlayerRevision: 0, publicMetadataRevision: 0 };
  const etag = createPublicAuctionEtag(baseline, false);
  const playerUpdate = publicRevisionUpdate("publicPlayerRevision", new Date(10));
  const metadataUpdate = publicRevisionUpdate("publicMetadataRevision", new Date(20));

  assert.notEqual(createPublicAuctionEtag({ ...baseline, currentBid: 200 }, false), etag);
  assert.notEqual(createPublicAuctionEtag({ ...baseline, status: "paused" }, false), etag);
  assert.deepEqual(playerUpdate.$inc, { publicPlayerRevision: 1 });
  assert.deepEqual(metadataUpdate.$inc, { publicMetadataRevision: 1 });
  assert.equal(playerUpdate.$set.updatedAt.getTime(), 10);
  assert.equal(metadataUpdate.$set.updatedAt.getTime(), 20);
  assert.notEqual(createPublicAuctionEtag({ ...baseline, publicPlayerRevision: playerUpdate.$inc.publicPlayerRevision }, false), etag);
  assert.notEqual(createPublicAuctionEtag({ ...baseline, publicMetadataRevision: metadataUpdate.$inc.publicMetadataRevision }, false), etag);
  assert.notEqual(createPublicAuctionEtag(baseline, true), etag);
  assert.deepEqual(publicPlayerAuctionFilter("player-1"), { currentPlayerId: "player-1" });
  assert.deepEqual(publicTeamAuctionFilter("tournament-1", "female", "team-1"), {
    tournamentId: "tournament-1",
    gender: "female",
    teamIds: "team-1",
  });
  assert.deepEqual(publicTournamentAuctionFilter("tournament-1"), { tournamentId: "tournament-1" });
});

test("persisted SOLD and UNSOLD transitions cannot retain the previous ETag", () => {
  const liveState = {
    status: "live",
    currentPlayerId: "player-1",
    currentBid: 100,
    awaitingAdvance: false,
    lastActionEventId: "bid-1",
    lastResult: undefined,
  };
  const liveEtag = createPublicAuctionEtag(liveState, false);
  const soldEtag = createPublicAuctionEtag({
    ...liveState,
    awaitingAdvance: true,
    lastActionEventId: "sale-1",
    lastResult: { eventId: "sale-1", outcome: "sold", amount: 100 },
  }, true);
  const unsoldEtag = createPublicAuctionEtag({
    ...liveState,
    awaitingAdvance: true,
    lastActionEventId: "unsold-1",
    lastResult: { eventId: "unsold-1", outcome: "unsold" },
  }, true);

  assert.notEqual(soldEtag, liveEtag);
  assert.notEqual(unsoldEtag, liveEtag);
  assert.notEqual(soldEtag, unsoldEtag);
});

test("conditional ETag matching accepts exact, weak, wildcard, and list validators", () => {
  const etag = '"state-a"';

  assert.equal(matchesIfNoneMatch(etag, etag), true);
  assert.equal(matchesIfNoneMatch(`W/${etag}`, etag), true);
  assert.equal(matchesIfNoneMatch("*", etag), true);
  assert.equal(matchesIfNoneMatch(`"state-b", W/${etag}`, etag), true);
  assert.equal(matchesIfNoneMatch('"state-b"', etag), false);
  assert.equal(matchesIfNoneMatch(undefined, etag), false);
});