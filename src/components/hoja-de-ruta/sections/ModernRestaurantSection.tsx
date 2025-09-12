import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Star, 
  Phone, 
  Globe, 
  Search, 
  Loader2,
  UtensilsCrossed,
  Filter,
  RefreshCw
} from 'lucide-react';
import { PlacesRestaurantService } from '@/utils/hoja-de-ruta/services/places-restaurant-service';
import type { Restaurant, EventData, Accommodation } from '@/types/hoja-de-ruta';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ModernRestaurantSectionProps {
  eventData: EventData;
  onUpdateEventData: (data: EventData) => void;
  accommodations?: Accommodation[];
}

export function ModernRestaurantSection({ eventData, onUpdateEventData, accommodations = [] }: ModernRestaurantSectionProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchRadius, setSearchRadius] = useState('2000');
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const { toast } = useToast();

  const selectedRestaurants = eventData.selectedRestaurants || [];
  const venueAddress = eventData.venue?.address || '';
  const venueCoords = eventData.venue?.coordinates
    ? { lat: eventData.venue.coordinates.lat, lng: eventData.venue.coordinates.lng }
    : (typeof eventData.venue?.latitude === 'number' && typeof eventData.venue?.longitude === 'number'
        ? { lat: eventData.venue.latitude, lng: eventData.venue.longitude }
        : undefined);

  // Build origin options: venue + hotels with address
  const hotelOptions = (accommodations || []).map((acc, idx) => ({
    key: `hotel-${idx}`,
    label: acc.hotel_name ? `Hotel: ${acc.hotel_name}` : `Hotel ${idx + 1}`,
    address: acc.address || '',
    coords: acc.coordinates ? { lat: acc.coordinates.lat, lng: acc.coordinates.lng } : undefined,
    type: 'hotel' as const,
  })).filter(h => h.address || h.coords);

  const originOptions = [
    ...(venueAddress || venueCoords ? [{ key: 'venue', label: 'Cerca del Venue', address: venueAddress, coords: venueCoords, type: 'venue' as const }] : []),
    ...hotelOptions,
  ];

  const [selectedOriginKeys, setSelectedOriginKeys] = useState<string[]>(originOptions.length ? [originOptions[0].key] : []);

  useEffect(() => {
    if (selectedOriginKeys.length > 0) {
      searchRestaurants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOriginKeys.join('|')]);

  const searchRestaurants = async () => {
    if (selectedOriginKeys.length === 0) {
      toast({
        title: 'Dirección requerida',
        description: 'Selecciona al menos un origen (venue u hotel) para buscar restaurantes cercanos',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const radiusNum = parseInt(searchRadius);
      const allResults: Restaurant[] = [];
      for (const key of selectedOriginKeys) {
        const origin = originOptions.find(o => o.key === key);
        if (!origin) continue;
        const results = await PlacesRestaurantService.searchRestaurantsNearVenue(
          origin.address || '',
          radiusNum,
          20,
          origin.coords
        );
        const annotated = results.map(r => ({
          ...r,
          id: `${r.googlePlaceId || r.id}::${key}`,
          originType: origin.type,
          originLabel: origin.type === 'venue' ? 'Venue' : origin.label.replace(/^Hotel:\s*/, 'Hotel '),
        }));
        allResults.push(...annotated);
      }
      
      // Mark previously selected restaurants
      const updatedResults = allResults.map(restaurant => ({
        ...restaurant,
        isSelected: selectedRestaurants.includes(restaurant.id)
      }));
      
      setRestaurants(updatedResults);
      
      if (allResults.length === 0) {
        toast({
          title: 'Sin resultados',
          description: 'No se encontraron restaurantes cerca del/los origen/es seleccionados',
        });
      }
    } catch (error) {
      console.error('Error searching restaurants:', error);
      toast({
        title: 'Error',
        description: 'Error al buscar restaurantes. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRestaurant = (restaurant: Restaurant) => {
    const currentRestaurants = eventData.restaurants || [];
    const currentSelected = selectedRestaurants;
    
    let updatedRestaurants: Restaurant[];
    let updatedSelected: string[];
    
    if (restaurant.isSelected) {
      // Remove from selection
      updatedRestaurants = currentRestaurants.filter(r => r.id !== restaurant.id);
      updatedSelected = currentSelected.filter(id => id !== restaurant.id);
    } else {
      // Add to selection
      const restaurantToAdd = { ...restaurant, isSelected: true };
      updatedRestaurants = [...currentRestaurants.filter(r => r.id !== restaurant.id), restaurantToAdd];
      updatedSelected = [...currentSelected.filter(id => id !== restaurant.id), restaurant.id];
    }

    // Update local state
    setRestaurants(prev => prev.map(r => 
      r.id === restaurant.id ? { ...r, isSelected: !r.isSelected } : r
    ));

    // Update parent state
    onUpdateEventData({
      ...eventData,
      restaurants: updatedRestaurants,
      selectedRestaurants: updatedSelected,
    });
  };

  const filteredRestaurants = restaurants.filter(restaurant => {
    if (priceFilter !== 'all' && restaurant.priceLevel !== parseInt(priceFilter)) {
      return false;
    }
    if (ratingFilter !== 'all' && (!restaurant.rating || restaurant.rating < parseFloat(ratingFilter))) {
      return false;
    }
    return true;
  });

  const getPriceDisplay = (priceLevel?: number) => {
    if (!priceLevel) return 'N/A';
    return '€'.repeat(priceLevel);
  };

  const selectedCount = restaurants.filter(r => r.isSelected).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <UtensilsCrossed className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Recomendaciones de Restaurantes</h2>
      </div>

      {/* Search Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Configuración de Búsqueda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar cerca de</label>
              <div className="flex flex-col gap-2 border rounded-md p-3">
                {originOptions.length === 0 && (
                  <span className="text-xs text-muted-foreground">Configura un venue u hotel con dirección</span>
                )}
                {originOptions.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedOriginKeys.includes(opt.key)}
                      onCheckedChange={(v) => {
                        setSelectedOriginKeys((prev) => {
                          if (v) return Array.from(new Set([...prev, opt.key]));
                          return prev.filter(k => k !== opt.key);
                        });
                      }}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Radio de búsqueda</label>
              <Select value={searchRadius} onValueChange={setSearchRadius}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000">1 km</SelectItem>
                  <SelectItem value="2000">2 km</SelectItem>
                  <SelectItem value="5000">5 km</SelectItem>
                  <SelectItem value="10000">10 km</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Precio</label>
              <Select value={priceFilter} onValueChange={setPriceFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los precios</SelectItem>
                  <SelectItem value="1">€ (Económico)</SelectItem>
                  <SelectItem value="2">€€ (Moderado)</SelectItem>
                  <SelectItem value="3">€€€ (Caro)</SelectItem>
                  <SelectItem value="4">€€€€ (Muy caro)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Valoración mínima</label>
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cualquier valoración</SelectItem>
                  <SelectItem value="3.0">3+ ⭐</SelectItem>
                  <SelectItem value="4.0">4+ ⭐</SelectItem>
                  <SelectItem value="4.5">4.5+ ⭐</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={searchRestaurants} 
              disabled={isLoading || selectedOriginKeys.length === 0}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Buscar restaurantes
            </Button>

            <Button 
              variant="outline" 
              onClick={searchRestaurants}
              disabled={isLoading}
              size="icon"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {selectedCount > 0 && (
            <div className="text-sm text-muted-foreground">
              {selectedCount} restaurante{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''} para incluir en el PDF
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restaurant List */}
      {restaurants.length > 0 && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Mostrando {filteredRestaurants.length} de {restaurants.length} restaurantes
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRestaurants.map((restaurant) => (
              <Card key={restaurant.id} className={`cursor-pointer transition-colors ${
                restaurant.isSelected ? 'ring-2 ring-primary' : ''
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={restaurant.isSelected}
                        onCheckedChange={() => toggleRestaurant(restaurant)}
                      />
                      <div className="flex items-center gap-2">
                        {restaurant.originLabel && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {restaurant.originLabel}
                          </Badge>
                        )}
                        <h3 className="font-medium text-sm">{restaurant.name}</h3>
                      </div>
                    </div>
                    {restaurant.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs">{restaurant.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{restaurant.address}</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      {restaurant.priceLevel && (
                        <span className="font-medium">{getPriceDisplay(restaurant.priceLevel)}</span>
                      )}
                      
                      {restaurant.distance && (
                        <span className="text-muted-foreground">
                          {restaurant.distance < 1000 
                            ? `${restaurant.distance}m` 
                            : `${(restaurant.distance / 1000).toFixed(1)}km`}
                        </span>
                      )}
                    </div>

                    {restaurant.cuisine && restaurant.cuisine.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {restaurant.cuisine.slice(0, 2).map((cuisine) => (
                          <Badge key={cuisine} variant="secondary" className="text-xs">
                            {cuisine.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {(restaurant.phone || restaurant.website) && (
                      <div className="flex items-center gap-3 text-xs">
                        {restaurant.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{restaurant.phone}</span>
                          </div>
                        )}
                        {restaurant.website && (
                          <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            <span className="truncate">Web</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!isLoading && restaurants.length === 0 && selectedOriginKeys.length > 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <UtensilsCrossed className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay restaurantes</h3>
            <p className="text-muted-foreground">
              Haz clic en "Buscar restaurantes" para encontrar opciones cerca de los orígenes seleccionados
            </p>
          </CardContent>
        </Card>
      )}

      {selectedOriginKeys.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Dirección requerida</h3>
            <p className="text-muted-foreground">
              Selecciona el venue y/o uno o más hoteles para buscar restaurantes cercanos
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
