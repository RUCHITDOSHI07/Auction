import assert from "node:assert/strict";
import test from "node:test";
import {
  canAddPremiumPlayer,
  DEFAULT_TOURNAMENT_CATEGORY_PRICES,
  getIconPlayerPrice,
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

test("prices icon players from their category and keeps General pricing configurable", () => {
  const rules = {
    enabled: true,
    basePrices: { A: 50000, B: 40000, C: 30000, General: 1000 },
    generalIconPrice: 18000,
    maxPremiumPlayersPerTeam: 2,
  };
  assert.equal(getIconPlayerPrice("A", 25000, rules), 50000);
  assert.equal(getIconPlayerPrice("General", 1000, rules), 18000);
  assert.equal(getIconPlayerPrice("C", 33000, { ...rules, enabled: false }), 33000);
  assert.equal(getIconPlayerPrice("General", 1000), 15000);
  assert.throws(() => getIconPlayerPrice("uncategorized", 0, rules));
});

test("allows only two combined A/B/C players while General remains unrestricted", () => {
  assert.equal(isPremiumPlayerCategory("A"), true);
  assert.equal(isPremiumPlayerCategory("General"), false);
  assert.equal(canAddPremiumPlayer("C", 1), true);
  assert.equal(canAddPremiumPlayer("B", 2), false);
  assert.equal(canAddPremiumPlayer("General", 2), true);
});
