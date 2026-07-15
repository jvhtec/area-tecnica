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
    precipitation_sum?: number[];
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
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  // Use precipitation_sum instead of precipitation_probability_mean for better API compatibility
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto&start_date=${start}&end_date=${end}`;

  const response = await fetch(url);
  
  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      detail = '';
    }
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
      precipitationProbability: (data.daily.precipitation_sum?.[index] || 0) > 0 ? 100 : 0,
      icon: weatherInfo.icon
    };
  });
};

const SPANISH_MONTHS: Record<string, number> = {
  enero: 0,
  ene: 0,
  febrero: 1,
  feb: 1,
  marzo: 2,
  mar: 2,
  abril: 3,
  abr: 3,
  mayo: 4,
  may: 4,
  junio: 5,
  jun: 5,
  julio: 6,
  jul: 6,
  agosto: 7,
  ago: 7,
  septiembre: 8,
  setiembre: 8,
  sep: 8,
  set: 8,
  octubre: 9,
  oct: 9,
  noviembre: 10,
  nov: 10,
  diciembre: 11,
  dic: 11,
};

const normalizeMonthName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const parseYear = (value: string): number => {
  const year = Number(value);
  return value.length === 2 ? 2000 + year : year;
};

const createLocalDate = (year: number, monthIndex: number, day: number): Date | null => {
  const date = new Date(year, monthIndex, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
};

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const buildDateRange = (startDate: Date | null, endDate: Date | null) => {
  if (!startDate || !endDate) return null;

  const start = startOfLocalDay(startDate);
  const end = startOfLocalDay(endDate);
  if (end < start) return null;

  return { startDate: start, endDate: end };
};

const parseIsoDates = (value: string) => {
  const matches = Array.from(value.matchAll(/(?:^|[^\d])(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/g));
  if (matches.length === 0) return null;

  const dates = matches
    .slice(0, 2)
    .map((match) => createLocalDate(Number(match[1]), Number(match[2]) - 1, Number(match[3])));

  return buildDateRange(dates[0], dates[1] ?? dates[0]);
};

const parseNumericDates = (value: string) => {
  const matches = Array.from(value.matchAll(/(?:^|[^\d])(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?!\d)/g));
  if (matches.length === 0) return null;

  const dates = matches
    .slice(0, 2)
    .map((match) => createLocalDate(parseYear(match[3]), Number(match[2]) - 1, Number(match[1])));

  return buildDateRange(dates[0], dates[1] ?? dates[0]);
};

const parseSpanishMonthDates = (value: string) => {
  const dayRangeMatch = value.match(
    /(?:^|[^\d])(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+(?:de\s+)?([a-záéíóúüñ]+)\s+(?:de\s+)?(\d{2}|\d{4})(?!\d)/i
  );
  if (dayRangeMatch) {
    const monthIndex = SPANISH_MONTHS[normalizeMonthName(dayRangeMatch[3])];
    if (monthIndex == null) return null;

    return buildDateRange(
      createLocalDate(parseYear(dayRangeMatch[4]), monthIndex, Number(dayRangeMatch[1])),
      createLocalDate(parseYear(dayRangeMatch[4]), monthIndex, Number(dayRangeMatch[2]))
    );
  }

  const singleDateMatch = value.match(
    /(?:^|[^\d])(\d{1,2})\s+(?:de\s+)?([a-záéíóúüñ]+)\s+(?:de\s+)?(\d{2}|\d{4})(?!\d)/i
  );
  if (!singleDateMatch) return null;

  const monthIndex = SPANISH_MONTHS[normalizeMonthName(singleDateMatch[2])];
  if (monthIndex == null) return null;

  const date = createLocalDate(parseYear(singleDateMatch[3]), monthIndex, Number(singleDateMatch[1]));
  return buildDateRange(date, date);
};

/**
 * Parse event dates string to extract date range
 */
export const parseEventDates = (eventDates: string): { startDate: Date; endDate: Date } | null => {
  if (!eventDates?.trim()) return null;

  try {
    const cleanDates = eventDates.trim();
    return parseIsoDates(cleanDates) ??
      parseNumericDates(cleanDates) ??
      parseSpanishMonthDates(cleanDates);
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

    // Respect forecast horizon (~16 days). Open-Meteo forecast does not serve old event dates.
    const today = startOfLocalDay(new Date());
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 16);

    if (dateRange.endDate < today) {
      console.warn('Requested weather ends before available forecast window:', eventDates);
      return null;
    }

    if (dateRange.startDate < today) {
      dateRange.startDate = today;
    }

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
      day.condition,
      `${day.maxTemp}°C / ${day.minTemp}°C`,
      `${day.precipitationProbability}%`
    ] as [string, string, string, string];
  });

  return [headers, ...rows];
};
