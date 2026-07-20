/**
 * Convert raw Hive reputation or numeric score into standard Hive 25-100 reputation score.
 */
export function getReputationDetails(rep: any): { score: string; formatted: string } {
  if (rep === undefined || rep === null || rep === "") return { score: "25", formatted: "25.00" };
  const repNum = Number(rep);
  if (isNaN(repNum) || repNum === 0) return { score: "25", formatted: "25.00" };
  const neg = repNum < 0;
  const val = Math.abs(repNum);
  if (val < 1000) {
    return {
      score: Math.round(repNum).toString(),
      formatted: repNum.toFixed(2),
    };
  }
  let out = Math.log10(val);
  out = Math.max(out - 9, 0);
  const scoreNum = (neg ? -1 : 1) * out * 9 + 25;
  return {
    score: Math.round(scoreNum).toString(),
    formatted: scoreNum.toFixed(2),
  };
}

export function formatReputation(rep: any): string {
  return getReputationDetails(rep).score;
}

/**
 * Returns true if an author's reputation is negative.
 */
export function isNegativeReputation(rep: any): boolean {
  if (rep === undefined || rep === null || rep === '') return false;
  const repNum = Number(rep);
  if (isNaN(repNum) || repNum === 0) return false;
  if (repNum < 0) return true;
  const details = getReputationDetails(rep);
  const scoreNum = Number(details.score);
  const formattedNum = Number(details.formatted);
  return scoreNum < 0 || formattedNum < 0 || details.score.startsWith('-');
}
