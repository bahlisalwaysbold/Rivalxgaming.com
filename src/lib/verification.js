const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

function yearsAgo(now, years) {
  return new Date(now.getTime() - years * YEAR_MS);
}

function isLossFor(playerId, match) {
  if (match.eliminated_id) return match.eliminated_id === playerId;
  return match.player_id === playerId && match.result === "L";
}

function winnerFor(match) {
  if (match.winner_id) return match.winner_id;
  return match.player_id && match.result === "W" ? match.player_id : null;
}

function isFinal(match) {
  const label = String(match.round || match.stage || "").trim().toLowerCase();
  return label === "final" || label === "the final";
}

export function hasLossSince(playerId, matches, since) {
  return matches.some((match) => {
    const playedAt = match.played_at ? new Date(match.played_at) : null;
    return playedAt && playedAt >= since && isLossFor(playerId, match);
  });
}

function completedMonthWindow(now, monthsAgo) {
  const anchor = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return {
    start: new Date(anchor.getFullYear(), anchor.getMonth(), 1),
    end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1),
  };
}

function monthlyPoints(players, matches, start, end) {
  const table = Object.fromEntries(players.map((p) => [p.id, { id: p.id, points: 0, wins: 0 }]));
  for (const match of matches) {
    const playedAt = match.played_at ? new Date(match.played_at) : null;
    if (!playedAt || playedAt < start || playedAt >= end) continue;
    const winnerId = winnerFor(match);
    if (!winnerId || !table[winnerId]) continue;
    table[winnerId].wins += 1;
    table[winnerId].points += 3;
    if (isFinal(match)) table[winnerId].points += 5;
  }
  return Object.values(table)
    .filter((player) => player.points > 0)
    .sort((a, b) => b.points - a.points || b.wins - a.wins);
}

export function qualifiesForBlueBadge(player, players, matches, now = new Date()) {
  const month1 = completedMonthWindow(now, 1);
  const month2 = completedMonthWindow(now, 2);
  const firstTop2 = monthlyPoints(players, matches, month1.start, month1.end).slice(0, 2).some((p) => p.id === player.id);
  const secondTop2 = monthlyPoints(players, matches, month2.start, month2.end).slice(0, 2).some((p) => p.id === player.id);
  return firstTop2 && secondTop2;
}

export function calculateAutomaticVerification(player, players, matches, now = new Date(), referralQualified = false) {
  if (!player?.created_at) return "none";
  const createdAt = new Date(player.created_at);
  if (Number.isNaN(createdAt.getTime())) return "none";

  const sixYearsAgo = yearsAgo(now, 6);
  if (createdAt <= sixYearsAgo && !hasLossSince(player.id, matches, sixYearsAgo)) return "red";

  const threeYearsAgo = yearsAgo(now, 3);
  if (createdAt <= threeYearsAgo && !hasLossSince(player.id, matches, threeYearsAgo)) return "gold";

  return referralQualified || qualifiesForBlueBadge(player, players, matches, now) ? "blue" : "none";
}

export function getEffectiveVerification(player, players, matches, now = new Date(), referralQualified = false) {
  return player?.verification_badge && player.verification_badge !== "none"
    ? player.verification_badge
    : calculateAutomaticVerification(player, players, matches, now, referralQualified);
}
