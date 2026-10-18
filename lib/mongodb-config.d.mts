export const DEFAULT_MONGODB_DB_NAME: "pnpl-auction";

export function resolveMongoDatabaseName(environment?: {
  MONGODB_DB_NAME?: string;
}): string;