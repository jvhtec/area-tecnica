/**
 * Utilidades para calcular distancias entre coordenadas geográficas
 */

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface DistanceResult {
  distance_km: number;
  distance_m: number;
  distance_mi: number;
}

interface DriveTimeEstimate {
  distance_km: number;
  estimated_drive_time_minutes: number;
  estimated_drive_time_formatted: string; // "Xh Ymin"
}

/**
 * Calcula la distancia entre dos puntos usando la fórmula de Haversine
 * @param point1 Primer punto (latitud, longitud)
 * @param point2 Segundo punto (latitud, longitud)
 * @returns Distancia en km, metros y millas
 */
export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): DistanceResult {
  const R = 6371; // Radio de la Tierra en km

  const lat1 = toRadians(point1.latitude);
  const lat2 = toRadians(point2.latitude);
  const deltaLat = toRadians(point2.latitude - point1.latitude);
  const deltaLon = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance_km = R * c;

  return {
    distance_km: Math.round(distance_km * 100) / 100,
    distance_m: Math.round(distance_km * 1000),
    distance_mi: Math.round(distance_km * 0.621371 * 100) / 100,
  };
}

/**
 * Estima el tiempo de conducción basado en la distancia
 * Usa velocidades promedio según el tipo de ruta
 * @param distance_km Distancia en kilómetros
 * @param routeType Tipo de ruta: 'highway', 'city', 'mixed'
 * @returns Tiempo estimado de conducción
 */
export function estimateDriveTime(
  distance_km: number,
  routeType: 'highway' | 'city' | 'mixed' = 'mixed'
): DriveTimeEstimate {
  // Velocidades promedio en km/h
  const speeds = {
    highway: 100, // Autopista
    city: 40,     // Ciudad
    mixed: 70,    // Mixto
  };

  const speed = speeds[routeType];
  const hours = distance_km / speed;
  const minutes = Math.round(hours * 60);

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  const formatted = h > 0 ? `${h}h ${m}min` : `${m}min`;

  return {
    distance_km,
    estimated_drive_time_minutes: minutes,
    estimated_drive_time_formatted: formatted,
  };
}

/**
 * Calcula distancia y tiempo de conducción entre dos puntos
 * @param point1 Primer punto
 * @param point2 Segundo punto
 * @param routeType Tipo de ruta
 * @returns Distancia y tiempo estimado
 */
export function calculateDistanceAndTime(
  point1: Coordinates,
  point2: Coordinates,
  routeType: 'highway' | 'city' | 'mixed' = 'mixed'
): DriveTimeEstimate {
  const distance = calculateDistance(point1, point2);
  return estimateDriveTime(distance.distance_km, routeType);
}

/**
 * Convierte grados a radianes
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Formatea la distancia de forma legible
 * @param distance_km Distancia en kilómetros
 * @returns Distancia formateada (ej: "15.5 km", "850 m")
 */
export function formatDistance(distance_km: number): string {
  if (distance_km < 1) {
    return `${Math.round(distance_km * 1000)} m`;
  }
  return `${distance_km.toFixed(1)} km`;
}

/**
 * Calcula el punto medio entre dos coordenadas
 * Útil para centrar mapas
 * @param point1 Primer punto
 * @param point2 Segundo punto
 * @returns Punto medio
 */
export function calculateMidpoint(
  point1: Coordinates,
  point2: Coordinates
): Coordinates {
  const lat1 = toRadians(point1.latitude);
  const lon1 = toRadians(point1.longitude);
  const lat2 = toRadians(point2.latitude);
  const lon2 = toRadians(point2.longitude);

  const dLon = lon2 - lon1;

  const bx = Math.cos(lat2) * Math.cos(dLon);
  const by = Math.cos(lat2) * Math.sin(dLon);

  const lat3 = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + bx) * (Math.cos(lat1) + bx) + by * by)
  );

  const lon3 = lon1 + Math.atan2(by, Math.cos(lat1) + bx);

  return {
    latitude: toDegrees(lat3),
    longitude: toDegrees(lon3),
  };
}

/**
 * Convierte radianes a grados
 */
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Verifica si un punto está dentro de un radio desde un centro
 * @param center Punto central
 * @param point Punto a verificar
 * @param radius_km Radio en kilómetros
 * @returns true si el punto está dentro del radio
 */
export function isWithinRadius(
  center: Coordinates,
  point: Coordinates,
  radius_km: number
): boolean {
  const distance = calculateDistance(center, point);
  return distance.distance_km <= radius_km;
}
