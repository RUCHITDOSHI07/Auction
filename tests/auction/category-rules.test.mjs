import assert from "node:assert/strict";
import test from "node:test";
import {
  canAddPremiumPlayer,
  DEFAULT_TOURNAMENT_CATEGORY_PRICES,
  getTournamentCategoryBasePrice,
  isPremiumPlayerCategory,
  normalizeTournamentPlayerCategory,
} from "../../lib/auction/category-rules.ts";

test("normalizes the four tournament player categories", () => {
  assert.equal(normalizeTournamentPlayerCategory(" a "), "A");
  assert.equal(normalizeTournamentPlayerCategory("b"), "B");
  assert.equal(normalizeTournamentPlayerCategory("C"), "C");
  assert.equal(normalizeTournamentPlayerCategory("general"), "General");
  assert.equal(normalizeTournamentPlayerCategory("uncategorized"), null);
});

test("applies configured base prices to normalized categories", () => {
  assert.equal(getTournamentCategoryBasePrice("A", DEFAULT_TOURNAMENT_CATEGORY_PRICES), 50000);
  assert.equal(getTournamentCategoryBasePrice("general", DEFAULT_TOURNAMENT_CATEGORY_PRICES), 1000);
  assert.throws(() => getTournamentCategoryBasePrice("unknown", DEFAULT_TOURNAMENT_CATEGORY_PRICES));
});

test("allows only two combined A/B/C players while General remains unrestricted", () => {
  assert.equal(isPremiumPlayerCategory("A"), true);
  assert.equal(isPremiumPlayerCategory("General"), false);
  assert.equal(canAddPremiumPlayer("C", 1), true);
  assert.equal(canAddPremiumPlayer("B", 2), false);
  assert.equal(canAddPremiumPlayer("General", 2), true);
});
