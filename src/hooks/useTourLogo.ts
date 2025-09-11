import { useState, useEffect } from 'react';
import { logoCache } from '@/services/logoCache';

export const useTourLogo = (tourId: string) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tourId) return;

    setIsLoading(true);
    setError(null);

    logoCache.getTourLogo(tourId)
      .then((url) => {
        setLogoUrl(url);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn(`Failed to load logo for tour ${tourId}:`, err);
        setError(err.message);
        setLogoUrl(null);
        setIsLoading(false);
      });
  }, [tourId]);

  return { logoUrl, isLoading, error };
};