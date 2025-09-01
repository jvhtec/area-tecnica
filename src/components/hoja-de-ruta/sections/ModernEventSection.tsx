import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { Calendar, MapPin, Sparkles, Zap, Building2 } from "lucide-react";
import { EventData } from "@/types/hoja-de-ruta";

interface ModernEventSectionProps {
  eventData: EventData;
  setEventData: React.Dispatch<React.SetStateAction<EventData>>;
  selectedJobId: string;
  setSelectedJobId: React.Dispatch<React.SetStateAction<string>>;
  jobs: any[];
  isLoadingJobs: boolean;
  jobDetails: any;
  onAutoPopulate: () => void;
}

export const ModernEventSection: React.FC<ModernEventSectionProps> = ({
  eventData,
  setEventData,
  selectedJobId,
  setSelectedJobId,
  jobs,
  isLoadingJobs,
  jobDetails,
  onAutoPopulate,
}) => {
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
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="Seleccionar trabajo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs?.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {job.title}
                        </div>
                      </SelectItem>
                    ))}
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
                <Input
                  id="venue-name"
                  value={eventData.venue.name}
                  onChange={(e) => setEventData(prev => ({
                    ...prev,
                    venue: { ...prev.venue, name: e.target.value }
                  }))}
                  placeholder="Ej. Palacio de Congresos"
                  className="border-2 focus:border-purple-300"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="venue-address" className="text-sm font-medium">
                  Dirección del Venue *
                </Label>
                <Input
                  id="venue-address"
                  value={eventData.venue.address}
                  onChange={(e) => setEventData(prev => ({
                    ...prev,
                    venue: { ...prev.venue, address: e.target.value }
                  }))}
                  placeholder="Ej. Calle Mayor 123, Madrid"
                  className="border-2 focus:border-purple-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auxiliary-needs" className="text-sm font-medium">
                Necesidades Auxiliares
              </Label>
              <Textarea
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