import { useState, useEffect, useCallback } from 'react';
import { getWeatherForJob, parseEventDates } from '@/utils/weather/weatherApi';
import { WeatherData } from '@/types/hoja-de-ruta';

interface UseWeatherDataProps {
  venue: {
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  eventDates: string;
  onWeatherUpdate: (weather: WeatherData[] | undefined) => void;
}

export const useWeatherData = ({ venue, eventDates, onWeatherUpdate }: UseWeatherDataProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchWeather = useCallback(async () => {
    if (!eventDates || (!venue.address && !venue.coordinates)) {
      setError("Se requieren fechas del evento y ubicación para obtener el clima");
      return null;
    }

    // Check forecast horizon (~16 days ahead) and notify if out of range
    try {
      const range = parseEventDates(eventDates);
      if (range) {
        const today = new Date();
        const horizon = new Date(today);
        horizon.setDate(horizon.getDate() + 16);
        if (range.startDate > horizon) {
          const msg = `Requested weather starts beyond available forecast horizon: ${eventDates}`;
          setError(msg);
          onWeatherUpdate(undefined);
          return null;
        }
      }
    } catch {}

    setIsLoading(true);
    setError(null);

    try {
      const weatherData = await getWeatherForJob(venue, eventDates);
      
      onWeatherUpdate(weatherData || undefined);
      setLastFetch(new Date());
      
      if (!weatherData) {
        setError("No se pudieron obtener datos meteorológicos para esta ubicación y fecha");
      }
      
      return weatherData;
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError("Error al obtener datos meteorológicos. Verifique la conexión a internet.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [venue.address, venue.coordinates, eventDates, onWeatherUpdate]);

  // Auto-fetch weather when dependencies change
  useEffect(() => {
    const shouldFetch = eventDates && (venue.address || venue.coordinates) && !isLoading;
    
    if (shouldFetch) {
      // Debounce the API call to avoid too many requests
      const timeoutId = setTimeout(() => {
        fetchWeather();
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [fetchWeather, eventDates, venue.address, venue.coordinates?.lat, venue.coordinates?.lng, isLoading]);

  return {
    isLoading,
    error,
    lastFetch,
    fetchWeather
  };
};
