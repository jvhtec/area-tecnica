interface WeatherData {
  date: string;
  condition: string;
  weatherCode: number;
  maxTemp: number;
  minTemp: number;
  precipitationProbability: number;
  icon: string;
}

interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

interface WeatherApiResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_mean: number[];
    weathercode: number[];
  };
  timezone: string;
}

// Weather code mappings from Open-Meteo
const WEATHER_CODES: Record<number, { condition: string; icon: string }> = {
  0: { condition: "Despejado", icon: "☀️" },
  1: { condition: "Mayormente despejado", icon: "🌤️" },
  2: { condition: "Parcialmente nublado", icon: "⛅" },
  3: { condition: "Nublado", icon: "☁️" },
  45: { condition: "Niebla", icon: "🌫️" },
  48: { condition: "Niebla con escarcha", icon: "🌫️" },
  51: { condition: "Llovizna ligera", icon: "🌦️" },
  53: { condition: "Llovizna moderada", icon: "🌦️" },
  55: { condition: "Llovizna intensa", icon: "🌧️" },
  61: { condition: "Lluvia ligera", icon: "🌧️" },
  63: { condition: "Lluvia moderada", icon: "🌧️" },
  65: { condition: "Lluvia intensa", icon: "⛈️" },
  71: { condition: "Nieve ligera", icon: "🌨️" },
  73: { condition: "Nieve moderada", icon: "❄️" },
  75: { condition: "Nieve intensa", icon: "❄️" },
  80: { condition: "Chubascos ligeros", icon: "🌦️" },
  81: { condition: "Chubascos moderados", icon: "🌧️" },
  82: { condition: "Chubascos intensos", icon: "⛈️" },
  95: { condition: "Tormenta", icon: "⛈️" },
  96: { condition: "Tormenta con granizo ligero", icon: "⛈️" },
  99: { condition: "Tormenta con granizo intenso", icon: "⛈️" }
};

// Cache for weather data (in-memory, per session)
const weatherCache = new Map<string, { data: WeatherData[]; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Cache for geocoding results
const geocodeCache = new Map<string, { data: GeocodeResult; timestamp: number }>();

/**
 * Geocode an address to coordinates using OpenStreetMap Nominatim API
 */
export const geocodeAddress = async (address: string): Promise<GeocodeResult | null> => {
  if (!address?.trim()) return null;

  const cacheKey = address.toLowerCase().trim();
  const cached = geocodeCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'HojaDeRuta-WeatherApp/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      const result: GeocodeResult = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display_name: data[0].display_name
      };
      
      // Cache the result
      geocodeCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

/**
 * Fetch weather data from Open-Meteo API
 */
const fetchWeatherFromApi = async (lat: number, lng: number, startDate: Date, endDate: Date): Promise<WeatherData[]> => {
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  // Use precipitation_sum instead of precipitation_probability_mean for better API compatibility
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto&start_date=${start}&end_date=${end}`;

  const response = await fetch(url);
  
  if (!response.ok) {
    let detail = '';
    try { detail = await response.text(); } catch {}
    throw new Error(`Weather API failed: ${response.status}${detail ? ` - ${detail}` : ''}`);
  }

  const data: WeatherApiResponse = await response.json();
  
  return data.daily.time.map((date, index) => {
    const weatherCode = data.daily.weathercode[index];
    const weatherInfo = WEATHER_CODES[weatherCode] || { condition: "Condiciones variables", icon: "🌤️" };
    
    return {
      date,
      condition: weatherInfo.condition,
      weatherCode,
      maxTemp: Math.round(data.daily.temperature_2m_max[index]),
      minTemp: Math.round(data.daily.temperature_2m_min[index]),
      // Approximate precipitation chance: 100% if any precipitation expected, otherwise 0%
      precipitationProbability: ((data as any).daily?.precipitation_sum?.[index] || 0) > 0 ? 100 : 0,
      icon: weatherInfo.icon
    };
  });
};

/**
 * Parse event dates string to extract date range
 */
export const parseEventDates = (eventDates: string): { startDate: Date; endDate: Date } | null => {
  if (!eventDates?.trim()) return null;

  try {
    // Handle various date formats
    const cleanDates = eventDates.trim();
    
    // Try to match different date patterns
    const singleDateMatch = cleanDates.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    const dateRangeMatch = cleanDates.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}).*?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    
    if (dateRangeMatch) {
      // Date range found
      const startDate = new Date(
        parseInt(dateRangeMatch[3]), 
        parseInt(dateRangeMatch[2]) - 1, 
        parseInt(dateRangeMatch[1])
      );
      const endDate = new Date(
        parseInt(dateRangeMatch[6]), 
        parseInt(dateRangeMatch[5]) - 1, 
        parseInt(dateRangeMatch[4])
      );
      return { startDate, endDate };
    } else if (singleDateMatch) {
      // Single date found
      const date = new Date(
        parseInt(singleDateMatch[3]), 
        parseInt(singleDateMatch[2]) - 1, 
        parseInt(singleDateMatch[1])
      );
      return { startDate: date, endDate: date };
    }
    
    // Try ISO format
    const isoDate = new Date(cleanDates);
    if (!isNaN(isoDate.getTime())) {
      return { startDate: isoDate, endDate: isoDate };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing event dates:', error);
    return null;
  }
};

/**
 * Get weather data for a job/event
 */
export const getWeatherForJob = async (
  venue: { address?: string; coordinates?: { lat: number; lng: number } },
  eventDates: string
): Promise<WeatherData[] | null> => {
  try {
    // Parse event dates
    const dateRange = parseEventDates(eventDates);
    if (!dateRange) {
      console.log('Could not parse event dates:', eventDates);
      return null;
    }

    // Respect forecast horizon (~16 days). If range starts beyond horizon, skip request.
    const today = new Date();
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 16);
    if (dateRange.startDate > horizon) {
      console.warn('Requested weather starts beyond available forecast horizon:', eventDates);
      return null;
    }
    // Clamp end date to horizon if needed
    if (dateRange.endDate > horizon) {
      dateRange.endDate = horizon;
    }

    let coordinates: { lat: number; lng: number } | null = null;

    // Use provided coordinates or geocode address
    if (venue.coordinates) {
      coordinates = venue.coordinates;
    } else if (venue.address) {
      const geocodeResult = await geocodeAddress(venue.address);
      if (geocodeResult) {
        coordinates = { lat: geocodeResult.lat, lng: geocodeResult.lng };
      }
    }

    if (!coordinates) {
      console.log('No coordinates available for weather lookup');
      return null;
    }

    // Check cache
    const cacheKey = `${coordinates.lat},${coordinates.lng},${dateRange.startDate.toISOString()},${dateRange.endDate.toISOString()}`;
    const cached = weatherCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    // Fetch weather data
    const weatherData = await fetchWeatherFromApi(
      coordinates.lat, 
      coordinates.lng, 
      dateRange.startDate, 
      dateRange.endDate
    );

    // Cache the result
    weatherCache.set(cacheKey, { data: weatherData, timestamp: Date.now() });
    
    return weatherData;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
};

/**
 * Format weather data for display
 */
export const formatWeatherDisplay = (weather: WeatherData[]): string => {
  if (!weather || weather.length === 0) return "Datos meteorológicos no disponibles";

  return weather.map(day => {
    const date = new Date(day.date);
    const formattedDate = date.toLocaleDateString('es-ES', { 
      month: 'long', 
      day: 'numeric' 
    });
    
    return `${formattedDate} – ${day.icon} ${day.condition}, ${day.maxTemp}°C / ${day.minTemp}°C, ${day.precipitationProbability}% probabilidad de lluvia`;
  }).join('\n');
};

/**
 * Format weather data for PDF generation
 */
export const formatWeatherForPdf = (weather: WeatherData[]): Array<[string, string, string, string]> => {
  if (!weather || weather.length === 0) {
    return [["Fecha", "Condición", "Temperatura", "Lluvia"], ["N/A", "Datos no disponibles", "N/A", "N/A"]];
  }

  const headers: [string, string, string, string] = ["Fecha", "Condición", "Temperatura", "Lluvia"];
  const rows = weather.map(day => {
    const date = new Date(day.date);
    const formattedDate = date.toLocaleDateString('es-ES', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
    });
    
    return [
      formattedDate,
      `${day.icon} ${day.condition}`,
      `${day.maxTemp}°C / ${day.minTemp}°C`,
      `${day.precipitationProbability}%`
    ] as [string, string, string, string];
  });

  return [headers, ...rows];
};
