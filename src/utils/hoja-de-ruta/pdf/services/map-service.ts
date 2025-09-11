export class MapService {
  static async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'LovableApp/1.0 (+https://lovable.dev)'
        }
      });
      
      if (!res.ok) return null;
      
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const { lat, lon } = data[0];
        return { lat: parseFloat(lat), lng: parseFloat(lon) };
      }
      
      return null;
    } catch (e) {
      console.warn('Geocoding failed for address:', address, e);
      return null;
    }
  }

  static async getStaticMapDataUrl(
    lat: number,
    lng: number,
    width: number = 640,
    height: number = 320,
    zoom: number = 15
  ): Promise<string | null> {
    const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=${lat},${lng},red-pushpin`;
    const headers = {
      'Accept': 'image/png,image/jpeg,*/*',
      'User-Agent': 'LovableApp/1.0 (+https://lovable.dev)'
    } as any;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(mapUrl, { headers });
        if (!res.ok) continue;
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read map blob'));
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        if (attempt === 1) {
          console.warn('Static map fetch failed after retry:', e);
        }
      }
    }
    return null;
  }

  static generateRouteUrl(origin: string, destination: string): string {
    const baseUrl = "https://www.google.com/maps/dir/";
    const encodedOrigin = encodeURIComponent(origin);
    const encodedDestination = encodeURIComponent(destination);
    return `${baseUrl}${encodedOrigin}/${encodedDestination}`;
  }

  /**
   * Destination-only URL so devices can use current location as origin
   */
  static generateDestinationUrl(destination: string): string {
    const baseUrl = 'https://www.google.com/maps/dir/';
    const params = `?api=1&destination=${encodeURIComponent(destination)}`;
    return `${baseUrl}${params}`;
  }
}
