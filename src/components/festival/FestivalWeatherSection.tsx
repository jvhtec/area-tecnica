import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CloudIcon, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { useWeatherData } from '@/hooks/useWeatherData';
import { WeatherData } from '@/types/hoja-de-ruta';
import { useState } from 'react';
import { motion } from 'framer-motion';

interface FestivalWeatherSectionProps {
  jobId: string;
  venue?: {
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  jobDates: Date[];
}

export const FestivalWeatherSection: React.FC<FestivalWeatherSectionProps> = ({
  jobId,
  venue = {},
  jobDates
}) => {
  const [weatherData, setWeatherData] = useState<WeatherData[] | undefined>(undefined);
  
  const eventDatesString = jobDates.length > 0 
    ? jobDates.length === 1
      ? jobDates[0].toISOString().split('T')[0].split('-').reverse().join('/')
      : `${jobDates[0].toISOString().split('T')[0].split('-').reverse().join('/')} - ${jobDates[jobDates.length - 1].toISOString().split('T')[0].split('-').reverse().join('/')}`
    : '';

  const { isLoading, error, lastFetch, fetchWeather } = useWeatherData({
    venue,
    eventDates: eventDatesString,
    onWeatherUpdate: setWeatherData
  });

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  const getWeatherIcon = (condition: string) => {
    if (condition.toLowerCase().includes('sun')) return '☀️';
    if (condition.toLowerCase().includes('cloud')) return '☁️';
    if (condition.toLowerCase().includes('rain')) return '🌧️';
    if (condition.toLowerCase().includes('snow')) return '❄️';
    if (condition.toLowerCase().includes('storm')) return '⛈️';
    return '🌤️';
  };

  const hasValidData = venue.address || venue.coordinates;
  const canFetchWeather = hasValidData && jobDates.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <CloudIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              Weather Forecast
            </CardTitle>
            {canFetchWeather && (
              <Button
                variant="outline"
                size="sm"
                onClick={fetchWeather}
                disabled={isLoading}
                className="flex items-center gap-1 w-fit"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {isLoading ? 'Loading...' : 'Refresh'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!canFetchWeather ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Weather forecast requires venue location and event dates
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching weather forecast...
            </div>
          ) : weatherData && weatherData.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {weatherData.map((weather, index) => (
                <div key={index} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-xl sm:text-2xl">{getWeatherIcon(weather.condition)}</span>
                    <div>
                      <div className="font-medium text-sm sm:text-base">
                        {formatDate(weather.date)} – {weather.condition}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {Math.round(weather.maxTemp)}°C / {Math.round(weather.minTemp)}°C
                        {weather.precipitationProbability > 0 && (
                          <span>, {weather.precipitationProbability}% rain</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="text-xs text-muted-foreground mt-4 space-y-1">
                <p>
                  <strong>Tip:</strong> Weather data is fetched from Open-Meteo and updates automatically.
                </p>
                {lastFetch && (
                  <p>Last updated: {lastFetch.toLocaleString()}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Weather data not available for the selected dates and location.
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};