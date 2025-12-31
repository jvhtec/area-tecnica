import React, { useMemo, useState } from "react";
import { CloudIcon, Loader2, RefreshCw, AlertCircle } from "lucide-react";

import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WeatherData } from "@/types/hoja-de-ruta";
import { useWeatherData } from "@/hooks/useWeatherData";

interface JobDetailsWeatherTabProps {
  jobDetails: any;
  isJobLoading: boolean;
}

export const JobDetailsWeatherTab: React.FC<JobDetailsWeatherTabProps> = ({ jobDetails, isJobLoading }) => {
  const [weatherData, setWeatherData] = useState<WeatherData[] | undefined>(undefined);

  const eventDatesString = useMemo(() => {
    if (!jobDetails?.start_time || !jobDetails?.end_time) return "";
    const start = new Date(jobDetails.start_time);
    const end = new Date(jobDetails.end_time);
    const startStr = start.toLocaleDateString("en-GB");
    const endStr = end.toLocaleDateString("en-GB");
    if (start.toDateString() !== end.toDateString()) {
      return `${startStr} - ${endStr}`;
    }
    return startStr;
  }, [jobDetails?.start_time, jobDetails?.end_time]);

  const weatherVenue = useMemo(() => {
    const loc = jobDetails?.locations;
    return {
      address: loc?.formatted_address || loc?.name,
      coordinates:
        loc?.latitude && loc?.longitude
          ? {
            lat: typeof loc.latitude === "number" ? loc.latitude : parseFloat(loc.latitude),
            lng: typeof loc.longitude === "number" ? loc.longitude : parseFloat(loc.longitude),
          }
          : undefined,
    };
  }, [jobDetails?.locations]);

  const { isLoading: isWeatherLoading, error: weatherError, fetchWeather } = useWeatherData({
    venue: weatherVenue,
    eventDates: eventDatesString,
    onWeatherUpdate: setWeatherData,
  });

  return (
    <TabsContent value="weather" className="space-y-4 min-w-0 overflow-x-hidden">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <CloudIcon className="h-4 w-4" />
            Pronóstico del Tiempo
          </h3>
          {!isJobLoading && weatherVenue.address && eventDatesString && (
            <Button
              variant="outline"
              size="sm"
              onClick={fetchWeather}
              disabled={isWeatherLoading}
              className="flex items-center gap-1"
            >
              {isWeatherLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isWeatherLoading ? "Cargando..." : "Actualizar"}
            </Button>
          )}
        </div>

        {isJobLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : !weatherVenue.address && !weatherVenue.coordinates ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <AlertCircle className="h-4 w-4" />
            El pronóstico del tiempo requiere ubicación del lugar
          </div>
        ) : !eventDatesString ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <AlertCircle className="h-4 w-4" />
            El pronóstico del tiempo requiere fechas del evento
          </div>
        ) : weatherError ? (
          <div className="flex items-center gap-2 text-sm text-destructive py-4">
            <AlertCircle className="h-4 w-4" />
            {weatherError}
          </div>
        ) : isWeatherLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Obteniendo pronóstico del tiempo...
          </div>
        ) : weatherData && weatherData.length > 0 ? (
          <div className="space-y-2">
            {weatherData.map((weather, index) => {
              const getWeatherIcon = (condition: string) => {
                if (condition.toLowerCase().includes("sun")) return "☀️";
                if (condition.toLowerCase().includes("cloud")) return "☁️";
                if (condition.toLowerCase().includes("rain")) return "🌧️";
                if (condition.toLowerCase().includes("snow")) return "❄️";
                if (condition.toLowerCase().includes("storm")) return "⛈️";
                return "🌤️";
              };

              const formatDate = (dateStr: string) => {
                try {
                  const date = new Date(dateStr);
                  return date.toLocaleDateString("es-ES", {
                    month: "long",
                    day: "numeric",
                  });
                } catch {
                  return dateStr;
                }
              };

              return (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getWeatherIcon(weather.condition)}</span>
                    <div>
                      <div className="font-medium text-sm">
                        {formatDate(weather.date)} – {weather.condition}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round(weather.maxTemp)}°C / {Math.round(weather.minTemp)}°C
                        {weather.precipitationProbability > 0 && <span>, {weather.precipitationProbability}% lluvia</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="text-xs text-muted-foreground mt-4">
              <strong>Fuente:</strong> Los datos del tiempo se obtienen de Open-Meteo y se actualizan automáticamente.
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <CloudIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              Datos del tiempo no disponibles para las fechas y ubicación seleccionadas.
            </p>
          </div>
        )}
      </Card>
    </TabsContent>
  );
};

