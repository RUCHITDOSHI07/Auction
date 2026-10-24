export function orderAuctionPlayers<T extends { category?: unknown }>(
  players: readonly T[],
  random: () => number = Math.random,
): T[] {
  const premiumPlayers: T[] = [];
  const generalAndUncategorized: T[] = [];

  for (const player of players) {
    const category = typeof player.category === "string" ? player.category.trim().toUpperCase() : "";
    if (category === "A" || category === "B" || category === "C") {
      premiumPlayers.push(player);
    } else {
      generalAndUncategorized.push(player);
    }
  }

  shuffle(premiumPlayers, random);
  shuffle(generalAndUncategorized, random);

  return [...premiumPlayers, ...generalAndUncategorized];
}

function shuffle<T>(items: T[], random: () => number) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}
