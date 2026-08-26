import React from 'react';

import { BREAKPOINTS } from '@/hooks/use-mobile';

export const useDebouncedMatrixSearch = (searchTerm: string) => {
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  React.useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(searchTerm.trim().toLowerCase()), 150);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  return debouncedSearch;
};

// Matches the app-wide mobile breakpoint (`useIsMobile`), so the matrix does not
// flip to its compact layout one pixel earlier than the rest of the UI.
const detectMatrixMobile = () =>
  typeof window !== 'undefined' && window.innerWidth < BREAKPOINTS.md;

export const useIsMatrixMobile = () => {
  // Resolved during the first render: the matrix sizes its cells from this, and
  // a desktop-then-mobile flip would leave the initial scroll-to-today off.
  const [isMobile, setIsMobile] = React.useState<boolean>(detectMatrixMobile);

  React.useEffect(() => {
    const update = () => setIsMobile(detectMatrixMobile());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return isMobile;
};
