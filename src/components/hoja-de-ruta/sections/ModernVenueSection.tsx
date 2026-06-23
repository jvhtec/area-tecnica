import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Upload, X, Image as ImageIcon, Map, Plus, Settings } from "lucide-react";
import { EventData, Images, ImagePreviews } from "@/types/hoja-de-ruta";
import { GoogleMap } from "@/components/maps/GoogleMap";
import { AddressAutocomplete } from "@/components/maps/AddressAutocomplete";
import { PlaceAutocomplete } from "@/components/maps/PlaceAutocomplete";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlacesImageService } from "@/utils/hoja-de-ruta/pdf/services/places-image-service";
import { PrintSectionExclusionToggle } from "../components/PrintSectionExclusionToggle";
import type { HojaDeRutaPrintSectionId } from "@/utils/hoja-de-ruta/pdf";

interface ModernVenueSectionProps {
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
  images: Images;
  imagePreviews: ImagePreviews;
  onImageUpload: (type: keyof Images, files: FileList) => void;
  onRemoveImage: (type: keyof Images, index: number) => void;
  onVenueMapUpload: (file: File) => void;
  handleVenueMapUrl: (url: string) => void;
  appendVenuePreviews: (dataUrls: string[]) => void;
  isPrintSectionExcluded: (sectionId: HojaDeRutaPrintSectionId) => boolean;
  onPrintSectionExcludedChange: (sectionId: HojaDeRutaPrintSectionId, isExcluded: boolean) => void;
}

export const ModernVenueSection: React.FC<ModernVenueSectionProps> = ({
  eventData,
  setEventData,
  images,
  imagePreviews,
  onImageUpload,
  onRemoveImage,
  onVenueMapUpload,
  handleVenueMapUrl,
  appendVenuePreviews,
  isPrintSectionExcluded,
  onPrintSectionExcludedChange,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [staticMapUrl, setStaticMapUrl] = useState<string | null>(null);
  const fetchedQueriesRef = useRef<Set<string>>(new Set());

  // Update coordinates when eventData changes
  useEffect(() => {
    if (eventData.venue.coordinates && eventData.venue.address) {
      // Sync with coordinates from venue selection in EventDetailsSection
      console.log('VenueLocationSection: Syncing with venue data:', eventData.venue);
    }
  }, [eventData.venue.coordinates, eventData.venue.address]);

  // When we receive a static map URL from GoogleMap, convert it to a preview for the PDF
  useEffect(() => {
    if (staticMapUrl) {
      console.log('🗺️ ModernVenueSection: staticMapUrl received, generating preview for PDF');
      handleVenueMapUrl(staticMapUrl);
    }
  }, [staticMapUrl, handleVenueMapUrl]);

  // Auto-suggest a venue photo from Wikimedia (free, no API costs). Users can
  // still upload their own; suggestions only fill in when there's room.
  useEffect(() => {
    const name = eventData.venue?.name?.trim();
    const address = eventData.venue?.address?.trim();
    const query = name || address;
    if (!query) return;
    // Only fetch if we have room for suggestions
    if ((imagePreviews.venue?.length || 0) >= 2) return;
    const coordinates = eventData.venue?.coordinates;
    const locPart = coordinates
      ? `${coordinates.lat.toFixed(4)},${coordinates.lng.toFixed(4)}`
      : 'noloc';
    const key = `${query.toLowerCase()}::${locPart}`;
    if (fetchedQueriesRef.current.has(key)) return;

    let cancelled = false;
    (async () => {
      try {
        const photos = await PlacesImageService.getPhotosForQuery(
          query,
          1,
          500,
          300,
          eventData.venue?.coordinates,
        );
        if (!cancelled && photos && photos.length) {
          appendVenuePreviews(photos);
          fetchedQueriesRef.current.add(key);
        }
      } catch (e) {
        console.warn('Failed to fetch venue suggestion photos:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventData.venue?.name, eventData.venue?.address, eventData.venue?.coordinates, imagePreviews.venue, appendVenuePreviews]);

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

  const handleDrop = (e: React.DragEvent, type: 'venue' | 'map') => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      if (type === 'venue') {
        onImageUpload('venue', files);
      } else {
        onVenueMapUpload(files[0]);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, type: 'venue' | 'map') => {
    const files = e.target.files;
    if (files) {
      if (type === 'venue') {
        onImageUpload('venue', files);
      } else {
        onVenueMapUpload(files[0]);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Venue Images Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-green-600" />
              Imágenes del Venue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => handleDrop(e, 'venue')}
            >
              <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                Subir Imágenes del Venue
              </h3>
              <p className="text-gray-500 mb-4">
                Arrastra las imágenes aquí o haz clic para seleccionar
              </p>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleFileInput(e, 'venue')}
                className="hidden"
                id="venue-images"
              />
              <label htmlFor="venue-images">
                <Button variant="outline" className="gap-2" asChild>
                  <span>
                    <Upload className="w-4 h-4" />
                    Seleccionar Imágenes
                  </span>
                </Button>
              </label>
            </div>

            {/* Image Gallery */}
            {imagePreviews.venue.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <AnimatePresence>
                  {imagePreviews.venue.map((preview, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative group rounded-lg overflow-hidden border-2 border-gray-200"
                    >
                      <img
                        src={preview}
                        alt={`Venue ${index + 1}`}
                        width={500}
                        height={300}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onRemoveImage('venue', index)}
                          className="rounded-full w-8 h-8 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Venue Location Management */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                Ubicación del Venue
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <PrintSectionExclusionToggle
                  sectionId="venue"
                  isExcluded={isPrintSectionExcluded("venue")}
                  onExcludedChange={onPrintSectionExcludedChange}
                />
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Settings className="w-4 h-4" />
                      Editar Ubicación
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Configurar Ubicación del Venue</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="venue-name">Nombre del Venue</Label>
                        <PlaceAutocomplete
                          value={eventData.venue.name || ''}
                          onSelect={({ name, address, coordinates }) =>
                            setEventData(prev => ({
                              ...prev,
                              venue: {
                                ...prev.venue,
                                name: name || prev.venue.name,
                                address: address || prev.venue.address,
                                // Never retain coordinates from a previous
                                // place after selecting a different venue.
                                coordinates,
                              }
                            }))
                          }
                          placeholder="Buscar venue o lugar..."
                        />
                      </div>
                      <div>
                        <Label>Dirección del Venue</Label>
                        <AddressAutocomplete
                          value={eventData.venue.address || ''}
                          onChange={(address, coordinates) => {
                            setEventData(prev => ({
                              ...prev,
                              venue: {
                                ...prev.venue,
                                address,
                                coordinates
                              }
                            }));
                          }}
                          placeholder="Buscar dirección..."
                        />
                      </div>
                      {(eventData.venue.address || eventData.venue.coordinates) && (
                        <div>
                          <Label>Vista Previa del Mapa</Label>
                          <GoogleMap
                            address={eventData.venue.address}
                            coordinates={eventData.venue.coordinates}
                            height="250px"
                            interactive={true}
                            showMarker={true}
                            onLocationSelect={handleLocationUpdate}
                            onStaticMapUrlChange={setStaticMapUrl}
                          />
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventData.venue.address || eventData.venue.coordinates ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">
                    {eventData.venue.name ? `${eventData.venue.name} - Ubicación confirmada` : 'Ubicación confirmada'}
                  </span>
                </div>
                <GoogleMap
                  address={eventData.venue.address}
                  coordinates={eventData.venue.coordinates}
                  height="300px"
                  interactive={false}
                  showMarker={true}
                  onStaticMapUrlChange={setStaticMapUrl}
                />
                {eventData.venue.address && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Dirección:</p>
                    <p className="text-sm">{eventData.venue.address}</p>
                    {eventData.venue.coordinates && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Coordenadas: {eventData.venue.coordinates.lat.toFixed(6)}, {eventData.venue.coordinates.lng.toFixed(6)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No hay ubicación configurada</p>
                <p className="text-sm mb-4">Complete el nombre del venue en la sección "Información del Evento" para ver el mapa aquí automáticamente</p>
                <p className="text-xs text-blue-600">✓ Integración Google Maps habilitada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
