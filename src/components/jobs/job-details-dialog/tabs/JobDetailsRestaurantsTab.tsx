import React from "react";
import { Globe, Phone, UtensilsCrossed } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlacesRestaurantService } from "@/utils/hoja-de-ruta/services/places-restaurant-service";
import type { Restaurant } from "@/types/hoja-de-ruta";

interface JobDetailsRestaurantsTabProps {
  open: boolean;
  jobId: string;
  jobDetails: any;
  isJobLoading: boolean;
}

export const JobDetailsRestaurantsTab: React.FC<JobDetailsRestaurantsTabProps> = ({
  open,
  jobId,
  jobDetails,
  isJobLoading,
}) => {
  const { data: restaurants = [], isLoading: isRestaurantsLoading } = useQuery({
    queryKey: ["job-restaurants", jobId, jobDetails?.locations?.formatted_address],
    queryFn: async () => {
      const locationData = jobDetails?.locations;
      const address = locationData?.formatted_address || locationData?.name;

      console.log("Restaurant query - location data:", locationData);
      console.log("Restaurant query - using address:", address);

      if (!address && !locationData?.latitude) {
        console.log("Restaurant query - no address or coordinates found, returning empty array");
        return [];
      }

      const coordinates =
        locationData?.latitude && locationData?.longitude
          ? { lat: Number(locationData.latitude), lng: Number(locationData.longitude) }
          : undefined;

      console.log("Restaurant query - coordinates:", coordinates);

      return await PlacesRestaurantService.searchRestaurantsNearVenue(
        address || `${coordinates?.lat},${coordinates?.lng}`,
        2000,
        10,
        coordinates
      );
    },
    enabled:
      open &&
      !isJobLoading &&
      !!jobDetails?.locations &&
      (!!jobDetails?.locations?.formatted_address ||
        !!jobDetails?.locations?.name ||
        (!!jobDetails?.locations?.latitude && !!jobDetails?.locations?.longitude)),
  });

  return (
    <TabsContent value="restaurants" className="space-y-4 min-w-0 overflow-x-hidden">
      <Card className="p-4 w-full min-w-0 overflow-hidden">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4" />
          Restaurantes cercanos
        </h3>

        {isJobLoading || isRestaurantsLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
            <p className="text-muted-foreground">Buscando restaurantes cercanos...</p>
          </div>
        ) : restaurants && restaurants.length > 0 ? (
          <div className="space-y-3">
            {restaurants.map((restaurant: Restaurant) => (
              <div key={restaurant.id} className="p-3 bg-[#0f1219] border border-[#1f232e] rounded">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium break-words">{restaurant.name}</p>
                    <p className="text-sm text-muted-foreground break-words">{restaurant.address}</p>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {restaurant.rating && (
                        <Badge variant="outline" className="text-xs">
                          ⭐ {restaurant.rating}
                        </Badge>
                      )}
                      {restaurant.priceLevel !== undefined && (
                        <Badge variant="outline" className="text-xs">
                          {restaurant.priceLevel === 0 ? "Gratis" : "€".repeat(restaurant.priceLevel)}
                        </Badge>
                      )}
                      {restaurant.distance && (
                        <Badge variant="outline" className="text-xs">
                          A {Math.round(restaurant.distance)} m
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:shrink-0">
                    {restaurant.phone && (
                      <Button size="sm" variant="outline" asChild className="w-full sm:w-auto">
                        <a href={`tel:${restaurant.phone}`}>
                          <Phone className="h-4 w-4 sm:mr-0" />
                          <span className="sm:hidden ml-2">Llamar</span>
                        </a>
                      </Button>
                    )}
                    {restaurant.website && (
                      <Button size="sm" variant="outline" asChild className="w-full sm:w-auto">
                        <a href={restaurant.website} target="_blank" rel="noopener noreferrer">
                          <Globe className="h-4 w-4 sm:mr-0" />
                          <span className="sm:hidden ml-2">Sitio web</span>
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">
              {jobDetails?.locations?.formatted_address
                ? "No se encontraron restaurantes cercanos"
                : "No hay dirección del recinto para buscar restaurantes"}
            </p>
          </div>
        )}
      </Card>
    </TabsContent>
  );
};
