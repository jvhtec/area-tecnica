import React, { useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import {
  createSessionToken,
  getMapboxToken,
  searchBoxRetrieve,
  searchBoxSuggest,
} from '@/lib/mapbox/mapboxClient';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  id?: string;
}

interface PredictionItem {
  place_id: string;
  name: string;
  formatted_address: string;
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Unknown error';
};

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Introduce la dirección del recinto',
  label = 'Dirección',
  className,
  id,
}) => {
  const generatedId = useId();
  const inputId = id ?? `address-autocomplete-${generatedId}`;
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState<PredictionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const cacheRef = useRef<Record<string, PredictionItem[]>>({});
  const sessionTokenRef = useRef<string | null>(null);
  const activeSearchControllerRef = useRef<AbortController | null>(null);
  const latestSearchRequestIdRef = useRef(0);
  const hasShownAutocompleteErrorRef = useRef(false);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const fetchToken = async (): Promise<string | null> => {
    if (token) {
      return token;
    }

    try {
      const fetched = await getMapboxToken();
      if (fetched) {
        setToken((current) => current ?? fetched);
        return fetched;
      }
      notifyAutocompleteUnavailable(new Error('Mapbox token not configured'));
    } catch (err) {
      console.error('Error fetching Mapbox token:', err);
      notifyAutocompleteUnavailable(err);
    }

    return null;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }

      activeSearchControllerRef.current?.abort();
    };
  }, []);

  const ensureSessionToken = () => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = createSessionToken();
    }

    return sessionTokenRef.current;
  };

  const resetSessionToken = () => {
    sessionTokenRef.current = null;
  };

  const notifyAutocompleteUnavailable = (error: unknown) => {
    if (hasShownAutocompleteErrorRef.current) {
      return;
    }

    hasShownAutocompleteErrorRef.current = true;
    toast.error('Autocomplete unavailable', {
      description: `${getErrorMessage(error)}. You can keep typing manually.`,
    });
  };

  const searchAddresses = async (query: string) => {
    const trimmedQuery = query.trim();
    const requestId = latestSearchRequestIdRef.current + 1;
    latestSearchRequestIdRef.current = requestId;
    activeSearchControllerRef.current?.abort();
    activeSearchControllerRef.current = null;

    if (trimmedQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
      return;
    }

    if (cacheRef.current[trimmedQuery]) {
      setSuggestions(cacheRef.current[trimmedQuery]);
      setShowSuggestions(true);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    activeSearchControllerRef.current = controller;
    setIsLoading(true);

    try {
      const key = token || (await fetchToken());
      if (requestId !== latestSearchRequestIdRef.current || controller.signal.aborted) {
        return;
      }

      if (!key) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const suggestionsResult = await searchBoxSuggest(trimmedQuery, key, ensureSessionToken(), {
        language: 'es',
        types: 'address,street,place,locality,neighborhood,postcode',
        signal: controller.signal,
      });

      if (requestId !== latestSearchRequestIdRef.current || controller.signal.aborted) {
        return;
      }

      const results: PredictionItem[] = suggestionsResult.map((suggestion) => ({
        place_id: suggestion.mapboxId,
        name: suggestion.name || trimmedQuery,
        formatted_address: suggestion.fullAddress || suggestion.name || trimmedQuery,
      }));

      cacheRef.current[trimmedQuery] = results;
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      console.error('Error searching addresses:', error);
      setSuggestions([]);
      setShowSuggestions(false);
      notifyAutocompleteUnavailable(error);
    } finally {
      if (activeSearchControllerRef.current === controller) {
        activeSearchControllerRef.current = null;
      }

      if (requestId === latestSearchRequestIdRef.current && !controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  const getAddressDetails = async (
    mapboxId: string,
    fallbackName: string,
    fallbackAddress?: string,
  ) => {
    const key = token || (await fetchToken());

    if (!key) {
      const address = fallbackAddress || fallbackName;
      onChange(address);
      setInputValue(address);
      setShowSuggestions(false);
      resetSessionToken();
      return;
    }

    try {
      const place = await searchBoxRetrieve(mapboxId, key, ensureSessionToken());
      const address = place?.address || fallbackAddress || place?.name || fallbackName;

      onChange(address, place?.coordinates);
      setInputValue(address);
      setShowSuggestions(false);
    } catch (error) {
      console.error('Error fetching address details:', error);
      const address = fallbackAddress || fallbackName;
      onChange(address);
      setInputValue(address);
      setShowSuggestions(false);
      notifyAutocompleteUnavailable(error);
    } finally {
      resetSessionToken();
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setInputValue(nextValue);
    onChange(nextValue);

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    if (!nextValue.trim()) {
      activeSearchControllerRef.current?.abort();
      activeSearchControllerRef.current = null;
      latestSearchRequestIdRef.current += 1;
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
      resetSessionToken();
      return;
    }

    debounceRef.current = window.setTimeout(() => {
      searchAddresses(nextValue);
    }, 400);
  };

  const handleSelect = (item: PredictionItem) => {
    getAddressDetails(item.place_id, item.name, item.formatted_address);
  };

  return (
    <div className={className} ref={containerRef}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <div className="relative">
        <Input
          id={inputId}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="pl-9"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onFocus={() => {
            if (!token) {
              void fetchToken();
            }

            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
        />
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <Card className="absolute z-50 mt-1 w-full border-2 shadow-sm">
            <div className="max-h-64 overflow-auto py-1">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion.place_id}
                  variant="ghost"
                  type="button"
                  className="h-auto w-full justify-start px-3 py-2 text-left"
                  onClick={() => handleSelect(suggestion)}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <div className="text-sm font-medium">{suggestion.name}</div>
                      {suggestion.formatted_address && (
                        <div className="text-xs text-muted-foreground">{suggestion.formatted_address}</div>
                      )}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
