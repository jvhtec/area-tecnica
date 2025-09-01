
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calendar, MapPin, Sparkles, Zap, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { EventData } from "@/types/hoja-de-ruta";
import { PlaceAutocomplete } from "@/components/maps/PlaceAutocomplete";

interface EventDetailsSectionProps {
  selectedJobId: string;
  setSelectedJobId: (id: string) => void;
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
  isLoadingJobs: boolean;
  jobs?: any[];
  onAutoPopulate?: () => void;
}

export const EventDetailsSection = ({
  selectedJobId,
  setSelectedJobId,
  eventData,
  setEventData,
  isLoadingJobs,
  jobs,
  onAutoPopulate,
}: EventDetailsSectionProps) => {
  // Filter out jobs with empty or invalid IDs
  const validJobs = jobs?.filter(job => job.id && job.id.trim() !== '') || [];
  
  // Ensure we have a valid value for the Select component
  const selectValue = selectedJobId && selectedJobId.trim() !== '' ? selectedJobId : "";

  // Get job details for preview
  const jobDetails = validJobs.find(job => job.id === selectedJobId);

  // Handle venue selection from Places Autocomplete
  const handleVenueSelect = ({ name, address, coordinates, place_id }: {
    name: string;
    address: string; 
    coordinates?: { lat: number; lng: number };
    place_id?: string;
  }) => {
    console.log('Venue selected:', { name, address, coordinates, place_id });
    
    setEventData(prev => ({
      ...prev,
      venue: {
        ...prev.venue,
        name: name || address, // Use name if available, fallback to address
        address: address,
        coordinates: coordinates,
        // Store additional metadata if available
        place_id: place_id,
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Job Selection Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Selección de Trabajo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job-select">Trabajo Base</Label>
                <Select value={selectValue} onValueChange={setSelectedJobId}>
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="Seleccionar trabajo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingJobs ? (
                      <SelectItem value="loading">Cargando trabajos...</SelectItem>
                    ) : validJobs.length === 0 ? (
                      <SelectItem value="no-jobs">No hay trabajos disponibles</SelectItem>
                    ) : (
                      validJobs.map((job: any) => (
                        <SelectItem key={job.id} value={job.id}>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {job.title}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end">
                <Button
                  onClick={onAutoPopulate}
                  disabled={!selectedJobId || !jobDetails}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Auto-completar
                </Button>
              </div>
            </div>

            {jobDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200"
              >
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-blue-700">Fechas:</span>
                    <p className="text-blue-600">
                      {new Date(jobDetails.start_time).toLocaleDateString()} - 
                      {new Date(jobDetails.end_time).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Ubicación:</span>
                    <p className="text-blue-600">{jobDetails.location || "No especificada"}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Event Details Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Información del Evento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="event-name" className="text-sm font-medium">
                  Nombre del Evento *
                </Label>
                <Input
                  id="event-name"
                  value={eventData.eventName}
                  onChange={(e) => setEventData(prev => ({ ...prev, eventName: e.target.value }))}
                  placeholder="Ej. Festival de Música 2024"
                  className="border-2 focus:border-purple-300"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-dates" className="text-sm font-medium">
                  Fechas del Evento *
                </Label>
                <Input
                  id="event-dates"
                  value={eventData.eventDates}
                  onChange={(e) => setEventData(prev => ({ ...prev, eventDates: e.target.value }))}
                  placeholder="Ej. 15-17 Junio 2024"
                  className="border-2 focus:border-purple-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="venue-name" className="text-sm font-medium">
                  Nombre del Venue *
                </Label>
                <PlaceAutocomplete
                  value={eventData.venue.name}
                  onSelect={handleVenueSelect}
                  placeholder="Ej. Palacio de Congresos, WiZink Center..."
                  className="border-2 focus:border-purple-300"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="venue-address" className="text-sm font-medium">
                  Dirección del Venue
                </Label>
                <Input
                  id="venue-address"
                  value={eventData.venue.address}
                  onChange={(e) => setEventData(prev => ({
                    ...prev,
                    venue: { ...prev.venue, address: e.target.value }
                  }))}
                  placeholder="Se completará automáticamente al seleccionar el venue..."
                  className="border-2 focus:border-purple-300 bg-gray-50"
                  readOnly
                />
              </div>
            </div>

            {/* Show coordinates info if available */}
            {eventData.venue.coordinates && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Ubicación confirmada</span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Coordenadas: {eventData.venue.coordinates.lat.toFixed(6)}, {eventData.venue.coordinates.lng.toFixed(6)}
                </p>
                <p className="text-xs text-green-600">
                  ✓ Mapa del venue y datos meteorológicos se actualizarán automáticamente
                </p>
              </motion.div>
            )}

            <div className="space-y-2">
              <Label htmlFor="auxiliary-needs" className="text-sm font-medium">
                Necesidades Auxiliares
              </Label>
              <Input
                id="auxiliary-needs"
                value={eventData.auxiliaryNeeds}
                onChange={(e) => setEventData(prev => ({ ...prev, auxiliaryNeeds: e.target.value }))}
                placeholder="Especifica cualquier necesidad adicional para el evento..."
                className="border-2 focus:border-purple-300 min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
