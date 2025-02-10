
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
import { Textarea } from "@/components/ui/textarea";
import { VenueDialogProps } from "@/types/hoja-de-ruta/dialogs";

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
            <Label htmlFor="venueAddress">Dirección</Label>
            <Textarea
              id="venueAddress"
              value={eventData.venue.address}
              onChange={(e) =>
                setEventData({
                  ...eventData,
                  venue: { ...eventData.venue, address: e.target.value },
                })
              }
            />
          </div>
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
