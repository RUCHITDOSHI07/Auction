export function areAllAuctionTeamsFull(
  teams: readonly { playersCount: number }[],
  configuredTeamCount: number,
  maximumSquadSize: number,
): boolean {
  return configuredTeamCount > 0
    && teams.length === configuredTeamCount
    && teams.every((team) => team.playersCount >= maximumSquadSize);
}
