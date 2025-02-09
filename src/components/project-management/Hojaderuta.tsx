<lov-code>
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

// Extensión de jsPDF para usar autoTable
interface AutoTableJsPDF extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
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

// Add TypeScript interfaces for handling data
interface SaveStatus {
  isSaving: boolean;
  lastSaved: Date | null;
}

const HojaDeRutaGenerator = () => {
  const { toast } = useToast();
  const { data: jobs, isLoading: isLoadingJobs } = useJobSelection();
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");

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

  // ---------------------------
  // ESTADOS DE IMÁGENES Y ARCHIVOS
  // ---------------------------
  const [images, setImages] = useState({
    venue: [] as File[],
  });
  const [imagePreviews, setImagePreviews] = useState({
    venue: [] as string[],
  });
  // Estado para el mapa de ubicación del lugar (archivo único)
  const [venueMap, setVenueMap] = useState<File | null>(null);
  const [venueMapPreview, setVenueMapPreview] = useState<string | null>(null);

  const [powerRequirements, setPowerRequirements] = useState<string>("");
  const [travelArrangements, setTravelArrangements] = useState<TravelArrangement[]>([
    { transportation_type: "van" },
  ]);
  const [roomAssignments, setRoomAssignments] = useState<RoomAssignment[]>([
    { room_type: "single" },
  ]);

  // Add new state for save status
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    isSaving: false,
    lastSaved: null,
  });

  // ---------------------------
  // UTILIDAD: cargar imagen desde URL como DataURL
  // ---------------------------
  const loadImageAsDataURL = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error al cargar la imagen", error);
      return null;
    }
  };

  // Function to load existing data
  const loadExistingData = async (jobId: string) => {
    try {
      // Fetch main hoja de ruta data
      const { data: hojaData, error: hojaError } = await supabase
        .from('hoja_de_ruta')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

      if (hojaError) throw hojaError;

      if (hojaData) {
        setEventData((prev) => ({
          ...prev,
          eventName: hojaData.event_name || '',
          eventDates: hojaData.event_dates || '',
          venue: {
            name: hojaData.venue_name || '',
            address: hojaData.venue_address || '',
          },
          schedule: hojaData.schedule || '',
          powerRequirements: hojaData.power_requirements || '',
          auxiliaryNeeds: hojaData.auxiliary_needs || '',
        }));

        // Load contacts
        const { data: contactsData } = await supabase
          .from('hoja_de_ruta_contacts')
          .select('*')
          .eq('hoja_de_ruta_id', hojaData.id);

        if (contactsData && contactsData.length > 0) {
          setEventData((prev) => ({
            ...prev,
            contacts: contactsData.map((contact) => ({
              name: contact.name,
              role: contact.role || '',
              phone: contact.phone || '',
            })),
          }));
        }

        // Load logistics
        const { data: logisticsData } = await supabase
          .from('hoja_de_ruta_logistics')
          .select('*')
          .eq('hoja_de_ruta_id', hojaData.id)
          .maybeSingle();

        if (logisticsData) {
          setEventData((prev) => ({
            ...prev,
            logistics: {
              transport: logisticsData.transport || '',
              loadingDetails: logisticsData.loading_details || '',
              unloadingDetails: logisticsData.unloading_details || '',
            },
          }));
        }

        // Load staff
        const { data: staffData } = await supabase
          .from('hoja_de_ruta_staff')
          .select('*')
          .eq('hoja_de_ruta_id', hojaData.id);

        if (staffData && staffData.length > 0) {
          setEventData((prev) => ({
            ...prev,
            staff: staffData.map((staff) => ({
              name: staff.name,
              surname1: staff.surname1 || '',
              surname2: staff.surname2 || '',
              position: staff.position || '',
            })),
          }));
        }

        // Load room assignments
        const { data: roomsData } = await supabase
          .from('hoja_de_ruta_rooms')
          .select('*')
          .eq('hoja_de_ruta_id', hojaData.id);

        if (roomsData && roomsData.length > 0) {
          setRoomAssignments(
            roomsData.map((room) => ({
              room_type: room.room_type,
              room_number: room.room_number || '',
              staff_member1_id: room.staff_member1_id || '',
              staff_member2_id: room.staff_member2_id || '',
            }))
          );
        }

        // Load travel arrangements
        const { data: travelData } = await supabase
          .from('hoja_de_ruta_travel')
          .select('*')
          .eq('hoja_de_ruta_id', hojaData.id);

        if (travelData && travelData.length > 0) {
          setTravelArrangements(
            travelData.map((travel) => ({
              transportation_type: travel.transportation_type,
              pickup_address: travel.pickup_address || '',
              pickup_time: travel.pickup_time ? new Date(travel.pickup_time).toISOString() : '',
              departure_time: travel.departure_time ? new Date(travel.departure_time).toISOString() : '',
              arrival_time: travel.arrival_time ? new Date(travel.arrival_time).toISOString() : '',
              flight_train_number: travel.flight_train_number || '',
              notes: travel.notes || '',
            }))
          );
        }

        // Load images
        const { data: imagesData } = await supabase
          .from('hoja_de_ruta_images')
          .select('*')
          .eq('hoja_de_ruta_id', hojaData.id);

        if (imagesData && imagesData.length > 0) {
          // We'll need to fetch the actual images from storage and convert them to File objects
          const venueImages = imagesData.filter((img) => img.image_type === 'venue');
          const mapImage = imagesData.find((img) => img.image_type === 'map');

          if (mapImage) {
            const mapUrl = supabase.storage.from('job_documents').getPublicUrl(mapImage.image_path).data.publicUrl;
            setVenueMapPreview(mapUrl);
          }

          if (venueImages.length > 0) {
            const venueUrls = venueImages.map((img) => 
              supabase.storage.from('job_documents').getPublicUrl(img.image_path).data.publicUrl
            );
            setImagePreviews((prev) => ({
              ...prev,
              venue: venueUrls,
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error loading hoja de ruta data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos existentes",
        variant: "destructive",
      });
    }
  };

  // ---------------------------
  // FUNCIONES DE CONSULTA
  // ---------------------------
  const fetchPowerRequirements = async (jobId: string) => {
    try {
      const { data: requirements, error } = await supabase
        .from("power_requirement_tables")
        .select("*")
        .eq("job_id", jobId);

      if (error) throw error;

      if (requirements && requirements.length > 0) {
        // Formatear los requisitos eléctricos en texto legible
        const formattedRequirements = requirements
          .map((req: any) => {
            return `${req.department.toUpperCase()} - ${req.table_name}:\n` +
              `Potencia Total: ${req.total_watts}W\n` +
              `Corriente por Fase: ${req.current_per_phase}A\n` +
              `PDU Recomendado: ${req.pdu_type}\n`;
          })
          .join("\n");
        setPowerRequirements(formattedRequirements);
        setEventData((prev) => ({
          ...prev,
          powerRequirements: formattedRequirements,
        }));
      }
    } catch (error: any) {
      console.error("Error al obtener los requisitos eléctricos:", error);
      toast({
        title: "Error",
        description: "No se pudieron obtener los requisitos eléctricos",
        variant: "destructive",
      });
    }
  };

  const fetchAssignedStaff = async (jobId: string) => {
    try {
      const { data: assignments, error } = await supabase
        .from("job_assignments")
        .select(
          `
          *,
          profiles:technician_id (
            first_name,
            last_name
          )
        `
        )
        .eq("job_id", jobId);

      if (error) throw error;

      if (assignments && assignments.length > 0) {
        const staffList = assignments.map((assignment: any) => ({
          name: assignment.profiles.first_name,
          surname1: assignment.profiles.last_name,
          surname2: "",
          position:
            assignment.sound_role ||
            assignment.lights_role ||
            assignment.video_role ||
            "Técnico",
        }));

        setEventData((prev) => ({
          ...prev,
          staff: staffList,
        }));
      }
    } catch (error) {
      console.error("Error al obtener el personal:", error);
      toast({
        title: "Error",
        description: "No se pudo obtener el personal asignado",
        variant: "destructive",
      });
    }
  };

  // Update useEffect to load data when job is selected
  useEffect(() => {
    if (selectedJobId) {
      loadExistingData(selectedJobId);
    }
  }, [selectedJobId]);

  useEffect(() => {
    if (selectedJobId && jobs) {
      const selectedJob = jobs.find((job: any) => job.id === selectedJobId);
      if (selectedJob) {
        console.log("Trabajo seleccionado:", selectedJob);
        // Formatear fechas
        const formattedDates = `${format(
          new Date(selectedJob.start_time),
          "dd/MM/yyyy HH:mm"
        )} - ${format(new Date(selectedJob.end_time), "dd/MM/yyyy HH:mm")}`;

        setEventData((prev) => ({
          ...prev,
          eventName: selectedJob.title,
          eventDates: formattedDates,
        }));

        fetchPowerRequirements(selectedJob.id);
        fetchAssignedStaff(selectedJob.id);

        toast({
          title: "Trabajo Seleccionado",
          description: "El formulario se ha actualizado con los detalles del trabajo",
        });
      }
    }
  }, [selectedJobId, jobs]);

  // ---------------------------
  // MANEJADORES DE IMÁGENES
  // ---------------------------
  const handleImageUpload = (
    type: keyof typeof images,
    files: FileList | null
  ) => {
    if (!files) return;
    const fileArray = Array.from(files);
    const newImages = [...(images[type] || []), ...fileArray];
    setImages({ ...images, [type]: newImages });

    const previews = fileArray.map((file) => URL.createObjectURL(file));
    setImagePreviews((prev) => ({
      ...prev,
      [type]: [...(prev[type] || []), ...previews],
    }));
  };

  const removeImage = (type: keyof typeof images, index: number) => {
    const newImages = [...images[type]];
    const newPreviews = [...imagePreviews[type]];
    URL.revokeObjectURL(newPreviews[index]);
    newImages.splice(index, 1);
    newPreviews.splice(index, 1);
    setImages({ ...images, [type]: newImages });
    setImagePreviews({ ...imagePreviews, [type]: newPreviews });
  };

  // Manejador para subir el mapa de ubicación del lugar
  const handleVenueMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVenueMap(file);
      const preview = URL.createObjectURL(file);
      setVenueMapPreview(preview);
    }
  };

  // ---------------------------
  // MANEJADORES DE CONTACTOS Y PERSONAL
  // ---------------------------
  const handleContactChange = (index: number, field: string, value: string) => {
    const newContacts = [...eventData.contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setEventData({ ...eventData, contacts: newContacts });
  };

  const handleStaffChange = (index: number, field: string, value: string) => {
    const newStaff = [...eventData.staff];
    newStaff[index] = { ...newStaff[index], [field]: value };
    setEventData({ ...eventData, staff: newStaff });
  };

  const addContact = () => {
    setEventData({
      ...eventData,
      contacts: [...eventData.contacts, { name: "", role: "", phone: "" }],
    });
  };

  const addStaffMember = () => {
    setEventData({
      ...eventData,
      staff: [
        ...eventData.staff,
        { name: "", surname1: "", surname2: "", position: "" },
      ],
    });
  };

  // ---------------------------
  // MANEJADORES DE ARREGLOS DE VIAJE Y ASIGNACIONES DE HABITACIONES
  // ---------------------------
  const addTravelArrangement = () => {
    setTravelArrangements([...travelArrangements, { transportation_type: "van" }]);
  };

  const removeTravelArrangement = (index: number) => {
    const newArrangements = [...travelArrangements];
    newArrangements.splice(index, 1);
    setTravelArrangements(newArrangements);
  };

  const updateTravelArrangement = (
    index: number,
    field: keyof TravelArrangement,
    value: string
  ) => {
    const newArrangements = [...travelArrangements];
    newArrangements[index] = { ...newArrangements[index], [field]: value };
    setTravelArrangements(newArrangements);
  };

  const addRoomAssignment = () => {
    setRoomAssignments([...roomAssignments, { room_type: "single" }]);
  };

  const removeRoomAssignment = (index: number) => {
    const newAssignments = [...roomAssignments];
    newAssignments.splice(index, 1);
    setRoomAssignments(newAssignments);
  };

  const updateRoomAssignment = (
    index: number,
    field: keyof RoomAssignment,
    value: string
  ) => {
    const newAssignments = [...roomAssignments];
    newAssignments[index] = { ...newAssignments[index], [field]: value };
    setRoomAssignments(newAssignments);
  };

  // Function to save all data
  const saveHojaDeRuta = async () => {
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "Por favor, seleccione un trabajo antes de guardar",
        variant: "destructive",
      });
      return;
    }

    setSaveStatus((prev) => ({ ...prev, isSaving: true }));

    try {
      // First, create or update the main hoja de ruta entry
      const { data: hojaData, error: hojaError } = await supabase
        .from('hoja_de_ruta')
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
        .maybeSingle();

      if (hojaError) throw hojaError;
      if (!hojaData) throw new Error('No se pudo crear la hoja de ruta');

      const hojaId = hojaData.id;

      // Save contacts
      if (eventData.contacts.length > 0) {
        const { error: contactsError } = await supabase
          .from('hoja_de_ruta_contacts')
          .upsert(
            eventData.contacts.map((contact) => ({
              hoja_de_ruta_id: hojaId,
              name: contact.name,
              role: contact.role,
              phone: contact.phone,
            }))
          );
        if (contactsError) throw contactsError;
      }

      // Save logistics
      const { error: logisticsError } = await supabase
        .from('hoja_de_ruta_logistics')
        .upsert({
          hoja_de_ruta_id: hojaId,
          transport: eventData.logistics.transport,
          loading_details: eventData.logistics.loadingDetails,
          unloading_details: eventData.logistics.unloadingDetails,
        });
      if (logisticsError) throw logisticsError;

      // Save staff
      if (eventData.staff.length > 0) {
        const { error: staffError } = await supabase
          .from('hoja_de_ruta_staff')
          .upsert(
            eventData.staff.map((staff) => ({
              hoja_de_ruta_id: hojaId,
              name: staff.name,
              surname1: staff.surname1,
              surname2: staff.surname2,
              position: staff.position,
            }))
          );
        if (staffError) throw staffError;
      }

      // Save room assignments
      if (roomAssignments.length > 0) {
        const { error: roomsError } = await supabase
          .from('hoja_de_ruta_rooms')
          .upsert(
            roomAssignments.map((room) => ({
              hoja_de_ruta_id: hojaId,
              room_type: room.room_type,
              room_number: room.room_number,
              staff_member1_id: room.staff_member1_id,
              staff_member2_id: room.staff_member2_id,
            }))
          );
        if (roomsError) throw roomsError;
      }

      // Save travel arrangements
      if (travelArrangements.length > 0) {
        const { error: travelError } = await supabase
          .from('hoja_de_ruta_travel')
          .upsert(
            travelArrangements.map((travel) => ({
              hoja_de_ruta_id: hojaId,
              transportation_type: travel.transportation_type,
              pickup_address: travel.pickup_address,
              pickup_time: travel.pickup_time,
              departure_time: travel.departure_time,
              arrival_time: travel.arrival_time,
              flight_train_number: travel.flight_train_number,
              notes: travel.notes,
            }))
          );
        if (travelError) throw travelError;
      }

      // Handle image uploads
      // First, delete existing images
      const { error: deleteImagesError } = await supabase
        .from('hoja_de_ruta_images')
        .delete()
        .eq('hoja_de_ruta_id', hojaId);

      if (deleteImagesError) throw deleteImagesError;

      // Upload new images
      const imagePromises: Promise<any>[] = [];

      // Upload venue images
      if (images.venue.length > 0) {
        for (const file of images.venue) {
          const filePath = `${crypto.randomUUID()}-${file.name}`;
          imagePromises.push(
            supabase.storage
              .from('job_documents')
              .upload(filePath, file)
              .then(async ({ error: uploadError }) => {
                if (uploadError) throw uploadError;
                const { error: imageError } = await supabase
                  .from('hoja_de_ruta_images')
                  .insert({
                    hoja_de_ruta_id: hojaId,
                    image_type: 'venue',
                    image_path: filePath,
                  });
                if (imageError) throw imageError;
              })
          );
        }
      }

      // Upload venue map
      if (venueMap) {
        const mapPath = `${crypto.randomUUID()}-${venueMap.name}`;
        imagePromises.push(
          supabase.storage
            .from('job_documents')
            .upload(mapPath, venueMap)
            .then(async ({ error: uploadError }) => {
              if (uploadError) throw uploadError;
              const { error: imageError } = await supabase
                .from('hoja_de_ruta_images')
                .insert({
                  hoja_de_ruta_id: hojaId,
                  image_type: 'map',
                  image_path: mapPath,
                });
              if (imageError) throw imageError;
            })
        );
      }

      await Promise.all(imagePromises);

      setSaveStatus({
        isSaving: false,
        lastSaved: new Date(),
      });

      toast({
        title: "Éxito",
        description: "Hoja de ruta guardada correctamente",
      });
    } catch (error) {
      console.error('Error saving hoja de ruta:', error);
      setSaveStatus((prev) => ({ ...prev, isSaving: false }));
      toast({
        title: "Error",
        description: "No se pudo guardar la hoja de ruta",
        variant: "destructive",
      });
    }
  };

  // ---------------------------
  // COMPONENTE DE SUBIDA DE IMÁGENES
  // ---------------------------
  interface ImageUploadSectionProps {
    type: keyof typeof images;
    label: string;
  }
  const ImageUploadSection = ({ type, label }: ImageUploadSectionProps) => {
    return (
      <div className="space-y-4">
        <Label htmlFor={`${type}-upload`}>{label}</Label>
        <Input
          id={`${type}-upload`}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleImageUpload(type, e.target.files)}
        />
        {imagePreviews[type]?.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {imagePreviews[type].map((preview, index) => (
              <div key={index} className="relative group">
                <img
                  src={preview}
                  alt={`${type} vista previa ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg"
                />
                <button
                  onClick={() => removeImage(type, index)}
                  className="absolute top-2 right-2 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ---------------------------
  // SUBIDA DEL PDF A SUPABASE
  // ---------------------------
  const uploadPdfToJob = async (
    jobId: string,
    pdfBlob: Blob,
    fileName: string
  ) => {
    try {
      console.log("Iniciando subida del PDF:", fileName);

      // Sanitizar el nombre del archivo
      const sanitizedFileName = fileName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/\s+/g, "_");

      const filePath = `${crypto.randomUUID()}-${sanitizedFileName}`;
      console.log("Subiendo con la ruta sanitizada:", filePath);

      // Subir a Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("job_documents")
        .upload(filePath, pdfBlob, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        console.error("Error en la subida:", uploadError);
        throw uploadError;
      }

      console.log("Archivo subido con éxito:", uploadData);

      // Crear un registro en la base de datos
      const { error: dbError } = await supabase.from("job_documents").insert({
        job_id: jobId,
        file_name: fileName,
        file_path: filePath,
        file_type: "application/pdf",
        file_size: pdfBlob.size,
      });

      if (dbError) {
        console.error("Error en la base de datos:", dbError);
        throw dbError;
      }

      toast({
        title: "Éxito",
        description: "La Hoja de Ruta ha sido generada y subida",
      });
    } catch (error: any) {
      console.error("Fallo en la subida:", error);
      toast({
        title: "Fallo en la subida",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Add save button next to generate button
  const renderButtons = () => (
    <div className="flex gap-4">
      <Button
        onClick={saveHojaDeRuta}
        disabled={saveStatus.isSaving || !selectedJobId}
        className="w-full"
      >
        {saveStatus.isSaving ? (
          <span className="flex items-center gap-2">
            Guardando...
          </span>
        ) : (
          "Guardar Hoja de Ruta"
        )}
      </Button>
      <Button 
        onClick={generateDocument} 
        disabled={!selectedJobId} 
        className="w-full"
      >
        Generar Hoja de Ruta
      </Button>
    </div>
  );

  // ---------------------------
  // GENERAR DOCUMENTO PDF (Todo en español)
  // ---------------------------
  const generateDocument = async () => {
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "Por favor, seleccione un trabajo antes de generar el documento.",
        variant: "destructive",
      });
      return;
    }

    const selectedJob = jobs?.find((job: any) => job.id === selectedJobId);
    const jobTitle = selectedJob?.title || "Trabajo_Sin_Nombre";

    const doc = new jsPDF() as AutoTableJsPDF;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const bottomMargin = 60; // Reservar 60 puntos en la parte inferior para el logo

    // Función auxiliar para agregar una página si la posición actual excede el área segura
    const checkPageBreak = (currentY: number): number => {
      if (currentY > pageHeight - bottomMargin) {
        doc.addPage();
        return 20;
      }
      return currentY;
    };

    // Agregar fondo de cabecera en la primera página
    doc.setFillColor(125, 1, 1);
    doc.rect(0, 0, pageWidth, 40, "F");

    // Título y nombre del evento (centrado, texto blanco)
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text("Hoja de Ruta", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(16);
    doc.text(eventData.eventName, pageWidth / 2, 30, { align: "center" });

    let yPosition = 50;
    doc.setFontSize(12);
    doc.setTextColor(51, 51, 51);

    // Fechas del evento
    yPosition = checkPageBreak(yPosition);
    doc.text(`Fechas: ${eventData.eventDates}`, 20, yPosition);
    yPosition += 15;

    // Sección de Información del Lugar
    yPosition = checkPageBreak(yPosition);
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text("Información del Lugar", 20, yPosition);
    yPosition += 10;
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);
    doc.text(`Nombre: ${eventData.venue.name}`, 30, yPosition);
    yPosition += 7;
    doc.text(`Dirección: ${eventData.venue.address}`, 30, yPosition);
    yPosition += 15;
    // Insertar el mapa de ubicación del lugar, si está disponible
    if (venueMapPreview) {
      try {
        const mapWidth = 100;
        const mapHeight = 60;
        doc.addImage(venueMapPreview, "JPEG", 30, yPosition, mapWidth, mapHeight);
        yPosition += mapHeight + 10;
      } catch (error) {
        console.error("Error al agregar el mapa del lugar al PDF:", error);
      }
    }

    // Sección de Contactos
    if (
      eventData.contacts.some(
        (contact) => contact.name || contact.role || contact.phone
      )
    ) {
      yPosition = checkPageBreak(yPosition);
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text("Contactos", 20, yPosition);
      yPosition += 10;

      const contactsTableData = eventData.contacts.map((contact) => [
        contact.name,
        contact.role,
        contact.phone,
      ]);
