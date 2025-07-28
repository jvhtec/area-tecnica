import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Upload, X, Image as ImageIcon, Map, Plus } from "lucide-react";
import { EventData, Images, ImagePreviews } from "@/types/hoja-de-ruta";
import { GoogleMap } from "@/components/maps/GoogleMap";

interface ModernVenueSectionProps {
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
  images: Images;
  imagePreviews: ImagePreviews;
  venueMapPreview: string | null;
  onImageUpload: (type: keyof Images, files: FileList) => void;
  onRemoveImage: (type: keyof Images, index: number) => void;
  onVenueMapUpload: (file: File) => void;
}

export const ModernVenueSection: React.FC<ModernVenueSectionProps> = ({
  eventData,
  setEventData,
  images,
  imagePreviews,
  venueMapPreview,
  onImageUpload,
  onRemoveImage,
  onVenueMapUpload,
}) => {
  const [dragOver, setDragOver] = useState(false);

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

      {/* Venue Map Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="w-5 h-5 text-blue-600" />
              Plano del Venue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {venueMapPreview ? (
              <div className="relative group">
                <img
                  src={venueMapPreview}
                  alt="Plano del venue"
                  className="w-full h-64 object-contain border-2 border-gray-200 rounded-lg bg-gray-50"
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      // Reset venue map
                      const event = new Event('change', { bubbles: true });
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.value = '';
                      input.dispatchEvent(event);
                    }}
                    className="rounded-full w-8 h-8 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => handleDrop(e, 'map')}
              >
                <Map className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                  Subir Plano del Venue
                </h3>
                <p className="text-gray-500 mb-4">
                  Arrastra el plano aquí o haz clic para seleccionar
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileInput(e, 'map')}
                  className="hidden"
                  id="venue-map"
                />
                <label htmlFor="venue-map">
                  <Button variant="outline" className="gap-2" asChild>
                    <span>
                      <Upload className="w-4 h-4" />
                      Seleccionar Plano
                    </span>
                  </Button>
                </label>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Google Maps Location Section */}
      {(eventData.venue.address || eventData.venue.coordinates) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-2">
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
                interactive={false}
                showMarker={true}
              />
              {eventData.venue.address && (
                <div className="mt-3 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Dirección:</p>
                  <p className="text-sm">{eventData.venue.address}</p>
                  {eventData.venue.coordinates && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Coordenadas: {eventData.venue.coordinates.lat.toFixed(6)}, {eventData.venue.coordinates.lng.toFixed(6)}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};