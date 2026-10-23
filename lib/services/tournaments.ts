import type { Collection, UpdateFilter } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { publicRevisionUpdate, publicTournamentAuctionFilter } from "@/lib/auction/public-cache";
import {
  MAX_PREMIUM_PLAYERS_PER_TEAM,
  DEFAULT_TOURNAMENT_CATEGORY_PRICES,
} from "@/lib/auction/category-rules";
import type {
  CompetitionGender,
  Tournament,
  TournamentCategoryRules,
  TournamentInput,
  TournamentStatus,
} from "@/types/tournament";

type TournamentDocument = Omit<Tournament, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};

let tournamentIndexPromise: Promise<string> | undefined;

async function getTournamentsCollection(): Promise<Collection<TournamentDocument>> {
  const database = await getMongoDb();
  return database.collection<TournamentDocument>("tournaments");
}

async function ensureTournamentIndexes(collection: Collection<TournamentDocument>) {
  tournamentIndexPromise ??= collection.createIndex(
    { season: 1, name: 1 },
    { name: "tournaments_season_name" },
  );
  await tournamentIndexPromise;
}

function toTournament(document: TournamentDocument & { _id?: unknown }): Tournament {
  const tournament = { ...document };
  delete tournament._id;
  return tournament;
}

function createTournamentId(name: string, season: number) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  return `${slug || "tournament"}-${season}`;
}

function validateTournamentInput(input: TournamentInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Tournament name is required.");

  const season = Number(input.season);
  if (!Number.isInteger(season) || season < 2000 || season > 2100) {
    throw new Error("Season must be a valid year.");
  }

  const male = Boolean(input.competitions?.male);
  const female = Boolean(input.competitions?.female);
  if (!male && !female) {
    throw new Error("Enable at least one competition.");
  }

  const categoryRules = (gender: CompetitionGender): TournamentCategoryRules => {
    const provided = input.categoryRules?.[gender];
    const prices = provided?.basePrices ?? DEFAULT_TOURNAMENT_CATEGORY_PRICES;
    const normalizedPrices = {
      A: Number(prices.A),
      B: Number(prices.B),
      C: Number(prices.C),
      General: Number(prices.General),
    };
    for (const [category, price] of Object.entries(normalizedPrices)) {
      if (!Number.isSafeInteger(price) || price <= 0) {
        throw new Error(`${gender === "male" ? "Men's" : "Women's"} ${category} base price must be a positive whole number.`);
      }
    }
    const generalIconPrice = Number(provided?.generalIconPrice ?? 15000);
    if (!Number.isSafeInteger(generalIconPrice) || generalIconPrice <= 0) {
      throw new Error(`${gender === "male" ? "Men's" : "Women's"} General icon price must be a positive whole number.`);
    }
    return {
      enabled: Boolean(provided?.enabled),
      basePrices: normalizedPrices,
      generalIconPrice,
      maxPremiumPlayersPerTeam: MAX_PREMIUM_PLAYERS_PER_TEAM,
    };
  };

  return {
    name,
    season,
    description: input.description?.trim() || undefined,
    competitions: { male, female },
    iconPlayersEnabled: {
      male: male && Boolean(input.iconPlayersEnabled?.male),
      female: female && Boolean(input.iconPlayersEnabled?.female),
    },
    categoryRules: {
      male: categoryRules("male"),
      female: categoryRules("female"),
    },
  };
}

export async function getTournaments(): Promise<Tournament[]> {
  const collection = await getTournamentsCollection();
  await ensureTournamentIndexes(collection);

  const documents = await collection
    .find({})
    .sort({ season: -1, createdAt: -1 })
    .toArray();

  return documents.map(toTournament);
}

export async function getTournamentById(tournamentId: string): Promise<Tournament | null> {
  const collection = await getTournamentsCollection();
  await ensureTournamentIndexes(collection);
  const document = await collection.findOne({ id: tournamentId });
  return document ? toTournament(document) : null;
}

export async function createTournament(input: TournamentInput): Promise<Tournament> {
  const collection = await getTournamentsCollection();
  await ensureTournamentIndexes(collection);

  const normalized = validateTournamentInput(input);
  const id = createTournamentId(normalized.name, normalized.season);

  const existing = await collection.findOne({ id });
  if (existing) {
    throw new Error("A tournament with this name and season already exists.");
  }

  const now = new Date();
  const document: TournamentDocument = {
    id,
    name: normalized.name,
    season: normalized.season,
    ...(normalized.description ? { description: normalized.description } : {}),
    status: "draft",
    competitions: {
      male: {
        enabled: normalized.competitions.male,
        iconPlayersEnabled: normalized.iconPlayersEnabled.male,
        categoryRules: normalized.categoryRules.male,
      },
      female: {
        enabled: normalized.competitions.female,
        iconPlayersEnabled: normalized.iconPlayersEnabled.female,
        categoryRules: normalized.categoryRules.female,
      },
    },
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(document);
  return toTournament(document);
}

export async function updateTournament(
  tournamentId: string,
  changes: Partial<TournamentInput> & { status?: TournamentStatus },
): Promise<Tournament> {
  const collection = await getTournamentsCollection();
  await ensureTournamentIndexes(collection);

  const existing = await collection.findOne({ id: tournamentId });
  if (!existing) throw new Error("Tournament not found.");

  const nextName = changes.name?.trim() || existing.name;
  const nextSeason = changes.season ?? existing.season;
  const nextMale = changes.competitions?.male ?? existing.competitions.male.enabled;
  const nextFemale = changes.competitions?.female ?? existing.competitions.female.enabled;

  if (!nextName) throw new Error("Tournament name is required.");
  if (!Number.isInteger(nextSeason) || nextSeason < 2000 || nextSeason > 2100) {
    throw new Error("Season must be a valid year.");
  }
  if (!nextMale && !nextFemale) throw new Error("Enable at least one competition.");

  const update: UpdateFilter<TournamentDocument> = {
    $set: {
      name: nextName,
      season: nextSeason,
      description: changes.description?.trim() || existing.description,
      status: changes.status ?? existing.status,
      competitions: {
        male: {
          ...existing.competitions.male,
          enabled: nextMale,
          iconPlayersEnabled: nextMale && (changes.iconPlayersEnabled?.male ?? existing.competitions.male.iconPlayersEnabled ?? false),
          ...(changes.categoryRules?.male ? { categoryRules: changes.categoryRules.male } : {}),
        },
        female: {
          ...existing.competitions.female,
          enabled: nextFemale,
          iconPlayersEnabled: nextFemale && (changes.iconPlayersEnabled?.female ?? existing.competitions.female.iconPlayersEnabled ?? false),
          ...(changes.categoryRules?.female ? { categoryRules: changes.categoryRules.female } : {}),
        },
      },
      updatedAt: new Date(),
    },
  };

  await collection.updateOne({ id: tournamentId }, update);
  const updated = await collection.findOne({ id: tournamentId });
  if (!updated) throw new Error("Tournament could not be loaded after update.");
  await (await getMongoDb()).collection("auctions").updateMany(
    publicTournamentAuctionFilter(tournamentId),
    publicRevisionUpdate("publicMetadataRevision"),
  );

  return toTournament(updated);
}
