/**
 * Utilidades para obtener datos de amanecer y atardecer
 * Usa la API gratuita de sunrise-sunset.org
 */

interface SunriseSunsetResponse {
  results: {
    sunrise: string;
    sunset: string;
    solar_noon: string;
    day_length: string;
    civil_twilight_begin: string;
    civil_twilight_end: string;
    nautical_twilight_begin: string;
    nautical_twilight_end: string;
    astronomical_twilight_begin: string;
    astronomical_twilight_end: string;
  };
  status: string;
}

interface SunTimes {
  sunrise: string; // HH:mm
  sunset: string; // HH:mm
  dayLength: string;
  solarNoon: string;
}

/**
 * Obtiene los tiempos de amanecer y atardecer para una ubicación y fecha
 * @param latitude Latitud
 * @param longitude Longitud
 * @param date Fecha (YYYY-MM-DD) - opcional, por defecto hoy
 * @returns Tiempos de amanecer y atardecer
 */
export async function getSunriseSunsetTimes(
  latitude: number,
  longitude: number,
  date?: string
): Promise<SunTimes | null> {
  try {
    const dateParam = date || new Date().toISOString().split('T')[0];
    const url = `https://api.sunrise-sunset.org/json?lat=${latitude}&lng=${longitude}&date=${dateParam}&formatted=0`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error('Error fetching sunrise/sunset data:', response.statusText);
      return null;
    }

    const data: SunriseSunsetResponse = await response.json();

    if (data.status !== 'OK') {
      console.error('API returned error status:', data.status);
      return null;
    }

    // Convertir tiempos UTC a hora local
    const sunrise = new Date(data.results.sunrise);
    const sunset = new Date(data.results.sunset);
    const solarNoon = new Date(data.results.solar_noon);

    return {
      sunrise: formatTime(sunrise),
      sunset: formatTime(sunset),
      dayLength: data.results.day_length,
      solarNoon: formatTime(solarNoon),
    };
  } catch (error) {
    console.error('Error getting sunrise/sunset times:', error);
    return null;
  }
}

/**
 * Formatea un objeto Date a HH:mm
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Calcula la posición del sol (aproximada) para una hora específica
 * @param latitude Latitud
 * @param longitude Longitud
 * @param dateTime Fecha y hora
 * @returns Elevación del sol en grados (negativo = debajo del horizonte)
 */
export function calculateSunElevation(
  latitude: number,
  longitude: number,
  dateTime: Date
): number {
  // Implementación simplificada del cálculo de elevación solar
  // Para producción, considerar usar una librería como suncalc

  const rad = Math.PI / 180;
  const lat = latitude * rad;

  // Día del año
  const start = new Date(dateTime.getFullYear(), 0, 0);
  const diff = dateTime.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  // Declinación solar (aproximada)
  const declination = 23.45 * Math.sin(rad * (360 / 365) * (dayOfYear - 81));
  const decRad = declination * rad;

  // Ángulo horario
  const hours = dateTime.getHours() + dateTime.getMinutes() / 60;
  const hourAngle = (hours - 12) * 15 * rad;

  // Elevación solar
  const elevation = Math.asin(
    Math.sin(lat) * Math.sin(decRad) +
    Math.cos(lat) * Math.cos(decRad) * Math.cos(hourAngle)
  );

  return elevation / rad; // Convertir a grados
}

/**
 * Determina si es de día o de noche en un momento dado
 */
export async function isDaytime(
  latitude: number,
  longitude: number,
  dateTime: Date
): Promise<boolean> {
  const date = dateTime.toISOString().split('T')[0];
  const sunTimes = await getSunriseSunsetTimes(latitude, longitude, date);

  if (!sunTimes) return true; // Asumir día si no se puede obtener data

  const currentTime = formatTime(dateTime);
  return currentTime >= sunTimes.sunrise && currentTime <= sunTimes.sunset;
}
