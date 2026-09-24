import type { PlayerGender } from "@/types/firestore";

export function normalizePlayerGender(value: unknown): PlayerGender | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "male" || normalized === "m") return "male";
  if (normalized === "female" || normalized === "f") return "female";
  return undefined;
}