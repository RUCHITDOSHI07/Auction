import test from "node:test";
import assert from "node:assert/strict";
import { orderAuctionPlayers } from "../../lib/auction/player-order.ts";

test("orders A, B, and C players before a randomized General tail", () => {
  const players = [
    { id: "general-1", category: "General" },
    { id: "c-1", category: "C" },
    { id: "a-1", category: "A" },
    { id: "general-2", category: "General" },
    { id: "b-1", category: "B" },
    { id: "a-2", category: "A" },
  ];

  const ordered = orderAuctionPlayers(players, () => 0);

  assert.deepEqual(ordered.map((player) => player.id), [
    "a-1",
    "a-2",
    "b-1",
    "c-1",
    "general-2",
    "general-1",
  ]);
});

test("keeps uncategorized legacy players in the randomized tail", () => {
  const players = [
    { id: "unknown", category: "Uncategorized" },
    { id: "general", category: "General" },
    { id: "a", category: "A" },
  ];

  const ordered = orderAuctionPlayers(players, () => 0);

  assert.deepEqual(ordered.map((player) => player.id), ["a", "general", "unknown"]);
});
