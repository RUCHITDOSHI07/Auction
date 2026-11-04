type PlayerIdentity = {
  id: string;
  name?: string;
  fullName?: string;
  phoneNumber?: string;
  gender?: string;
};

export function normalizePlayerName(value: string | undefined) {
  return (value ?? "").trim().normalize("NFKC").replace(/\s+/g, " ").toLocaleLowerCase();
}

export function normalizePlayerPhone(value: string | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function playerImportName(input: { name?: string; fullName?: string }) {
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  return fullName || name;
}

export function playerImportIdentity(name: string | undefined, phone: string | undefined, gender?: string) {
  return `${(gender ?? "").trim().toLowerCase()}|${normalizePlayerName(name)}|${normalizePlayerPhone(phone)}`;
}

export function excludeAuctionStateFromPlayerImport(changes: Record<string, unknown>) {
  const safeChanges = { ...changes };
  for (const field of ["status", "soldTo", "teamId", "soldPrice", "soldRound", "isSold"]) {
    delete safeChanges[field];
  }
  return safeChanges;
}

export function findPlayerIdentityMatch<T extends PlayerIdentity>(
  input: { name?: string; fullName?: string; phoneNumber?: string; gender?: string },
  players: T[],
): { player?: T; ambiguous: boolean } {
  const name = normalizePlayerName(input.fullName || input.name);
  const phone = normalizePlayerPhone(input.phoneNumber);
  const gender = input.gender?.trim().toLowerCase();
  if (!name && !phone) return { ambiguous: false };

  const matches = players.filter((player) => {
    if (gender && player.gender && player.gender.trim().toLowerCase() !== gender) return false;
    const sameName = name !== "" && normalizePlayerName(player.fullName || player.name) === name;
    const samePhone = phone !== "" && normalizePlayerPhone(player.phoneNumber) === phone;
    return name && phone ? sameName && samePhone : name ? sameName : samePhone;
  });
  if (matches.length > 1) return { ambiguous: true };
  return { player: matches[0], ambiguous: false };
}
