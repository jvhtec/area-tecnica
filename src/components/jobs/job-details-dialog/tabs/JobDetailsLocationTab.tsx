import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MapPin, Truck } from "lucide-react";

import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getStaticMapUrlForLocation } from "@/lib/mapbox/mapboxClient";
import { useJobDistance } from "@/hooks/useJobDistance";

interface JobDetailsLocationTabProps {
  open: boolean;
  jobDetails: any;
  isJobLoading: boolean;
}

export const JobDetailsLocationTab: React.FC<JobDetailsLocationTabProps> = ({ open, jobDetails, isJobLoading }) => {
  // Static map preview via Mapbox Static Images API (public token, no Google billing)
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState<boolean>(false);

  // Calculate distance from home base
  const distance = useJobDistance({ locations: jobDetails?.locations });

  useEffect(() => {
    const loadStaticMap = async () => {
      try {
        if (!open) return;
        const loc = jobDetails?.locations;
        if (!loc) {
          setMapPreviewUrl(null);
          return;
        }
        const lat =
          typeof loc.latitude === "number"
            ? loc.latitude
            : typeof loc.latitude === "string"
              ? parseFloat(loc.latitude)
              : undefined;
        const lng =
          typeof loc.longitude === "number"
            ? loc.longitude
            : typeof loc.longitude === "string"
              ? parseFloat(loc.longitude)
              : undefined;
        const address = loc.formatted_address || (loc as any).address || loc.name || "";

        setIsMapLoading(true);

        const url = await getStaticMapUrlForLocation({ lat, lng, address, width: 600, height: 300, zoom: 15 });
        setMapPreviewUrl(url);
      } catch (e: any) {
        console.warn("Failed to load static map preview:", e?.message || e);
        setMapPreviewUrl(null);
      } finally {
        setIsMapLoading(false);
      }
    };
    loadStaticMap();
  }, [open, jobDetails]);

  const openGoogleMaps = () => {
    if (jobDetails?.locations) {
      const address = encodeURIComponent(jobDetails.locations.formatted_address || jobDetails.locations.name || "");
      window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, "_blank");
    }
  };

  return (
    <TabsContent value="location" className="space-y-4 min-w-0 overflow-x-hidden">
      <Card className="p-4 w-full min-w-0 overflow-hidden">
        {isJobLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : jobDetails?.locations ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{jobDetails.locations.name}</h3>
                {jobDetails.locations.formatted_address && (
                  <p className="text-muted-foreground">{jobDetails.locations.formatted_address}</p>
                )}
                {distance && (
                  <p className="text-sm text-muted-foreground mt-1">
                    📍 {distance} desde la base
                  </p>
                )}
              </div>
              <Button onClick={openGoogleMaps} size="sm">
                <MapPin className="h-4 w-4 mr-2" />
                Abrir mapas
              </Button>
            </div>

            {isMapLoading && (
              <div className="aspect-[2/1] bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Cargando vista previa del mapa...</p>
                </div>
              </div>
            )}
            {!isMapLoading && mapPreviewUrl && (
              <div className="rounded-lg overflow-hidden border">
                <img
                  src={mapPreviewUrl}
                  alt="Mapa del recinto"
                  width={600}
                  height={300}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto"
                />
                <div className="p-2 flex justify-end">
                  <Button onClick={openGoogleMaps} size="sm">
                    Ver indicaciones
                  </Button>
                </div>
              </div>
            )}
            {!isMapLoading && !mapPreviewUrl && (
              <div className="aspect-[2/1] bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Vista previa del mapa no disponible</p>
                  <Button onClick={openGoogleMaps} size="sm" className="mt-2">
                    Abrir Google Maps
                  </Button>
                </div>
              </div>
            )}

            {jobDetails.logistics_events && jobDetails.logistics_events.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Logística
                </h4>
                <div className="space-y-2">
                  {jobDetails.logistics_events.map((event: any) => (
                    <div key={event.id} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div>
                        <span className="capitalize font-medium">{event.event_type}</span>
                        <span className="text-muted-foreground ml-2">({event.transport_type})</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {event.event_date ? format(new Date(event.event_date), "PPP", { locale: es }) : "Sin fecha"} a las{" "}
                        {event.event_time || "sin hora"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">No hay información de ubicación disponible</p>
          </div>
        )}
      </Card>
    </TabsContent>
  );
};
