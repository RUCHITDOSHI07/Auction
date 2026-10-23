"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { PageHeader } from "@/components/ui/Primitives";
import {
  DEFAULT_TOURNAMENT_CATEGORY_PRICES,
  MAX_PREMIUM_PLAYERS_PER_TEAM,
} from "@/lib/auction/category-rules";
import type {
  CompetitionGender,
  TournamentCategoryRules,
} from "@/types/tournament";

function defaultCategoryRules(): Record<CompetitionGender, TournamentCategoryRules> {
  return {
    male: {
      enabled: false,
      basePrices: { ...DEFAULT_TOURNAMENT_CATEGORY_PRICES },
      generalIconPrice: 15000,
      maxPremiumPlayersPerTeam: MAX_PREMIUM_PLAYERS_PER_TEAM,
    },
    female: {
      enabled: false,
      basePrices: { ...DEFAULT_TOURNAMENT_CATEGORY_PRICES },
      generalIconPrice: 15000,
      maxPremiumPlayersPerTeam: MAX_PREMIUM_PLAYERS_PER_TEAM,
    },
  };
}

export default function NewTournamentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [description, setDescription] = useState("");
  const [male, setMale] = useState(true);
  const [female, setFemale] = useState(true);
  const [iconPlayersEnabled, setIconPlayersEnabled] = useState({ male: false, female: false });
  const [categoryRules, setCategoryRules] = useState(defaultCategoryRules);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRules(gender: CompetitionGender, update: Partial<TournamentCategoryRules>) {
    setCategoryRules((current) => ({
      ...current,
      [gender]: { ...current[gender], ...update },
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          season: Number(season),
          description,
          competitions: { male, female },
          iconPlayersEnabled,
          categoryRules,
        }),
      });
      const result = await response.json() as { tournament?: { id: string }; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to create tournament.");
      router.push(`/admin/tournaments/${result.tournament?.id ?? ""}/setup`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create tournament.");
    } finally {
      setSaving(false);
    }
  }

  function renderCategorySetup(gender: CompetitionGender, enabled: boolean) {
    const label = gender === "male" ? "Men's" : "Women's";
    const rules = categoryRules[gender];
    const hasIconPlayers = iconPlayersEnabled[gender];
    return (
      <div className="tournament-section" key={gender}>
        <label className="category-rules-toggle">
          <input
            type="checkbox"
            checked={hasIconPlayers}
            disabled={!enabled}
            onChange={(event) => setIconPlayersEnabled((current) => ({
              ...current,
              [gender]: event.target.checked,
            }))}
          />
          <span>
            <strong>Pre-booked icon players for {label.toLowerCase()}</strong>
            <small>Optional. You can select one icon player while creating each team after importing players.</small>
          </span>
        </label>
        <label className="category-rules-toggle">
          <input
            type="checkbox"
            checked={rules.enabled}
            disabled={!enabled}
            onChange={(event) => updateRules(gender, { enabled: event.target.checked })}
          />
          <span>
            <strong>Enable category pricing and A/B/C roster limit for {label.toLowerCase()}</strong>
            <small>Optional. When enabled, each team can buy up to two combined A/B/C players.</small>
          </span>
        </label>
        {rules.enabled && enabled && (
          <div className="category-rule-grid">
            {(["A", "B", "C", "General"] as const).map((category) => (
              <label key={category}>
                Category {category} base price
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={rules.basePrices[category]}
                  onChange={(event) => updateRules(gender, {
                    basePrices: { ...rules.basePrices, [category]: Number(event.target.value) },
                  })}
                  required
                />
              </label>
            ))}
          </div>
        )}
        {hasIconPlayers && enabled && (
          <label className="category-rule-grid">
            General icon-player price
            <input
              type="number"
              min="1"
              step="1"
              value={rules.generalIconPrice}
              onChange={(event) => updateRules(gender, { generalIconPrice: Number(event.target.value) })}
              required
            />
            <small>A/B/C icon players use their tournament base price. General icon price is configurable per competition.</small>
          </label>
        )}
      </div>
    );
  }

  return (
    <AdminShell>
      <div className="content-wrap tournament-content">
        <PageHeader
          eyebrow="TOURNAMENT SETUP · STEP 1"
          title="Create tournament"
          description="Set up competitions and optional pre-booked icon players. Next, import the player pool, create teams with their icon player, and configure the auction."
          action={<Link className="button button-outline" href="/admin/tournaments">← Back</Link>}
        />
        <form className="tournament-form" onSubmit={submit}>
          <div className="tournament-form-grid">
            <label><span className="eyebrow">TOURNAMENT NAME</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. PNPL" required /></label>
            <label><span className="eyebrow">SEASON</span><input type="number" min="2000" max="2100" value={season} onChange={(event) => setSeason(event.target.value)} required /></label>
            <label className="tournament-full-field"><span className="eyebrow">DESCRIPTION</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional tournament description" rows={4} /></label>
          </div>
          <div className="tournament-section">
            <span className="eyebrow">COMPETITIONS</span>
            <p className="tournament-help">Each competition has its own teams, player pool, category settings, and auction.</p>
            <div className="competition-choice-grid">
              <label className={`competition-choice ${male ? "selected" : ""}`}><input type="checkbox" checked={male} onChange={(event) => setMale(event.target.checked)} /><span><strong>Men&apos;s competition</strong><small>Independent teams, players, auction, and results.</small></span></label>
              <label className={`competition-choice ${female ? "selected" : ""}`}><input type="checkbox" checked={female} onChange={(event) => setFemale(event.target.checked)} /><span><strong>Women&apos;s competition</strong><small>Independent teams, players, auction, and results.</small></span></label>
            </div>
          </div>
          {(male || female) && (
            <section className="tournament-section">
              <span className="eyebrow">OPTIONAL CATEGORY RULES</span>
              <p className="tournament-help">Enable separately for each competition. Excel player categories determine the applicable base price.</p>
              {male && renderCategorySetup("male", male)}
              {female && renderCategorySetup("female", female)}
            </section>
          )}
          {error && <p className="tournament-error" role="alert">{error}</p>}
          <div className="tournament-actions">
            <button className="button button-dark" type="submit" disabled={saving}>{saving ? "Creating..." : "Create and continue setup"}</button>
            <Link className="button button-outline" href="/admin/tournaments">Cancel</Link>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}
