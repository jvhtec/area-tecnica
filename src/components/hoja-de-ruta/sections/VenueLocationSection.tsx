import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";
import { EventData } from "@/types/hoja-de-ruta";
import { GoogleMap } from "@/components/maps/GoogleMap";

interface VenueLocationSectionProps {
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
}

export const VenueLocationSection: React.FC<VenueLocationSectionProps> = ({
  eventData,
  setEventData,
}) => {
  const hasVenueLocation = eventData.venue.address || eventData.venue.coordinates;

  const handleLocationUpdate = (coordinates: { lat: number; lng: number }, address: string) => {
    setEventData(prev => ({
      ...prev,
      venue: {
        ...prev.venue,
        coordinates,
        address: address || prev.venue.address
      }
    }));
  };

  if (!hasVenueLocation) {
    return (
      <Card className="border-dashed border-2 border-muted">
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center text-muted-foreground">
            <MapPin className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">
              Agrega una dirección del venue en "Editar Detalles del Lugar" para ver la ubicación aquí
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-emerald-600" />
          Ubicación del Venue
        </CardTitle>
      </CardHeader>
      <CardContent>
        <GoogleMap
          address={eventData.venue.address}
          coordinates={eventData.venue.coordinates}
          height="300px"
          interactive={true}
          showMarker={true}
          onLocationSelect={handleLocationUpdate}
        />
        
        {eventData.venue.address && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <Label className="text-sm font-medium text-muted-foreground">Dirección:</Label>
            <p className="text-sm mt-1">{eventData.venue.address}</p>
            {eventData.venue.coordinates && (
              <p className="text-xs text-muted-foreground mt-1">
                Coordenadas: {eventData.venue.coordinates.lat.toFixed(6)}, {eventData.venue.coordinates.lng.toFixed(6)}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};