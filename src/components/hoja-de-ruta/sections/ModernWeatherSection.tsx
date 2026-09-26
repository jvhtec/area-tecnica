import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { CloudSun, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { getWeatherForJob } from "@/utils/weather/weatherApi";
import type { EventData } from "@/types/hoja-de-ruta";
import { PrintSectionExclusionToggle } from "../components/PrintSectionExclusionToggle";
import type { HojaDeRutaPrintSectionId } from "@/utils/hoja-de-ruta/pdf";
import { formatInTimeZone } from "date-fns-tz";
import { reportHojaError } from "@/features/hoja-de-ruta/lib/hojaLogger";

interface ModernWeatherSectionProps {
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
  isReadOnly?: boolean;
  isPrintSectionExcluded: (sectionId: HojaDeRutaPrintSectionId) => boolean;
  onPrintSectionExcludedChange: (sectionId: HojaDeRutaPrintSectionId, isExcluded: boolean) => void;
}

const WEATHER_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const WEATHER_FORECAST_HORIZON_DAYS = 16;
const MADRID_TIMEZONE = "Europe/Madrid";

export const ModernWeatherSection: React.FC<ModernWeatherSectionProps> = ({
  eventData,
  setEventData,
  isReadOnly = false,
  isPrintSectionExcluded,
  onPrintSectionExcludedChange,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(() => {
    const date = eventData.weatherFetchedAt ? new Date(eventData.weatherFetchedAt) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  });
  const lastAutomaticAttemptRef = useRef("");

  const isInsideForecastHorizon = useMemo(() => {
    const start = eventData.eventStartDate;
    const end = eventData.eventEndDate || start;
    if (!start || !end) return false;

    const today = formatInTimeZone(new Date(), MADRID_TIMEZONE, "yyyy-MM-dd");
    const horizon = formatInTimeZone(
      new Date(Date.now() + (WEATHER_FORECAST_HORIZON_DAYS - 1) * 24 * 60 * 60 * 1000),
      MADRID_TIMEZONE,
      "yyyy-MM-dd",
    );
    return start <= horizon && end >= today;
  }, [eventData.eventEndDate, eventData.eventStartDate]);

  const isWeatherStale = useMemo(() => {
    if (!eventData.weather?.length || !eventData.weatherFetchedAt) return true;
    const fetchedAt = new Date(eventData.weatherFetchedAt).getTime();
    return !Number.isFinite(fetchedAt) || Date.now() - fetchedAt >= WEATHER_MAX_AGE_MS;
  }, [eventData.weather, eventData.weatherFetchedAt]);

  useEffect(() => {
    const date = eventData.weatherFetchedAt ? new Date(eventData.weatherFetchedAt) : null;
    setLastFetch(date && !Number.isNaN(date.getTime()) ? date : null);
  }, [eventData.weatherFetchedAt]);

  const fetchWeather = useCallback(async () => {
    if (isReadOnly) return;
    if (!eventData.eventDates || (!eventData.venue.address && !eventData.venue.coordinates)) {
      setError("Se requieren fechas del evento y ubicación del venue para obtener el clima");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const weatherData = await getWeatherForJob(eventData.venue, eventData.eventDates);
      
      const fetchedAt = new Date();
      setEventData(prev => ({
        ...prev,
        weather: weatherData || undefined,
        weatherFetchedAt: weatherData?.length ? fetchedAt.toISOString() : prev.weatherFetchedAt,
      }));

      setLastFetch(weatherData?.length ? fetchedAt : null);
      
      if (!weatherData) {
        setError("No se pudieron obtener datos meteorológicos para esta ubicación y fecha");
      }
    } catch (err) {
      reportHojaError("weather.fetch", err);
      setError("Error al obtener datos meteorológicos. Verifique la conexión a internet.");
    } finally {
      setIsLoading(false);
    }
  }, [eventData.eventDates, eventData.venue, isReadOnly, setEventData]);

  const automaticAttemptKey = useMemo(() => JSON.stringify([
    eventData.eventDates || "",
    eventData.venue.address || "",
    eventData.venue.coordinates || null,
  ]), [eventData.eventDates, eventData.venue.address, eventData.venue.coordinates]);

  // Refresh only when Open-Meteo can actually forecast the event, and only
  // when the saved forecast is missing or older than 12 hours.
  useEffect(() => {
    if (
      !isReadOnly
      && eventData.eventDates
      && (eventData.venue.address || eventData.venue.coordinates)
      && isInsideForecastHorizon
      && isWeatherStale
      && !isLoading
      && lastAutomaticAttemptRef.current !== automaticAttemptKey
    ) {
      lastAutomaticAttemptRef.current = automaticAttemptKey;
      void fetchWeather();
    }
  }, [
    eventData.eventDates,
    eventData.venue.address,
    eventData.venue.coordinates,
    fetchWeather,
    automaticAttemptKey,
    isInsideForecastHorizon,
    isReadOnly,
    isLoading,
    isWeatherStale,
  ]);

  const hasWeatherData = eventData.weather && eventData.weather.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <Card className="border-2 border-info/30 bg-gradient-to-br from-info/10 to-info/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-info">
              <CloudSun className="w-5 h-5" />
              Previsión Meteorológica
            </CardTitle>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <PrintSectionExclusionToggle
                sectionId="weather"
                isExcluded={isPrintSectionExcluded("weather")}
                onExcludedChange={onPrintSectionExcludedChange}
              />
              {lastFetch && (
                <Badge variant="outline" className="text-xs">
                  Actualizado: {lastFetch.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </Badge>
              )}
              <Button
                onClick={fetchWeather}
                disabled={
                  isReadOnly
                  || isLoading
                  || !eventData.eventDates
                  || (!eventData.venue.address && !eventData.venue.coordinates)
                }
                variant="outline"
                size="sm"
                className="text-info border-info/40 hover:bg-info/10"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-info" />
                <p className="text-sm text-muted-foreground">Obteniendo datos meteorológicos...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <p className="text-sm text-warning">{error}</p>
            </div>
          )}

          {hasWeatherData && !isLoading && (
            <div className="space-y-3">
              <div className="grid gap-2">
                {eventData.weather!.map((day, index) => {
                  const date = new Date(day.date);
                  const formattedDate = date.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                  });

                  return (
                    <motion.div
                      key={day.date}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-3 bg-card rounded-lg border border-info/20 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{day.icon}</span>
                        <div>
                          <p className="font-medium text-foreground capitalize">{formattedDate}</p>
                          <p className="text-sm text-muted-foreground">{day.condition}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg text-foreground">
                            {day.maxTemp}°C
                          </span>
                          <span className="text-muted-foreground">
                            / {day.minTemp}°C
                          </span>
                        </div>
                        {day.precipitationProbability > 0 && (
                          <p className="text-xs text-info">
                            🌧️ {day.precipitationProbability}%
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="p-3 bg-info/10 border border-info/30 rounded-lg">
                <p className="text-xs text-info">
                  💡 <strong>Tip:</strong> Los datos meteorológicos se actualizan automáticamente y se incluirán en el PDF generado.
                  Fuente: Open-Meteo API
                </p>
              </div>
            </div>
          )}

          {!hasWeatherData && !isLoading && !error && (
            <div className="text-center py-6 text-muted-foreground">
              <CloudSun className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {!eventData.eventDates || (!eventData.venue.address && !eventData.venue.coordinates)
                  ? "Complete las fechas del evento y el nombre del venue en la sección 'Información del Evento' para ver la previsión meteorológica automáticamente"
                  : "Haga clic en actualizar para obtener la previsión meteorológica"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
