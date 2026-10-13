import React, { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { searchGooglePlaces, type GooglePlaceResult } from '@/services/googlePlaceSearch';

interface GooglePlaceAutocompleteProps {
  value: string;
  onSelect: (result: GooglePlaceResult) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  onBusyChange?: (busy: boolean) => void;
  onInputChange?: (value: string) => void;
}

/** Google venue-name search for job creation/editing. */
export function GooglePlaceAutocomplete({
  value, onSelect, placeholder = 'Buscar recinto por nombre o dirección',
  label = 'Ubicación', className, onBusyChange, onInputChange,
}: GooglePlaceAutocompleteProps) {
  const id = useId();
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState<GooglePlaceResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>();
  const controllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, GooglePlaceResult[]>());
  const requestRef = useRef(0);
  const busyCallbackRef = useRef(onBusyChange);
  busyCallbackRef.current = onBusyChange;

  useEffect(() => { setInputValue(value || ''); }, [value]);
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', outside);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.clearTimeout(timerRef.current);
      controllerRef.current?.abort();
      requestRef.current += 1;
      busyCallbackRef.current?.(false);
    };
  }, []);

  const setBusy = (busy: boolean) => {
    setIsLoading(busy);
    busyCallbackRef.current?.(busy);
  };
  const cancelSearch = () => {
    window.clearTimeout(timerRef.current);
    controllerRef.current?.abort();
    requestRef.current += 1;
    setBusy(false);
  };
  const search = async (query: string, requestId: number) => {
    const cached = cacheRef.current.get(query);
    if (cached) {
      setSuggestions(cached);
      setShowSuggestions(cached.length > 0);
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    try {
      const places = await searchGooglePlaces(query, controller.signal);
      if (requestRef.current !== requestId || controller.signal.aborted) return;
      // Keep only a small in-memory cache for the lifetime of this dialog.
      if (cacheRef.current.size >= 30) cacheRef.current.clear();
      cacheRef.current.set(query, places);
      setSuggestions(places);
      setShowSuggestions(places.length > 0);
    } catch {
      if (requestRef.current === requestId && !controller.signal.aborted) setError(true);
    } finally {
      if (requestRef.current === requestId && !controller.signal.aborted) setBusy(false);
    }
  };
  const changeInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    cancelSearch();
    setInputValue(nextValue);
    onInputChange?.(nextValue);
    setSuggestions([]);
    setShowSuggestions(false);
    setError(false);
    const query = nextValue.trim();
    if (query.length < 2) return;
    const requestId = requestRef.current;
    timerRef.current = window.setTimeout(() => { void search(query, requestId); }, 400);
  };
  const selectPlace = (place: GooglePlaceResult) => {
    cancelSearch();
    setInputValue(place.name);
    setShowSuggestions(false);
    onSelect(place);
  };

  return (
    <div className={className} ref={containerRef}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <Input
          id={id} value={inputValue} onChange={changeInput} placeholder={placeholder} className="pl-9"
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); }
          }}
          onFocus={() => { if (suggestions.length) setShowSuggestions(true); }}
        />
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
        {showSuggestions && (
          <Card className="absolute z-50 mt-1 w-full border-2 shadow-sm">
            <div className="max-h-64 overflow-auto py-1">
              {suggestions.map((place) => (
                <Button key={place.place_id} type="button" variant="ghost"
                  className="h-auto w-full justify-start px-3 py-2 text-left" onClick={() => selectPlace(place)}>
                  <div>
                    <div className="text-sm font-medium">{place.name}</div>
                    <div className="text-xs text-muted-foreground">{place.address}</div>
                  </div>
                </Button>
              ))}
            </div>
            <div className="px-3 py-1 text-xs text-muted-foreground">Google Maps</div>
          </Card>
        )}
      </div>
      {error && <p role="status" className="mt-1 text-sm text-destructive">
        No se pudo buscar la ubicación. Puedes introducir el recinto y la dirección manualmente.
      </p>}
    </div>
  );
}
