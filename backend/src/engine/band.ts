import type { OrderedBand } from '../kb/types';

/**
 * The band for a score: the last band (in ascending `min` order) whose `min` is at or below it.
 * A score above the top band's `max` stays in the top band and logs a warning; it never throws.
 */
export const findBand = (score: number, bands: readonly OrderedBand[]): OrderedBand => {
  const band = bands.findLast((b) => b.min <= score);
  // Unreachable from a real KB: the loader requires the lowest band to start at 0, and points are non-negative today.
  if (!band) throw new Error(`Score ${score} is below every band`);
  if (score > band.max) console.warn(JSON.stringify({ warning: 'score above top band max', score, band: band.id }));
  return band;
};
