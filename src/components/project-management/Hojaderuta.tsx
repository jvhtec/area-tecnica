import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, Trash2 } from "lucide-react";
import { useHojaDeRutaForm } from "@/hooks/useHojaDeRutaForm";
import { useHojaDeRutaImages } from "@/hooks/useHojaDeRutaImages";
import { useHojaDeRutaHandlers } from "@/hooks/useHojaDeRutaHandlers";
import { ImageUploadSection } from "@/components/hoja-de-ruta/sections/ImageUploadSection";
import { generatePDF } from "@/utils/pdf-generator";
import { useToast } from "@/hooks/use-toast";

const HojaDeRutaGenerator = () => {
  const {
    eventData,
    setEventData,
    selectedJobId,
    setSelectedJobId,
    showAlert,
    setShowAlert,
    alertMessage,
    setAlertMessage,
    powerRequirements,
    setPowerRequirements,
    travelArrangements,
    setTravelArrangements,
    roomAssignments,
    setRoomAssignments,
    isLoadingJobs,
    jobs,
  } = useHojaDeRutaForm();

  const {
    images,
    imagePreviews,
    venueMap,
    venueMapPreview,
    handleImageUpload,
    removeImage,
    handleVenueMapUpload,
  } = useHojaDeRutaImages();

  const {
    handleContactChange,
    addContact,
    handleStaffChange,
    addStaffMember,
    updateTravelArrangement,
    addTravelArrangement,
    removeTravelArrangement,
    updateRoomAssignment,
    addRoomAssignment,
    removeRoomAssignment,
  } = useHojaDeRutaHandlers(
    eventData,
    setEventData,
    travelArrangements,
    setTravelArrangements,
    roomAssignments,
    setRoomAssignments
  );

  const { toast } = useToast();

  const generateDocument = async () => {
    generatePDF(
      eventData,
      travelArrangements,
      roomAssignments,
      venueMapPreview,
      imagePreviews,
      selectedJobId,
      jobs,
      toast
    );
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Generador de Hoja de Ruta</CardTitle>
      </CardHeader>
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <CardContent className="space-y-6">
          {showAlert && (
            <Alert className="mb-4">
              <AlertDescription>{alertMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="jobSelect">Seleccione Trabajo</Label>
              <Select
                value={selectedJobId || "unselected"}
                onValueChange={setSelectedJobId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccione un trabajo..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingJobs ? (
                    <SelectItem value="loading">Cargando trabajos...</SelectItem>
                  ) : jobs?.length === 0 ? (
                    <SelectItem value="unselected">No hay trabajos disponibles</SelectItem>
                  ) : (
                    jobs?.map((job: any) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="eventName">Nombre del Evento</Label>
              <Input
                id="eventName"
                value={eventData.eventName}
                onChange={(e) =>
                  setEventData({ ...eventData, eventName: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="eventDates">Fechas del Evento</Label>
              <div className="relative">
                <Input
                  id="eventDates"
                  value={eventData.eventDates}
                  onChange={(e) =>
                    setEventData({ ...eventData, eventDates: e.target.value })
                  }
                />
                <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <ImageUploadSection
              type="venue"
              label="Imágenes del Lugar"
              images={images}
              imagePreviews={imagePreviews}
              onUpload={handleImageUpload}
              onRemove={removeImage}
            />
          </div>

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

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                Editar Contactos
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Información de Contactos</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {eventData.contacts.map((contact, index) => (
                  <div key={index} className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Nombre"
                      value={contact.name}
                      onChange={(e) =>
                        handleContactChange(index, "name", e.target.value)
                      }
                    />
                    <Input
                      placeholder="Rol"
                      value={contact.role}
                      onChange={(e) =>
                        handleContactChange(index, "role", e.target.value)
                      }
                    />
                    <Input
                      placeholder="Teléfono"
                      value={contact.phone}
                      onChange={(e) =>
                        handleContactChange(index, "phone", e.target.value)
                      }
                    />
                  </div>
                ))}
                <Button onClick={addContact} variant="outline">
                  Agregar Contacto
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                Editar Lista de Personal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Lista de Personal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {eventData.staff.map((member, index) => (
                  <div key={index} className="grid grid-cols-4 gap-2">
                    <Input
                      placeholder="Nombre"
                      value={member.name}
                      onChange={(e) =>
                        handleStaffChange(index, "name", e.target.value)
                      }
                    />
                    <Input
                      placeholder="Primer Apellido"
                      value={member.surname1}
                      onChange={(e) =>
                        handleStaffChange(index, "surname1", e.target.value)
                      }
                    />
                    <Input
                      placeholder="Segundo Apellido"
                      value={member.surname2}
                      onChange={(e) =>
                        handleStaffChange(index, "surname2", e.target.value)
                      }
                    />
                    <Input
                      placeholder="Puesto"
                      value={member.position}
                      onChange={(e) =>
                        handleStaffChange(index, "position", e.target.value)
                      }
                    />
                  </div>
                ))}
                <Button onClick={addStaffMember} variant="outline">
                  Agregar Miembro de Personal
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                Editar Logística de Personal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Arreglos de Viaje</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {travelArrangements.map((arrangement, index) => (
                  <div key={index} className="space-y-4 p-4 border rounded-lg">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-medium">
                        Arreglo de Viaje {index + 1}
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTravelArrangement(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <Select
                      value={arrangement.transportation_type}
                      onValueChange={(value) =>
                        updateTravelArrangement(index, "transportation_type", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione el tipo de transporte" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="van">Furgoneta</SelectItem>
                        <SelectItem value="sleeper_bus">Sleeper Bus Litera</SelectItem>
                        <SelectItem value="train">Tren</SelectItem>
                        <SelectItem value="plane">Avión</SelectItem>
                        <SelectItem value="RV">Autocaravana</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Dirección de Recogida</Label>
                        <Select
                          value={arrangement.pickup_address || "address1"}
                          onValueChange={(value) =>
                            updateTravelArrangement(index, "pickup_address", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione la dirección de recogida" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Nave Sector-Pro. C\\Puerto Rico 6, 28971 - Griñon 1">
                              Nave Sector-Pro. C\Puerto Rico 6, 28971 - Griñon 1
                            </SelectItem>
                            <SelectItem value="C\\ Corregidor Diego de Valderrabano 23, Moratalaz">
                              C\ Corregidor Diego de Valderrabano 23, Moratalaz
                            </SelectItem>
                            <SelectItem value="C\\ Entrepeñas 47, Ensanche de Vallecas">
                              C\ Entrepeñas 47, Ensanche de Vallecas
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Hora de Recogida</Label>
                        <Input
                          type="datetime-local"
                          value={arrangement.pickup_time || ""}
                          onChange={(e) =>
                            updateTravelArrangement(index, "pickup_time", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    {(arrangement.transportation_type === "train" ||
                      arrangement.transportation_type === "plane") && (
                      <div>
                        <Label>Número de Vuelo/Tren</Label>
                        <Input
                          value={arrangement.flight_train_number || ""}
                          onChange={(e) =>
                            updateTravelArrangement(index, "flight_train_number", e.target.value)
                          }
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Hora de Salida</Label>
                        <Input
                          type="datetime-local"
                          value={arrangement.departure_time || ""}
                          onChange={(e) =>
                            updateTravelArrangement(index, "departure_time", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>Hora de Llegada</Label>
                        <Input
                          type="datetime-local"
                          value={arrangement.arrival_time || ""}
                          onChange={(e) =>
                            updateTravelArrangement(index, "arrival_time", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Notas</Label>
                      <Textarea
                        value={arrangement.notes || ""}
                        onChange={(e) =>
                          updateTravelArrangement(index, "notes", e.target.value)
                        }
                      />
                    </div>
                  </div>
                ))}
                <Button onClick={addTravelArrangement} variant="outline">
                  Agregar Arreglo de Viaje
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                Editar Asignaciones de Habitaciones
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Asignaciones de Habitaciones</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {roomAssignments.map((assignment, index) => (
                  <div key={index} className="space-y-4 p-4 border rounded-lg">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-medium">
                        Asignación de Habitación {index + 1}
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRoomAssignment(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <Select
                      value={assignment.room_type}
                      onValueChange={(value) =>
                        updateRoomAssignment(
                          index,
                          "room_type",
                          value as "single" | "double"
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione el tipo de habitación" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Individual</SelectItem>
                        <SelectItem value="double">Doble</SelectItem>
                      </SelectContent>
                    </Select>

                    <div>
                      <Label>Número de Habitación</Label>
                      <Input
                        value={assignment.room_number || ""}
                        onChange={(e) =>
                          updateRoomAssignment(index, "room_number", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <Label>Personal Asignado 1</Label>
                      <Select
                        value={assignment.staff_member1_id || "unassigned"}
                        onValueChange={(value) =>
                          updateRoomAssignment(
                            index,
                            "staff_member1_id",
                            value !== "unassigned" ? value : ""
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un miembro" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Sin asignar</SelectItem>
                          {eventData.staff.map((member) => (
                            <SelectItem key={member.name} value={member.name}>
                              {`${member.name} ${member.surname1 || ""}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {assignment.room_type === "double" && (
                      <div>
                        <Label>Personal Asignado 2</Label>
                        <Select
                          value={assignment.staff_member2_id || "unassigned"}
                          onValueChange={(value) =>
                            updateRoomAssignment(
                              index,
                              "staff_member2_id",
                              value !== "unassigned" ? value : ""
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione un miembro" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Sin asignar</SelectItem>
                            {eventData.staff.map((member) => (
                              <SelectItem key={member.name} value={member.name}>
                                {`${member.name} ${member.surname1 || ""}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ))}
                <Button onClick={addRoomAssignment} variant="outline">
                  Agregar Asignación de Habitación
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <div>
            <Label htmlFor="schedule">Programa</Label>
            <Textarea
              id="schedule"
              value={eventData.schedule}
              onChange={(e) =>
                setEventData({ ...eventData, schedule: e.target.value })
              }
              className="min-h-[200px]"
              placeholder="Load in: 08:00&#10;Soundcheck: 14:00&#10;Doors: 19:00&#10;Show: 20:00..."
            />
          </div>

          <div>
            <Label htmlFor="powerRequirements">Requisitos Eléctricos</Label>
            <Textarea
              id="powerRequirements"
              value={eventData.powerRequirements}
              onChange={(e) =>
                setEventData({
                  ...eventData,
                  powerRequirements: e.target.value,
                })
              }
              className="min-h-[150px]"
              placeholder="Los requisitos eléctricos se completarán automáticamente cuando estén disponibles..."
            />
          </div>

          <div>
            <Label htmlFor="auxiliaryNeeds">Necesidades Auxiliares</Label>
            <Textarea
              id="auxiliaryNeeds"
              value={eventData.auxiliaryNeeds}
              onChange={(e) =>
                setEventData({ ...eventData, auxiliaryNeeds: e.target.value })
              }
              className="min-h-[150px]"
              placeholder="Requerimientos del equipo de carga, necesidades de equipamiento..."
            />
          </div>

          <Button onClick={generateDocument} className="w-full">
            Generar Hoja de Ruta
          </Button>
        </CardContent>
      </ScrollArea>
    </Card>
  );
};

export default HojaDeRutaGenerator;
