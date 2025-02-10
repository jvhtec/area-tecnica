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

  const [images, setImages] = useState({
    venue: [] as File[],
  });
  const [imagePreviews, setImagePreviews] = useState({
    venue: [] as string[],
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

  const fetchPowerRequirements = async (jobId: string) => {
    try {
      const { data: requirements, error } = await supabase
        .from("power_requirement_tables")
        .select("*")
        .eq("job_id", jobId);

      if (error) throw error;

      if (requirements && requirements.length > 0) {
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

  const loadHojaDeRuta = async (jobId: string) => {
    try {
      const { data: hojaDeRuta, error: mainError } = await supabase
        .from("hoja_de_ruta")
        .select("*")
        .eq("job_id", jobId)
        .maybeSingle();

      if (mainError) throw mainError;

      if (hojaDeRuta) {
        const { data: contacts, error: contactsError } = await supabase
          .from("hoja_de_ruta_contacts")
          .select("*")
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        if (contactsError) throw contactsError;

        const { data: staff, error: staffError } = await supabase
          .from("hoja_de_ruta_staff")
          .select("*")
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        if (staffError) throw staffError;

        const { data: logistics, error: logisticsError } = await supabase
          .from("hoja_de_ruta_logistics")
          .select("*")
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        if (logisticsError) throw logisticsError;

        const { data: travel, error: travelError } = await supabase
          .from("hoja_de_ruta_travel")
          .select("*")
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        if (travelError) throw travelError;

        const { data: rooms, error: roomsError } = await supabase
          .from("hoja_de_ruta_rooms")
          .select("*")
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        if (roomsError) throw roomsError;

        const { data: images, error: imagesError } = await supabase
          .from("hoja_de_ruta_images")
          .select("*")
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        if (imagesError) throw imagesError;

        setEventData({
          eventName: hojaDeRuta.event_name || "",
          eventDates: hojaDeRuta.event_dates || "",
          venue: {
            name: hojaDeRuta.venue_name || "",
            address: hojaDeRuta.venue_address || "",
          },
          contacts: contacts || [{ name: "", role: "", phone: "" }],
          logistics: logistics?.[0] || {
            transport: "",
            loadingDetails: "",
            unloadingDetails: "",
          },
          staff: staff || [{ name: "", surname1: "", surname2: "", position: "" }],
          schedule: hojaDeRuta.schedule || "",
          powerRequirements: hojaDeRuta.power_requirements || "",
          auxiliaryNeeds: hojaDeRuta.auxiliary_needs || "",
        });

        if (travel) {
          setTravelArrangements(travel.map((t: any) => ({
            transportation_type: t.transportation_type,
            pickup_address: t.pickup_address,
            pickup_time: t.pickup_time,
            flight_train_number: t.flight_train_number,
            departure_time: t.departure_time,
            arrival_time: t.arrival_time,
            notes: t.notes,
          })));
        }

        if (rooms) {
          setRoomAssignments(rooms.map((r: any) => ({
            room_type: r.room_type,
            room_number: r.room_number,
            staff_member1_id: r.staff_member1_id,
            staff_member2_id: r.staff_member2_id,
          })));
        }

        if (images && images.length > 0) {
          const loadedImages: { [key: string]: string[] } = {
            venue: [],
          };

          for (const image of images) {
            if (image.image_type === "venue") {
              const { data: publicUrl } = supabase.storage
                .from("job_documents")
                .getPublicUrl(image.image_path);
              
              if (publicUrl) {
                loadedImages.venue.push(publicUrl.publicUrl);
              }
            }
          }

          setImagePreviews(loadedImages);
        }

        toast({
          title: "Datos cargados",
          description: "Se han cargado los datos existentes de la Hoja de Ruta",
        });
      }
    } catch (error) {
      console.error("Error loading hoja de ruta:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos existentes",
        variant: "destructive",
      });
    }
  };

  const saveData = async () => {
    if (!selectedJobId) return;

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

      if (hojaDeRuta) {
        await supabase
          .from("hoja_de_ruta_contacts")
          .delete()
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        const { error: contactsError } = await supabase
          .from("hoja_de_ruta_contacts")
          .insert(
            eventData.contacts.map((contact) => ({
              hoja_de_ruta_id: hojaDeRuta.id,
              name: contact.name,
              role: contact.role,
              phone: contact.phone,
            }))
          );

        if (contactsError) throw contactsError;

        await supabase
          .from("hoja_de_ruta_staff")
          .delete()
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        const { error: staffError } = await supabase
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

        if (staffError) throw staffError;

        await supabase
          .from("hoja_de_ruta_logistics")
          .delete()
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        const { error: logisticsError } = await supabase
          .from("hoja_de_ruta_logistics")
          .insert({
            hoja_de_ruta_id: hojaDeRuta.id,
            transport: eventData.logistics.transport,
            loading_details: eventData.logistics.loadingDetails,
            unloading_details: eventData.logistics.unloadingDetails,
          });

        if (logisticsError) throw logisticsError;

        await supabase
          .from("hoja_de_ruta_travel")
          .delete()
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        const { error: travelError } = await supabase
          .from("hoja_de_ruta_travel")
          .insert(
            travelArrangements.map((arrangement) => ({
              hoja_de_ruta_id: hojaDeRuta.id,
              transportation_type: arrangement.transportation_type,
              pickup_address: arrangement.pickup_address,
              pickup_time: arrangement.pickup_time,
              flight_train_number: arrangement.flight_train_number,
              departure_time: arrangement.departure_time,
              arrival_time: arrangement.arrival_time,
              notes: arrangement.notes,
            }))
          );

        if (travelError) throw travelError;

        await supabase
          .from("hoja_de_ruta_rooms")
          .delete()
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        const { error: roomsError } = await supabase
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

        if (roomsError) throw roomsError;

        const { data: existingImages } = await supabase
          .from("hoja_de_ruta_images")
          .select("image_path")
          .eq("hoja_de_ruta_id", hojaDeRuta.id);

        for (const [type, files] of Object.entries(images)) {
          for (const file of files) {
            const fileExt = file.name.split('.').pop();
            const filePath = `${hojaDeRuta.id}/${crypto.randomUUID()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from("job_documents")
              .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { error: imageError } = await supabase
              .from("hoja_de_ruta_images")
              .insert({
                hoja_de_ruta_id: hojaDeRuta.id,
                image_type: type,
                image_path: filePath,
              });

            if (imageError) throw imageError;
          }
        }

        if (existingImages) {
          for (const image of existingImages) {
            await supabase.storage
              .from("job_documents")
              .remove([image.image_path]);
          }
        }

        toast({
          title: "Guardado",
          description: "Los cambios se han guardado correctamente",
        });
      }
    } catch (error) {
      console.error("Error saving hoja de ruta:", error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los cambios",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (selectedJobId && jobs) {
      const selectedJob = jobs.find((job: any) => job.id === selectedJobId);
      if (selectedJob) {
        console.log("Trabajo seleccionado:", selectedJob);
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

  useEffect(() => {
    if (selectedJobId) {
      loadHojaDeRuta(selectedJobId);
    }
  }, [selectedJobId]);

  useEffect(() => {
    if (selectedJobId) {
      const timeoutId = setTimeout(() => {
        saveData();
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [eventData, travelArrangements, roomAssignments]);

  const handleImageUpload = async (
    type: keyof typeof images,
    files: FileList | null
  ) => {
    if (!files || !selectedJobId) return;

    const fileArray = Array.from(files);
    const newImages = [...(images[type] || []), ...fileArray];
    setImages({ ...images, [type]: newImages });

    const previews = fileArray.map((file) => URL.createObjectURL(file));
    setImagePreviews((prev) => ({
      ...prev,
      [type]: [...(prev[type] || []), ...previews],
    }));

    await saveData();
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

  const handleVenueMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVenueMap(file);
      const preview = URL.createObjectURL(file);
      setVenueMapPreview(preview);
    }
  };

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

  const uploadPdfToJob = async (
    jobId: string,
    pdfBlob: Blob,
    fileName: string
  ) => {
    try {
      console.log("Iniciando subida del PDF:", fileName);

      const sanitizedFileName = fileName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/\s+/g, "_");

      const filePath = `${crypto.randomUUID()}-${sanitizedFileName}`;
      console.log("Subiendo con la ruta sanitizada:", filePath);

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
    const bottomMargin = 60;

    const checkPageBreak = (currentY: number): number => {
      if (currentY > pageHeight - bottomMargin) {
        doc.addPage();
        return 20;
      }
      return currentY;
    };

    doc.setFillColor(125, 1, 1);
    doc.rect(0, 0, pageWidth, 40, "F");

    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text("Hoja de Ruta", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(16);
    doc.text(eventData.eventName, pageWidth / 2, 30, { align: "center" });

    let yPosition = 50;
    doc.setFontSize(12);
    doc.setTextColor(51, 51, 51);

    yPosition = checkPageBreak(yPosition);
    doc.text(`Fechas: ${eventData.eventDates}`, 20, yPosition);
    yPosition += 15;

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
      autoTable(doc, {
        startY: yPosition,
        head: [["Nombre", "Rol", "Teléfono"]],
        body: contactsTableData,
        theme: "grid",
        styles: { fontSize: 10 },
      });
      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    if (
      eventData.logistics.transport ||
      eventData.logistics.loadingDetails ||
      eventData.logistics.unloadingDetails
    ) {
      yPosition = checkPageBreak(yPosition);
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text("Logística", 20, yPosition);
      yPosition += 10;
      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      const logisticsText = [
        { label: "Transporte:", value: eventData.logistics.transport },
        { label: "Detalles de Carga:", value: eventData.logistics.loadingDetails },
        { label: "Detalles de Descarga:", value: eventData.logistics.unloadingDetails },
      ];
      logisticsText.forEach((item) => {
        if (item.value) {
          doc.text(item.label, 30, yPosition);
          const lines = doc.splitTextTo
