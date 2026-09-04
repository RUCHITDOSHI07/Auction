import type { Activity, Auction, Bid, Player, Team } from "@/types/auction";

export const teams: Team[] = [
  { id: "north-stars", name: "North Stars", shortName: "NS", color: "#d9ef75", purse: 68, squadCount: 5, squadSize: 11, status: "Active", players: ["arjun-mehta"] },
  { id: "coastal-strikers", name: "Coastal Strikers", shortName: "CS", color: "#8fd7e7", purse: 54, squadCount: 6, squadSize: 11, status: "Active", players: ["maya-nair"] },
  { id: "redwood-royals", name: "Redwood Royals", shortName: "RR", color: "#f28b58", purse: 42, squadCount: 7, squadSize: 11, status: "Active", players: ["kabir-singh"] },
  { id: "city-lions", name: "City Lions", shortName: "CL", color: "#c4b8ed", purse: 76, squadCount: 4, squadSize: 11, status: "Active", players: ["zoya-khan"] },
  { id: "green-valley", name: "Green Valley", shortName: "GV", color: "#a8d5ad", purse: 31, squadCount: 8, squadSize: 11, status: "Active", players: [] },
];

export const players: Player[] = [
  { id: "arjun-mehta", name: "Arjun Mehta", initials: "AM", role: "All-rounder", category: "Marquee", age: 28, basePrice: 8, status: "SOLD", teamId: "north-stars", soldPrice: 21, batting: "Right hand", bowling: "Right-arm medium", accent: "#f1bf91" },
  { id: "maya-nair", name: "Maya Nair", initials: "MN", role: "Batter", category: "Marquee", age: 24, basePrice: 6, status: "SOLD", teamId: "coastal-strikers", soldPrice: 16, batting: "Left hand", bowling: "Part-time off-spin", accent: "#b7d8ca" },
  { id: "kabir-singh", name: "Kabir Singh", initials: "KS", role: "Fast bowler", category: "Capped", age: 31, basePrice: 5, status: "SOLD", teamId: "redwood-royals", soldPrice: 14, batting: "Right hand", bowling: "Right-arm fast", accent: "#d9ad9d" },
  { id: "zoya-khan", name: "Zoya Khan", initials: "ZK", role: "Wicketkeeper", category: "Capped", age: 26, basePrice: 4, status: "SOLD", teamId: "city-lions", soldPrice: 12, batting: "Right hand", bowling: "-", accent: "#d8c2e9" },
  { id: "dev-patel", name: "Dev Patel", initials: "DP", role: "Batter", category: "Emerging", age: 22, basePrice: 3, status: "ON_AUCTION", batting: "Right hand", bowling: "Off-spin", accent: "#e0c18e" },
  { id: "sana-iyer", name: "Sana Iyer", initials: "SI", role: "All-rounder", category: "Emerging", age: 23, basePrice: 3, status: "AVAILABLE", batting: "Left hand", bowling: "Left-arm orthodox", accent: "#d0b0a6" },
  { id: "rohan-das", name: "Rohan Das", initials: "RD", role: "Wicketkeeper", category: "Uncapped", age: 20, basePrice: 2, status: "UNSOLD", batting: "Right hand", bowling: "-", accent: "#a6c8d7" },
  { id: "anika-shah", name: "Anika Shah", initials: "AS", role: "Spin bowler", category: "Uncapped", age: 21, basePrice: 2, status: "AVAILABLE", batting: "Right hand", bowling: "Right-arm leg spin", accent: "#e5b7c7" },
];

export const auctions: Auction[] = [
  { id: "mens-2026", type: "men", name: "Men's Premier Auction", status: "IN_PROGRESS", round: 1, currentPlayerId: "dev-patel", currentBid: 11, highestTeamId: "city-lions", bidIncrement: 1, startingPurse: 100, squadSize: 11, totalPlayers: 32, soldPlayers: 4, unsoldPlayers: 1 },
  { id: "womens-2026", type: "women", name: "Women's Premier Auction", status: "READY", round: 1, currentPlayerId: "sana-iyer", currentBid: 3, highestTeamId: "coastal-strikers", bidIncrement: 1, startingPurse: 100, squadSize: 11, totalPlayers: 28, soldPlayers: 0, unsoldPlayers: 0 },
];

export const bids: Bid[] = [
  { id: "b1", teamId: "north-stars", amount: 8, time: "14:32:09" },
  { id: "b2", teamId: "redwood-royals", amount: 9, time: "14:32:23" },
  { id: "b3", teamId: "city-lions", amount: 10, time: "14:32:41" },
  { id: "b4", teamId: "city-lions", amount: 11, time: "14:33:02" },
];

export const activity: Activity[] = [
  { id: "a1", label: "Arjun Mehta sold", detail: "North Stars · 21 credits", time: "12 min ago", tone: "lime" },
  { id: "a2", label: "Round 1 started", detail: "Men's Premier Auction", time: "18 min ago", tone: "blue" },
  { id: "a3", label: "Maya Nair sold", detail: "Coastal Strikers · 16 credits", time: "24 min ago", tone: "orange" },
  { id: "a4", label: "Rohan Das unsold", detail: "Will return in Round 2", time: "31 min ago", tone: "blue" },
];

export const getPlayer = (id: string) => players.find((player) => player.id === id) ?? players[0];
export const getTeam = (id: string) => teams.find((team) => team.id === id) ?? teams[0];
