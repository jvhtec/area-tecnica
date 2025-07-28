
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VenueDialogProps } from "@/types/hoja-de-ruta/dialogs";
import { AddressAutocomplete } from "@/components/maps/AddressAutocomplete";
import { GoogleMap } from "@/components/maps/GoogleMap";

export const VenueDialog = ({
  eventData,
  setEventData,
  venueMapPreview,
  handleVenueMapUpload,
}: VenueDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Editar Detalles del Lugar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Información del Lugar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="venueName">Nombre del Lugar</Label>
            <Input
              id="venueName"
              value={eventData.venue.name}
              onChange={(e) =>
                setEventData({
                  ...eventData,
                  venue: { ...eventData.venue, name: e.target.value },
                })
              }
            />
          </div>
          <div>
            <AddressAutocomplete
              label="Dirección"
              value={eventData.venue.address}
              onChange={(address, coordinates) =>
                setEventData({
                  ...eventData,
                  venue: { 
                    ...eventData.venue, 
                    address,
                    ...(coordinates && { coordinates })
                  },
                })
              }
              placeholder="Buscar dirección del venue..."
            />
          </div>
          
          {/* Google Map Display */}
          {(eventData.venue.address || eventData.venue.coordinates) && (
            <div>
              <Label>Ubicación en el Mapa</Label>
              <div className="mt-2">
                <GoogleMap
                  address={eventData.venue.address}
                  coordinates={eventData.venue.coordinates}
                  height="250px"
                  onLocationSelect={(coordinates, address) =>
                    setEventData({
                      ...eventData,
                      venue: { 
                        ...eventData.venue, 
                        coordinates,
                        address: address || eventData.venue.address
                      },
                    })
                  }
                />
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="venueMapUpload">Mapa de Ubicación del Lugar</Label>
            <Input
              id="venueMapUpload"
              type="file"
              accept="image/*"
              onChange={handleVenueMapUpload}
            />
            {venueMapPreview && (
              <img
                src={venueMapPreview}
                alt="Vista previa del mapa del lugar"
                className="mt-2 max-w-full h-auto"
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
