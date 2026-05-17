import React from 'react';

export const useDebouncedMatrixSearch = (searchTerm: string) => {
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  React.useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(searchTerm.trim().toLowerCase()), 150);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  return debouncedSearch;
};

export const useIsMatrixMobile = () => {
  const [isMobile, setIsMobile] = React.useState<boolean>(false);

  React.useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return isMobile;
};
