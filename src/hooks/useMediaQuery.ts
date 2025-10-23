import { useState, useEffect } from 'react';

/**
 * Custom hook that tracks whether a media query matches
 * @param query - The media query string to match
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    
    // Set initial value
    setMatches(mediaQuery.matches);

    // Create event listener function
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener
    mediaQuery.addEventListener('change', handler);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}

/**
 * Custom hook to detect if the viewport is mobile-sized
 * @returns boolean indicating if viewport matches mobile breakpoint
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)');
}
