import type { ArtistGearComparison } from "./types";

export const getMismatchSummary = (comparisons: ArtistGearComparison[]) => {
  const totalArtists = comparisons.length;
  const artistsWithConflicts = comparisons.filter(c => c.hasConflicts).length;
  const totalErrors = comparisons.reduce((sum, c) => sum + c.mismatches.filter(m => m.severity === 'error').length, 0);
  const totalWarnings = comparisons.reduce((sum, c) => sum + c.mismatches.filter(m => m.severity === 'warning').length, 0);
  
  const conflicts = comparisons
    .filter(c => c.hasConflicts)
    .map(c => ({
      artist: c.artistName,
      stage: c.stage,
      mismatches: c.mismatches
    }));

  return {
    totalArtists,
    artistsWithConflicts,
    totalErrors,
    totalWarnings,
    conflicts
  };
};
