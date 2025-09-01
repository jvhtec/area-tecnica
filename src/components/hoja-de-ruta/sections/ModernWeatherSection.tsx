import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { CloudSun, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { getWeatherForJob, formatWeatherDisplay } from "@/utils/weather/weatherApi";
import { EventData, WeatherData } from "@/types/hoja-de-ruta";

interface ModernWeatherSectionProps {
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
}

export const ModernWeatherSection: React.FC<ModernWeatherSectionProps> = ({
  eventData,
  setEventData,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchWeather = async () => {
    if (!eventData.eventDates || (!eventData.venue.address && !eventData.venue.coordinates)) {
      setError("Se requieren fechas del evento y ubicación del venue para obtener el clima");
      return;
    }

    console.log('WeatherSection: Fetching weather for:', {
      eventDates: eventData.eventDates,
      venue: eventData.venue
    });

    setIsLoading(true);
    setError(null);

    try {
      const weatherData = await getWeatherForJob(eventData.venue, eventData.eventDates);
      
      console.log('WeatherSection: Received weather data:', weatherData);
      
      setEventData(prev => ({
        ...prev,
        weather: weatherData || undefined
      }));
      
      setLastFetch(new Date());
      
      if (!weatherData) {
        setError("No se pudieron obtener datos meteorológicos para esta ubicación y fecha");
      }
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError("Error al obtener datos meteorológicos. Verifique la conexión a internet.");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch weather when event data changes
  useEffect(() => {
    console.log('WeatherSection: Checking if should fetch weather:', {
      eventDates: eventData.eventDates,
      address: eventData.venue.address,
      coordinates: eventData.venue.coordinates,
      hasWeather: !!eventData.weather,
      isLoading
    });
    
    if (eventData.eventDates && (eventData.venue.address || eventData.venue.coordinates) && !eventData.weather && !isLoading) {
      console.log('WeatherSection: Auto-fetching weather...');
      fetchWeather();
    }
  }, [eventData.eventDates, eventData.venue.address, eventData.venue.coordinates?.lat, eventData.venue.coordinates?.lng]);

  const hasWeatherData = eventData.weather && eventData.weather.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <Card className="border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-sky-700">
              <CloudSun className="w-5 h-5" />
              Previsión Meteorológica
            </CardTitle>
            <div className="flex items-center gap-2">
              {lastFetch && (
                <Badge variant="outline" className="text-xs">
                  Actualizado: {lastFetch.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </Badge>
              )}
              <Button
                onClick={fetchWeather}
                disabled={isLoading || !eventData.eventDates || (!eventData.venue.address && !eventData.venue.coordinates)}
                variant="outline"
                size="sm"
                className="text-sky-600 border-sky-300 hover:bg-sky-50"
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
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-sky-600" />
                <p className="text-sm text-muted-foreground">Obteniendo datos meteorológicos...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p className="text-sm text-amber-700">{error}</p>
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
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-sky-100 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{day.icon}</span>
                        <div>
                          <p className="font-medium text-gray-900 capitalize">{formattedDate}</p>
                          <p className="text-sm text-gray-600">{day.condition}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg text-gray-900">
                            {day.maxTemp}°C
                          </span>
                          <span className="text-gray-500">
                            / {day.minTemp}°C
                          </span>
                        </div>
                        {day.precipitationProbability > 0 && (
                          <p className="text-xs text-blue-600">
                            🌧️ {day.precipitationProbability}%
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  💡 <strong>Tip:</strong> Los datos meteorológicos se actualizan automáticamente y se incluirán en el PDF generado.
                  Fuente: Open-Meteo API
                </p>
              </div>
            </div>
          )}

          {!hasWeatherData && !isLoading && !error && (
            <div className="text-center py-6 text-gray-500">
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