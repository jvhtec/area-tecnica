import type { SoundVisionFile } from "@/hooks/useSoundVisionFiles";

export interface VenueGroup {
  venue: NonNullable<SoundVisionFile["venue"]>;
  fileCount: number;
  ratingsCount: number;
  ratingTotal: number;
}
