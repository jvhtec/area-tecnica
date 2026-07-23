import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { AlertTriangle, CloudRain, Globe, Loader2, Phone, RefreshCw, Utensils } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DetailsModalViewModel } from "@/components/technician/details-modal/useDetailsModalData";
import type { Restaurant } from "@/types/hoja-de-ruta";

type TabProps = {
  vm: DetailsModalViewModel;
};

const madridTimeZone = "Europe/Madrid";

const getSafeHttpUrl = (value?: string | null): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

export const RestaurantsTab = ({ vm }: TabProps) => {
  const { isDark, isRestaurantsLoading, job, jobDetails, jobDetailsLoading, restaurants, theme } = vm;

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-2 mb-2">
        <Utensils size={18} className={theme.textMuted} />
        <h3 className={`text-lg font-bold ${theme.textMain}`}>Restaurantes cercanos</h3>
      </div>

      {(jobDetailsLoading || isRestaurantsLoading) ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
          <p className={`text-sm ${theme.textMuted}`}>Buscando restaurantes cercanos...</p>
        </div>
      ) : restaurants && restaurants.length > 0 ? (
        <div className="space-y-3">
          {restaurants.map((restaurant: Restaurant) => {
            const websiteUrl = getSafeHttpUrl(restaurant.website);
            return (
              <div key={restaurant.id} className={`p-4 rounded-xl border ${theme.card}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className={`font-bold text-sm ${theme.textMain} truncate`}>{restaurant.name}</p>
                    <p className={`text-xs ${theme.textMuted} mt-1 line-clamp-2`}>{restaurant.address}</p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {restaurant.rating && <span className={`px-2 py-0.5 rounded text-xs font-bold ${isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"}`}>⭐ {restaurant.rating}</span>}
                      {restaurant.priceLevel !== undefined && <span className={`px-2 py-0.5 rounded text-xs font-bold ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>{"€".repeat(restaurant.priceLevel + 1)}</span>}
                      {restaurant.distance && <span className={`px-2 py-0.5 rounded text-xs font-bold ${isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"}`}>A {Math.round(restaurant.distance)} m</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {restaurant.phone && <a href={`tel:${restaurant.phone}`} aria-label={`Llamar a ${restaurant.name}`} className={`p-2 rounded-lg border ${theme.divider} hover:bg-white/5`}><Phone size={14} className={theme.textMuted} /></a>}
                    {websiteUrl && <a href={websiteUrl} target="_blank" rel="noopener noreferrer" aria-label={`Abrir sitio web de ${restaurant.name}`} className={`p-2 rounded-lg border ${theme.divider} hover:bg-white/5`}><Globe size={14} className={theme.textMuted} /></a>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`h-48 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
          <Utensils size={32} className="mb-2 opacity-50" />
          <span className="text-sm">{jobDetails?.locations?.formatted_address || jobDetails?.locations?.name ? "No se encontraron restaurantes cercanos" : "No hay dirección del recinto para buscar restaurantes"}</span>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => {
            const location = jobDetails?.locations?.formatted_address || jobDetails?.locations?.name || job?.location?.name || "";
            window.open(`https://www.google.com/maps/search/restaurants+near+${encodeURIComponent(location)}`, "_blank", "noopener,noreferrer");
          }}>
            <Globe size={14} className="mr-2" /> Buscar en Google Maps
          </Button>
        </div>
      )}
    </div>
  );
};

export const WeatherTab = ({ vm }: TabProps) => {
  const { eventDatesString, fetchWeather, isWeatherLoading, jobDetailsLoading, theme, weatherData, weatherError, weatherVenue } = vm;
  const hasWeatherLocation = Boolean(weatherVenue.address || weatherVenue.coordinates);

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2"><CloudRain size={18} className={theme.textMuted} /><h3 className={`text-lg font-bold ${theme.textMain}`}>Pronóstico del Tiempo</h3></div>
        {!jobDetailsLoading && hasWeatherLocation && eventDatesString && (
          <Button variant="outline" size="sm" onClick={fetchWeather} disabled={isWeatherLoading}>
            {isWeatherLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}
            {isWeatherLoading ? "Cargando..." : "Actualizar"}
          </Button>
        )}
      </div>

      {jobDetailsLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
      ) : !hasWeatherLocation ? (
        <div className={`flex items-center gap-2 text-sm ${theme.textMuted} py-4`}><AlertTriangle size={16} />El pronóstico del tiempo requiere ubicación del lugar</div>
      ) : !eventDatesString ? (
        <div className={`flex items-center gap-2 text-sm ${theme.textMuted} py-4`}><AlertTriangle size={16} />El pronóstico del tiempo requiere fechas del evento</div>
      ) : weatherError ? (
        <div className={`flex items-center gap-2 text-sm py-4 ${vm.isDark ? "text-red-400" : "text-red-600"}`}><AlertTriangle size={16} />{weatherError}</div>
      ) : isWeatherLoading ? (
        <div className={`flex items-center gap-2 text-sm ${theme.textMuted} py-4`}><Loader2 className="h-4 w-4 animate-spin" />Obteniendo pronóstico del tiempo...</div>
      ) : weatherData && weatherData.length > 0 ? (
        <div className="space-y-2">
          {weatherData.map((weather, index) => {
            const condition = weather.condition.toLowerCase();
            const weatherIcon = condition.includes("sun") ? "☀️" : condition.includes("cloud") ? "☁️" : condition.includes("rain") ? "🌧️" : condition.includes("snow") ? "❄️" : condition.includes("storm") ? "⛈️" : "🌤️";
            let weatherDate = weather.date;
            try { weatherDate = formatInTimeZone(weather.date, madridTimeZone, "d 'de' MMMM", { locale: es }); } catch { /* retain source date */ }
            return (
              <div key={index} className={`flex items-center justify-between p-4 rounded-xl ${vm.isDark ? "bg-white/5" : "bg-slate-100"}`}>
                <div className="flex items-center gap-3"><span className="text-2xl">{weatherIcon}</span><div>
                  <div className={`font-bold text-sm ${theme.textMain}`}>{weatherDate} – {weather.condition}</div>
                  <div className={`text-xs ${theme.textMuted}`}>{Math.round(weather.maxTemp)}°C / {Math.round(weather.minTemp)}°C{weather.precipitationProbability > 0 && <span>, {weather.precipitationProbability}% lluvia</span>}</div>
                </div></div>
              </div>
            );
          })}
          <div className={`text-xs ${theme.textMuted} mt-4`}><strong>Fuente:</strong> Los datos del tiempo se obtienen de Open-Meteo y se actualizan automáticamente.</div>
        </div>
      ) : (
        <div className={`h-48 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
          <CloudRain size={32} className="mb-2 opacity-50" /><span className="text-sm text-center">Datos del tiempo no disponibles para las fechas y ubicación seleccionadas.</span>
          <Button variant="outline" size="sm" className="mt-4" onClick={fetchWeather} disabled={isWeatherLoading}><RefreshCw size={14} className="mr-2" /> Obtener pronóstico</Button>
        </div>
      )}
    </div>
  );
};
