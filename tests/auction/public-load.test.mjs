import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../../scripts/public-auction-load.mjs", import.meta.url));

function runLoadScript(args, extraEnv = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
}

test("load runner defaults to dry-run with no network activity", () => {
  const result = runLoadScript([]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"mode": "dry-run"/);
  assert.match(result.stdout, /"networkRequests": 0/);
  assert.match(result.stdout, /"pollIntervalMs": 1500/);
});

test("load runner refuses a host without exact staging confirmation", () => {
  const result = runLoadScript([
    "--run",
    "--url", "https://auction-staging.example.com",
    "--auction-id", "test-auction",
    "--target", "staging",
    "--confirm-staging-host", "wrong.example.com",
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /confirm-staging-host must exactly match/);
});

test("load runner rejects production-marked hosts before any request", () => {
  const result = runLoadScript([
    "--run",
    "--url", "https://pnpl-prod.example.com",
    "--auction-id", "test-auction",
    "--target", "staging",
    "--confirm-staging-host", "pnpl-prod.example.com",
  ], { PUBLIC_AUCTION_STAGING_HOST: "pnpl-prod.example.com" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /host contains a production marker/);
});

test("load runner requires the separately configured staging host allowlist", () => {
  const result = runLoadScript([
    "--run",
    "--url", "https://auction-staging.example.com",
    "--auction-id", "test-auction",
    "--target", "staging",
    "--confirm-staging-host", "auction-staging.example.com",
  ], { PUBLIC_AUCTION_STAGING_HOST: "" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /PUBLIC_AUCTION_STAGING_HOST must be separately set/);
});

test("load runner requires at least 50 viewers", () => {
  const result = runLoadScript([
    "--run",
    "--url", "https://auction-staging.example.com",
    "--auction-id", "test-auction",
    "--target", "staging",
    "--confirm-staging-host", "auction-staging.example.com",
    "--viewers", "49",
  ], { PUBLIC_AUCTION_STAGING_HOST: "auction-staging.example.com" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /viewers must be an integer from 50/);
});