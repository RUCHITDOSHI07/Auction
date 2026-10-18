export const DEFAULT_MONGODB_DB_NAME = "pnpl-auction";

export function resolveMongoDatabaseName(environment = process.env) {
  return environment.MONGODB_DB_NAME?.trim() || DEFAULT_MONGODB_DB_NAME;
}