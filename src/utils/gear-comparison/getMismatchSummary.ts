import type { ArtistGearComparison } from "@/utils/gear-comparison/types";

export const getMismatchSummary = (comparisons: ArtistGearComparison[]) => {
  const totalArtists = comparisons.length;
  let artistsWithConflicts = 0;
  let totalErrors = 0;
  let totalWarnings = 0;
  const conflicts: Array<{
    artist: string;
    stage: number;
    mismatches: ArtistGearComparison["mismatches"];
  }> = [];

  for (const comparison of comparisons) {
    if (comparison.hasConflicts) {
      artistsWithConflicts += 1;
      conflicts.push({
        artist: comparison.artistName,
        stage: comparison.stage,
        mismatches: comparison.mismatches
      });
    }

    for (const mismatch of comparison.mismatches) {
      if (mismatch.severity === "error") {
        totalErrors += 1;
      } else if (mismatch.severity === "warning") {
        totalWarnings += 1;
      }
    }
  }

  return {
    totalArtists,
    artistsWithConflicts,
    totalErrors,
    totalWarnings,
    conflicts
  };
};
