/**
 * Calculates new Elo ratings for two players after a match.
 * @param {number} rating1 - Current rating of player 1
 * @param {number} rating2 - Current rating of player 2
 * @param {number} score1 - Actual score of player 1 (1 for win, 0.5 for draw, 0 for loss)
 * @param {number} score2 - Actual score of player 2 (1 for win, 0.5 for draw, 0 for loss)
 * @param {number} kFactor - Maximum point change per game (default 32)
 * @returns {Array<number>} - New ratings [newRating1, newRating2]
 */
export function calculateElo(rating1, rating2, score1, score2, kFactor = 32) {
  // Expected scores
  const expected1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
  const expected2 = 1 / (1 + Math.pow(10, (rating1 - rating2) / 400));

  // New ratings
  const newRating1 = rating1 + kFactor * (score1 - expected1);
  const newRating2 = rating2 + kFactor * (score2 - expected2);

  return [Math.round(newRating1), Math.round(newRating2)];
}
