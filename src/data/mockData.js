// Replace this file's contents with real data fetched from Supabase
// once your database tables are set up (see src/lib/supabase.js).

export const tournaments = [
  {
    id: "t1",
    name: "Rival X Weekender Cup",
    game: "eFootball",
    entryFee: 2000, // in Naira
    format: "1v1 knockout",
    slots: 32,
    slotsFilled: 21,
    startDate: "2026-09-13",
    rules:
      "Single elimination. Home and away legs. Extra time + penalties if level on aggregate.",
  },
  {
    id: "t2",
    name: "Midweek Blitz",
    game: "eFootball",
    entryFee: 1000,
    format: "1v1 group stage",
    slots: 16,
    slotsFilled: 9,
    startDate: "2026-09-05",
    rules: "Round robin groups of 4, top 2 advance to knockout.",
  },
];

export const leaderboard = [
  { rank: 1, tag: "Shadowstrike", wins: 31, losses: 16, points: 93 },
  { rank: 2, tag: "IronWolf99", wins: 28, losses: 12, points: 84 },
  { rank: 3, tag: "CrimsonAce", wins: 25, losses: 14, points: 75 },
  { rank: 4, tag: "NightMarket", wins: 22, losses: 18, points: 66 },
  { rank: 5, tag: "PaleHorse", wins: 19, losses: 20, points: 57 },
];

export const currentPlayer = {
  tag: "Shadowstrike",
  stats: [
    { label: "Matches", value: "47" },
    { label: "Wins", value: "31" },
    { label: "Win rate", value: "66%" },
    { label: "Tournaments", value: "6" },
  ],
  matches: [
    { opp: "IRON WOLVES", result: "W", score: "4 – 1", date: "Aug 29" },
    { opp: "NIGHT MARKET FC", result: "W", score: "2 – 0", date: "Aug 22" },
    { opp: "CRIMSON UNITED", result: "L", score: "1 – 3", date: "Aug 15" },
  ],
};
