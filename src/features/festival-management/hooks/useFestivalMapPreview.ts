import { useEffect, useState } from "react";

import { loadStaticMapPreviewUrl } from "../commands";
import type { FestivalVenueData } from "../types";

export const useFestivalMapPreview = (venueData: FestivalVenueData) => {
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadStaticMap = async () => {
      try {
        if (!venueData.address && !venueData.coordinates) {
          setMapPreviewUrl(null);
          setIsMapLoading(false);
          return;
        }

        setIsMapLoading(true);
        const url = await loadStaticMapPreviewUrl(venueData);
        if (isMounted) {
          setMapPreviewUrl(url);
        }
      } catch (error: any) {
        console.warn("Failed to load static map preview:", error?.message || error);
        if (isMounted) {
          setMapPreviewUrl(null);
        }
      } finally {
        if (isMounted) {
          setIsMapLoading(false);
        }
      }
    };

    loadStaticMap();

    return () => {
      isMounted = false;
    };
  }, [venueData]);

  return { isMapLoading, mapPreviewUrl };
};
