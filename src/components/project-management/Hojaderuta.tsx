
import React, { useState, useEffect } from "react";
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
import { Trash2, Calendar } from "lucide-react";
import { useJobSelection } from "@/hooks/useJobSelection";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AutoTableJsPDF extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

interface ImageUploads {
  venue: File[];
}

interface ImagePreviews {
  venue: string[];
}

interface TravelArrangement {
  transportation_type: "van" | "sleeper_bus" | "train" | "plane" | "RV";
  pickup_address?: string;
  pickup_time?: string;
  flight_train_number?: string;
  departure_time?: string;
  arrival_time?: string;
  notes?: string;
}

interface RoomAssignment {
  room_type: "single" | "double";
  room_number?: string;
  staff_member1_id?: string;
  staff_member2_id?: string;
}

interface EventData {
  eventName: string;
  eventDates: string;
  venue: {
    name: string;
    address: string;
  };
  contacts: { name: string; role: string; phone: string }[];
  logistics: {
    transport: string;
    loadingDetails: string;
    unloadingDetails: string;
  };
  staff: { name: string; surname1: string; surname2: string; position: string }[];
  schedule: string;
  powerRequirements: string;
  auxiliaryNeeds: string;
}

const ImageUploadSection = ({ type, label }: { type: keyof ImageUploads; label: string }) => {
  const { images, imagePreviews, handleImageUpload } = useImageUploads();
  
  return (
    <div className="space-y-4">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-4">
        <Input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleImageUpload(type, e.target.files)}
        />
        <div className="flex flex-wrap gap-2">
          {imagePreviews[type]?.map((preview, index) => (
            <img
              key={index}
              src={preview}
              alt={`Preview ${index + 1}`}
              className="w-24 h-24 object-cover rounded"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const useImageUploads = () => {
  const [images, setImages] = useState<ImageUploads>({
    venue: [],
  });
  const [imagePreviews, setImagePreviews] = useState<ImagePreviews>({
    venue: [],
  });

  const handleImageUpload = async (
    type: keyof ImageUploads,
    files: FileList | null
  ) => {
    if (!files) return;
    const fileArray = Array.from(files);
    setImages({ ...images, [type]: [...(images[type] || []), ...fileArray] });

    const previews = fileArray.map((file) => URL.createObjectURL(file));
    setImagePreviews((prev) => ({
      ...prev,
      [type]: [...(prev[type] || []), ...previews],
    }));
  };

  return { images, imagePreviews, handleImageUpload };
};

const HojaDeRutaGenerator = () => {
  const { toast } = useToast();
  const { data: jobs, isLoading: isLoadingJobs } = useJobSelection();
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const { images, imagePreviews, handleImageUpload } = useImageUploads();

  const [eventData, setEventData] = useState<EventData>({
    eventName: "",
    eventDates: "",
    venue: {
      name: "",
      address: "",
    },
    contacts: [{ name: "", role: "", phone: "" }],
    logistics: {
      transport: "",
      loadingDetails: "",
      unloadingDetails: "",
    },
    staff: [{ name: "", surname1: "", surname2: "", position: "" }],
    schedule: "",
    powerRequirements: "",
    auxiliaryNeeds: "",
  });

  const [venueMap, setVenueMap] = useState<File | null>(null);
  const [venueMapPreview, setVenueMapPreview] = useState<string | null>(null);

  const [powerRequirements, setPowerRequirements] = useState<string>("");
  const [travelArrangements, setTravelArrangements] = useState<TravelArrangement[]>([
    { transportation_type: "van" },
  ]);
  const [roomAssignments, setRoomAssignments] = useState<RoomAssignment[]>([
    { room_type: "single" },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleVenueMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVenueMap(file);
      const preview = URL.createObjectURL(file);
      setVenueMapPreview(preview);
    }
  };

  const handleContactChange = (
    index: number,
    field: keyof EventData["contacts"][0],
    value: string
  ) => {
    const newContacts = [...eventData.contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setEventData({ ...eventData, contacts: newContacts });
  };

  const addContact = () => {
    setEventData({
      ...eventData,
      contacts: [...eventData.contacts, { name: "", role: "", phone: "" }],
    });
  };

  const handleStaffChange = (
    index: number,
    field: keyof EventData["staff"][0],
    value: string
  ) => {
    const newStaff = [...eventData.staff];
    newStaff[index] = { ...newStaff[index], [field]: value };
    setEventData({ ...eventData, staff: newStaff });
  };

  const addStaffMember = () => {
    setEventData({
      ...eventData,
      staff: [...eventData.staff, { name: "", surname1: "", surname2: "", position: "" }],
    });
  };

  const removeTravelArrangement = (index: number) => {
    setTravelArrangements(travelArrangements.filter((_, i) => i !== index));
  };

  const updateTravelArrangement = (
    index: number,
    field: keyof TravelArrangement,
    value: string
  ) => {
    const newArrangements = [...travelArrangements];
    newArrangements[index] = {
      ...newArrangements[index],
      [field]: value,
    } as TravelArrangement;
    setTravelArrangements(newArrangements);
  };

  const addTravelArrangement = () => {
    setTravelArrangements([...travelArrangements, { transportation_type: "van" }]);
  };

  const removeRoomAssignment = (index: number) => {
    setRoomAssignments(roomAssignments.filter((_, i) => i !== index));
  };

  const updateRoomAssignment = (
    index: number,
    field: keyof RoomAssignment,
    value: string
  ) => {
    const newAssignments = [...roomAssignments];
    newAssignments[index] = {
      ...newAssignments[index],
      [field]: value as any,
    };
    setRoomAssignments(newAssignments);
  };

  const addRoomAssignment = () => {
    setRoomAssignments([...roomAssignments, { room_type: "single" }]);
  };

  const generateDocument = async () => {
    try {
      const doc = new jsPDF() as AutoTableJsPDF;
      
      // Title
      doc.setFontSize(20);
      doc.text("Hoja de Ruta", 14, 20);

      // Event Details
      doc.setFontSize(12);
      doc.text(`Evento: ${eventData.eventName}`, 14, 30);
      doc.text(`Fechas: ${eventData.eventDates}`, 14, 40);

      // Venue Information
      doc.text("Lugar", 14, 50);
      doc.setFontSize(10);
      doc.text(`Nombre: ${eventData.venue.name}`, 14, 60);
      doc.text(`Dirección: ${eventData.venue.address}`, 14, 70);

      // Contacts Table
      doc.setFontSize(12);
      doc.text("Contactos", 14, 90);
      autoTable(doc, {
        startY: 95,
        head: [["Nombre", "Rol", "Teléfono"]],
        body: eventData.contacts.map(contact => [
          contact.name,
          contact.role,
          contact.phone
        ]),
      });

      // Staff Table
      doc.text("Personal", 14, (doc.lastAutoTable?.finalY || 0) + 20);
      autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY || 0) + 25,
        head: [["Nombre", "Primer Apellido", "Segundo Apellido", "Puesto"]],
        body: eventData.staff.map(member => [
          member.name,
          member.surname1,
          member.surname2,
          member.position
        ]),
      });

      // Schedule
      doc.text("Programa", 14, (doc.lastAutoTable?.finalY || 0) + 20);
      doc.setFontSize(10);
      doc.text(eventData.schedule, 14, (doc.lastAutoTable?.finalY || 0) + 30);

      // Save the PDF
      doc.save(`hoja_de_ruta_${eventData.eventName.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Error al generar el PDF",
        variant: "destructive",
      });
    }
  };

  const saveHojaDeRuta = async () => {
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "Por favor, seleccione un trabajo antes de guardar.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: hojaDeRuta, error: mainError } = await supabase
        .from("hoja_de_ruta")
        .upsert({
          job_id: selectedJobId,
          event_name: eventData.eventName,
          event_dates: eventData.eventDates,
          venue_name: eventData.venue.name,
          venue_address: eventData.venue.address,
          schedule: eventData.schedule,
          power_requirements: eventData.powerRequirements,
          auxiliary_needs: eventData.auxiliaryNeeds,
        })
        .select()
        .single();

      if (mainError) throw mainError;

      if (eventData.contacts.length > 0) {
        const { error: contactsError } = await supabase
          .from("hoja_de_ruta_contacts")
          .delete()
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        if (contactsError) throw contactsError;

        const { error: insertContactsError } = await supabase
          .from("hoja_de_ruta_contacts")
          .insert(
            eventData.contacts.map((contact) => ({
              hoja_de_ruta_id: hojaDeRuta.id,
              name: contact.name,
              role: contact.role,
              phone: contact.phone,
            }))
          );

        if (insertContactsError) throw insertContactsError;
      }

      if (eventData.staff.length > 0) {
        const { error: staffError } = await supabase
          .from("hoja_de_ruta_staff")
          .delete()
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        if (staffError) throw staffError;

        const { error: insertStaffError } = await supabase
          .from("hoja_de_ruta_staff")
          .insert(
            eventData.staff.map((member) => ({
              hoja_de_ruta_id: hojaDeRuta.id,
              name: member.name,
              surname1: member.surname1,
              surname2: member.surname2,
              position: member.position,
            }))
          );

        if (insertStaffError) throw insertStaffError;
      }

      const { error: logisticsError } = await supabase
        .from("hoja_de_ruta_logistics")
        .upsert({
          hoja_de_ruta_id: hojaDeRuta.id,
          transport: eventData.logistics.transport,
          loading_details: eventData.logistics.loadingDetails,
          unloading_details: eventData.logistics.unloadingDetails,
        });

      if (logisticsError) throw logisticsError;

      if (roomAssignments.length > 0) {
        const { error: roomsError } = await supabase
          .from("hoja_de_ruta_rooms")
          .delete()
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        if (roomsError) throw roomsError;

        const { error: insertRoomsError } = await supabase
          .from("hoja_de_ruta_rooms")
          .insert(
            roomAssignments.map((room) => ({
              hoja_de_ruta_id: hojaDeRuta.id,
              room_type: room.room_type,
              room_number: room.room_number,
              staff_member1_id: room.staff_member1_id,
              staff_member2_id: room.staff_member2_id,
            }))
          );

        if (insertRoomsError) throw insertRoomsError;
      }

      if (travelArrangements.length > 0) {
        const { error: travelError } = await supabase
          .from("hoja_de_ruta_travel")
          .delete()
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        if (travelError) throw travelError;

        const { error: insertTravelError } = await supabase
          .from("hoja_de_ruta_travel")
          .insert(
            travelArrangements.map((travel) => ({
              hoja_de_ruta_id: hojaDeRuta.id,
              transportation_type: travel.transportation_type,
              pickup_address: travel.pickup_address,
              pickup_time: travel.pickup_time,
              departure_time: travel.departure_time,
              arrival_time: travel.arrival_time,
              flight_train_number: travel.flight_train_number,
              notes: travel.notes,
            }))
          );

        if (insertTravelError) throw insertTravelError;
      }

      if (images.venue.length > 0) {
        const { error: deleteImagesError } = await supabase
          .from("hoja_de_ruta_images")
          .delete()
          .eq("hoja_de_ruta_id", hojaDeRuta.id)
          .eq("image_type", "venue");

        if (deleteImagesError) throw deleteImagesError;

        for (const image of images.venue) {
          const filePath = `hoja-de-ruta/${hojaDeRuta.id}/${crypto.randomUUID()}`;
          const { error: uploadError } = await supabase.storage
            .from("job_documents")
            .upload(filePath, image);

          if (uploadError) throw uploadError;

          const { error: imageRecordError } = await supabase
            .from("hoja_de_ruta_images")
            .insert({
              hoja_de_ruta_id: hojaDeRuta.id,
              image_type: "venue",
              image_path: filePath,
            });

          if (imageRecordError) throw imageRecordError;
        }
      }

      toast({
        title: "Éxito",
        description: "Hoja de Ruta guardada correctamente",
      });
    } catch (error: any) {
      console.error("Error saving Hoja de Ruta:", error);
      toast({
        title: "Error",
        description: "Error al guardar la Hoja de Ruta: " + error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const loadHojaDeRuta = async (jobId: string) => {
    setIsLoading(true);
    try {
      const { data: hojaData, error: mainError } = await supabase
        .from("hoja_de_ruta")
        .select("*")
        .eq("job_id", jobId)
        .maybeSingle();

      if (mainError) throw mainError;

      if (hojaData) {
        const { data: contacts, error: contactsError } = await supabase
          .from("hoja_de_ruta_contacts")
          .select("*")
          .eq("hoja_de_ruta_id", hojaData.id);

        if (contactsError) throw contactsError;

        const { data: staff, error: staffError } = await supabase
          .from("hoja_de_ruta_staff")
          .select("*")
          .eq("hoja_de_ruta_id", hojaData.id);

        if (staffError) throw staffError;

        const { data: logistics, error: logisticsError } = await supabase
          .from("hoja_de_ruta_logistics")
          .select("*")
          .eq("hoja_de_ruta_id", hojaData.id)
          .maybeSingle();

        if (logisticsError) throw logisticsError;

        const { data: rooms, error: roomsError } = await supabase
          .from("hoja_de_ruta_rooms")
          .select("*")
          .eq("hoja_de_ruta_id", hojaData.id);

        if (roomsError) throw roomsError;

        const { data: travel, error: travelError } = await supabase
          .from("hoja_de_ruta_travel")
          .select("*")
          .eq("hoja_de_ruta_id", hojaData.id);

        if (travelError) throw travelError;

        const { data: images, error: imagesError } = await supabase
          .from("hoja_de_ruta_images")
          .select("*")
          .eq("hoja_de_ruta_id", hojaData.id)
          .eq("image_type", "venue");

        if (imagesError) throw imagesError;

        setEventData({
          eventName: hojaData.event_name || "",
          eventDates: hojaData.event_dates || "",
          venue: {
            name: hojaData.venue_name || "",
            address: hojaData.venue_address || "",
          },
          contacts: contacts || [],
          logistics: {
            transport: logistics?.transport || "",
            loadingDetails: logistics?.loading_details || "",
            unloadingDetails: logistics?.unloading_details || "",
          },
          staff: staff || [],
          schedule: hojaData.schedule || "",
          powerRequirements: hojaData.power_requirements || "",
          auxiliaryNeeds: hojaData.auxiliary_needs || "",
        });

        setRoomAssignments(
          rooms?.map((room) => ({
            room_type: room.room_type,
            room_number: room.room_number,
            staff_member1_id: room.staff_member1_id,
            staff_member2_id: room.staff_member2_id,
          })) || []
        );

        setTravelArrangements(
          travel?.map((t) => ({
            transportation_type: t.transportation_type,
            pickup_address: t.pickup_address,
            pickup_time: t.pickup_time,
            departure_time: t.departure_time,
            arrival_time: t.arrival_time,
            flight_train_number: t.flight_train_number,
            notes: t.notes,
          })) || []
        );

        if (images?.length > 0) {
          const imagePromises = images.map(async (img) => {
            const { data: imageData } = await supabase.storage
              .from("job_documents")
              .createSignedUrl(img.image_path, 3600);
            return imageData?.signedUrl || "";
          });

          const imageUrls = await Promise.all(imagePromises);
          setImagePreviews((prev) => ({
            ...prev,
            venue: imageUrls.filter(Boolean),
          }));
        }
      }
    } catch (error: any) {
      console.error("Error loading Hoja de Ruta:", error);
      toast({
        title: "Error",
        description: "Error al cargar la Hoja de Ruta: " + error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedJobId) {
      loadHojaDeRuta(selectedJobId);
    }
  }, [selectedJobId]);

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
            <ImageUploadSection type="venue" label="Imágenes del Lugar" />
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
            <DialogContent className="max-w-3xl">
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
                <Button onClick={addTravelArrangement
