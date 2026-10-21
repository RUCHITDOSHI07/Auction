import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MONGODB_DB_NAME,
  resolveMongoDatabaseName,
} from "../lib/mongodb-config.mjs";

test("defaults to the existing production database name", () => {
  assert.equal(DEFAULT_MONGODB_DB_NAME, "pnpl-auction");
  assert.equal(resolveMongoDatabaseName({}), "pnpl-auction");
});

test("uses MONGODB_DB_NAME for the explicitly configured staging database", () => {
  assert.equal(
    resolveMongoDatabaseName({ MONGODB_DB_NAME: "pnpl-auction-staging" }),
    "pnpl-auction-staging",
  );
});

test("treats a blank database name as unset for backward compatibility", () => {
  assert.equal(resolveMongoDatabaseName({ MONGODB_DB_NAME: "  " }), "pnpl-auction");
});