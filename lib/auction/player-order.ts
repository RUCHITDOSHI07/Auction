export function orderAuctionPlayers<T extends { category?: unknown }>(
  players: readonly T[],
  random: () => number = Math.random,
): T[] {
  const categories: Record<"A" | "B" | "C", T[]> = { A: [], B: [], C: [] };
  const generalAndUncategorized: T[] = [];

  for (const player of players) {
    const category = typeof player.category === "string" ? player.category.trim().toUpperCase() : "";
    if (category === "A" || category === "B" || category === "C") {
      categories[category].push(player);
    } else {
      generalAndUncategorized.push(player);
    }
  }

  for (let index = generalAndUncategorized.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [generalAndUncategorized[index], generalAndUncategorized[swapIndex]] = [
      generalAndUncategorized[swapIndex],
      generalAndUncategorized[index],
    ];
  }

  return [...categories.A, ...categories.B, ...categories.C, ...generalAndUncategorized];
}
