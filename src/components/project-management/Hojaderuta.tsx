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

interface ImageUploadSectionProps {
  type: 'venue';
  label: string;
  images: {
    venue: File[];
  };
  imagePreviews: {
    venue: string[];
  };
  setImages: React.Dispatch<React.SetStateAction<{
    venue: File[];
  }>>;
  setImagePreviews: React.Dispatch<React.SetStateAction<{
    venue: string[];
  }>>;
}

const ImageUploadSection = ({ 
  type, 
  label,
  images,
  imagePreviews,
  setImages,
  setImagePreviews
}: ImageUploadSectionProps) => {
  const handleImageUpload = (files: FileList | null) => {
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

  const removeImage = (index: number) => {
    const newImages = [...images[type]];
    const newPreviews = [...imagePreviews[type]];
    URL.revokeObjectURL(newPreviews[index]);
    newImages.splice(index, 1);
    newPreviews.splice(index, 1);
    setImages({ ...images, [type]: newImages });
    setImagePreviews({ ...imagePreviews, [type]: newPreviews });
  };

  return (
    <div className="space-y-4">
      <Label>{label}</Label>
      <Input
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleImageUpload(e.target.files)}
      />
      <div className="grid grid-cols-3 gap-4">
        {imagePreviews[type]?.map((preview, index) => (
          <div key={index} className="relative">
            <img
              src={preview}
              alt={`Preview ${index + 1}`}
              className="w-full h-32 object-cover rounded-md"
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => removeImage(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

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

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

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

  const handleStateChange = () => {
    setHasChanges(true);
  };

  useEffect(() => {
    handleStateChange();
  }, [eventData, travelArrangements, roomAssignments]);

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
          const lines = doc.splitTextToSize(item.value, pageWidth - 60);
          doc.text(lines, 30, yPosition + 7);
          yPosition += lines.length * 7 + 15;
          yPosition = checkPageBreak(yPosition);
        }
      });
    }

    if (
      eventData.staff.some(
        (person) => person.name || person.surname1 || person.surname2 || person.position
      )
    ) {
      yPosition = checkPageBreak(yPosition);
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text("Lista de Personal", 20, yPosition);
      yPosition += 10;

      const staffTableData = eventData.staff.map((person) => [
        person.name,
        person.surname1,
        person.surname2,
        person.position,
      ]);
      autoTable(doc, {
        startY: yPosition,
        head: [["Nombre", "Primer Apellido", "Segundo Apellido", "Puesto"]],
        body: staffTableData,
        theme: "grid",
        styles: { fontSize: 10 },
      });
      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    if (
      travelArrangements.length > 0 &&
      travelArrangements.some((arr) =>
        Object.values(arr).some((val) => val && val !== "")
      )
    ) {
      yPosition = checkPageBreak(yPosition);
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text("Arreglos de Viaje", 20, yPosition);
      yPosition += 10;
      const travelTableData = travelArrangements.map((arr) => [
        arr.transportation_type,
        `${arr.pickup_address || ""} ${arr.pickup_time || ""}`.trim(),
        arr.departure_time || "",
        arr.arrival_time || "",
        arr.flight_train_number || "",
        arr.notes || "",
      ]);
      autoTable(doc, {
        startY: yPosition,
        head: [["Transporte", "Recogida", "Salida", "Llegada", "Vuelo/Tren #", "Notas"]],
        body: travelTableData,
        theme: "grid",
        styles: { fontSize: 10 },
      });
      yPosition = (doc as any).lastAutoTable.finalY + 15;

      const transportationMapPlaceholders: { [key: string]: string } = {
        "Nave Sector-Pro. C\\Puerto Rico 6, 28971 - Griñon 1": "/lovable-uploads/IMG_7834.jpeg",
        "C\\ Corregidor Diego de Valderrabano 23, Moratalaz": "/lovable-uploads/IMG_7835.jpeg",
        "C\\ Entrepeñas 47, Ensanche de Vallecas": "/lovable-uploads/IMG_7836.jpeg",
      };

      for (const pickupAddress of Array.from(
        new Set(
          travelArrangements
            .filter((arr) => arr.pickup_address)
            .map((arr) => arr.pickup_address as string)
        )
      )) {
        const imageUrl = transportationMapPlaceholders[pickupAddress];
        if (imageUrl) {
          yPosition = checkPageBreak(yPosition);
          doc.setFontSize(10);
          doc.setTextColor(51, 51, 51);
          doc.text(`Dirección de Recogida: ${pickupAddress}`, 20, yPosition);
          yPosition += 7;
          const imageDataUrl = await loadImageAsDataURL(imageUrl);
          if (imageDataUrl) {
            try {
              doc.addImage(imageDataUrl, "JPEG", 20, yPosition, 100, 60);
              yPosition += 70;
            } catch (error) {
              console.error("Error al agregar la imagen del mapa de transporte:", error);
            }
          }
        }
      }
    }

    if (
      roomAssignments.length > 0 &&
      roomAssignments.some((room) =>
        Object.values(room).some((val) => val && val !== "")
      )
    ) {
      yPosition = checkPageBreak(yPosition);
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text("Asignaciones de Habitaciones", 20, yPosition);
      yPosition += 10;
      const roomTableData = roomAssignments.map((room) => [
        room.room_type,
        room.room_number || "",
        room.staff_member1_id || "",
        room.room_type === "double" ? room.staff_member2_id || "" : "",
      ]);
      autoTable(doc, {
        startY: yPosition,
        head: [["Tipo de Habitación", "Número", "Personal 1", "Personal 2"]],
        body: roomTableData,
        theme: "grid",
        styles: { fontSize: 10 },
      });
      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    if (eventData.schedule) {
      yPosition = checkPageBreak(yPosition);
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text("Programa", 20, yPosition);
      yPosition += 10;
      const scheduleLines = doc.splitTextToSize(eventData.schedule, pageWidth - 40);
      doc.text(scheduleLines, 20, yPosition);
      yPosition += scheduleLines.length * 7 + 15;
    }

    if (eventData.powerRequirements) {
      yPosition = checkPageBreak(yPosition);
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text("Requisitos Eléctricos", 20, yPosition);
      yPosition += 10;
      const powerLines = doc.splitTextToSize(eventData.powerRequirements, pageWidth - 40);
      doc.text(powerLines, 20, yPosition);
      yPosition += powerLines.length * 7 + 15;
    }

    if (eventData.auxiliaryNeeds) {
      yPosition = checkPageBreak(yPosition);
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text("Necesidades Auxiliares", 20, yPosition);
      yPosition += 10;
      const auxLines = doc.splitTextToSize(eventData.auxiliaryNeeds, pageWidth - 40);
      doc.text(auxLines, 20, yPosition);
      yPosition += auxLines.length * 7 + 15;
    }

    if (imagePreviews.venue.length > 0) {
      doc.addPage();
      yPosition = 20;
      doc.setFontSize(14);
      doc.setTextColor(125, 1, 1);
      doc.text("Imágenes del Lugar", 20, yPosition);
      yPosition += 20;
      const imageWidth = 80;
      const imagesPerRow = 2;
      let currentX = 20;
      for (let i = 0; i < imagePreviews.venue.length; i++) {
        try {
          doc.addImage(imagePreviews.venue[i], "JPEG", currentX, yPosition, imageWidth, 60);
          if ((i + 1) % imagesPerRow === 0) {
            yPosition += 70;
            currentX = 20;
          } else {
            currentX += imageWidth + 10;
          }
          if (yPosition > pageHeight - bottomMargin && i < imagePreviews.venue.length - 1) {
            doc.addPage();
            yPosition = 20;
            currentX = 20;
          }
        } catch (error) {
          console.error("Error al agregar la imagen:", error);
          continue;
        }
      }
    }

    doc.addPage();
    yPosition = 20;
    doc.setFontSize(14);
    doc.setTextColor(125, 1, 1);
    doc.text("Logo", 20, yPosition);
    yPosition += 20;
    const logo = new Image();
    logo.crossOrigin = "anonymous";
    logo.src = "/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png";
    logo.onload = () => {
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        const logoWidth = 50;
        const logoHeight = logoWidth * (logo.height / logo.width);
        const xPositionLogo = (pageWidth - logoWidth) / 2;
        const yPositionLogo = pageHeight - logoHeight - 10;
        doc.addImage(logo, "PNG", xPositionLogo, yPositionLogo, logoWidth, logoHeight);
      }
      const blob = doc.output("blob");
      const fileName = `hoja_de_ruta_${jobTitle.replace(/\s+/g, "_")}.pdf`;
      uploadPdfToJob(selectedJobId, blob, fileName);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    };
    logo.onerror = () => {
      console.error("No se pudo cargar el logo");
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `hoja_de_ruta_${eventData.eventName.replace(/\s+/g, "_")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    };
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

  const loadHojaDeRuta = async (jobId: string) => {
    try {
      console.log("Loading Hoja de Ruta for job:", jobId);
      const { data: mainData, error } = await supabase
        .from("hoja_de_ruta")
        .select("*")
        .eq("job_id", jobId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching Hoja de Ruta:", error);
        throw error;
      }

      if (mainData) {
        // Update eventData with the loaded data
        setEventData((prev) => ({
          ...prev,
          eventName: mainData.event_name || prev.eventName,
          eventDates: mainData.event_dates || prev.eventDates,
          venue: {
            name: mainData.venue_name || "",
            address: mainData.venue_address || "",
          },
          schedule: mainData.schedule || "",
          powerRequirements: mainData.power_requirements || "",
          auxiliaryNeeds: mainData.auxiliary_needs || "",
        }));

        // Load contacts
        const { data: contactsData, error: contactsError } = await supabase
          .from("hoja_de_ruta_contacts")
          .select("*")
          .eq("hoja_de_ruta_id", mainData.id);

        if (contactsError) throw contactsError;
        if (contactsData) {
          setEventData((prev) => ({
            ...prev,
            contacts: contactsData.map((contact) => ({
              name: contact.name,
              role: contact.role || "",
              phone: contact.phone || "",
            })),
          }));
        }

        // Load logistics
        const { data: logisticsData, error: logisticsError } = await supabase
          .from("hoja_de_ruta_logistics")
          .select("*")
          .eq("hoja_de_ruta_id", mainData.id)
          .maybeSingle();

        if (logisticsError) throw logisticsError;
        if (logisticsData) {
          setEventData((prev) => ({
            ...prev,
            logistics: {
              transport: logisticsData.transport || "",
              loadingDetails: logisticsData.loading_details || "",
              unloadingDetails: logisticsData.unloading_details || "",
            },
          }));
        }

        // Load staff
        const { data: staffData, error: staffError } = await supabase
          .from("hoja_de_ruta_staff")
          .select("*")
          .eq("hoja_de_ruta_id", mainData.id);

        if (staffError) throw staffError;
        if (staffData) {
          setEventData((prev) => ({
            ...prev,
            staff: staffData.map((staff) => ({
              name: staff.name,
              surname1: staff.surname1 || "",
              surname2: staff.surname2 || "",
              position: staff.position || "",
            })),
          }));
        }

        // Load travel arrangements
        const { data: travelData, error: travelError } = await supabase
          .from("hoja_de_ruta_travel")
          .select("*")
          .eq("hoja_de_ruta_id", mainData.id);

        if (travelError) throw travelError;
        if (travelData) {
          setTravelArrangements(
            travelData.map((travel) => ({
              transportation_type: travel.transportation_type,
              pickup_address: travel.pickup_address || "",
              pickup_time: travel.pickup_time || "",
              departure_time: travel.departure_time || "",
              arrival_time: travel.arrival_time || "",
              flight_train_number: travel.flight_train_number || "",
              notes: travel.notes || "",
            }))
          );
        }

        // Load room assignments
        const { data: roomData, error: roomError } = await supabase
          .from("hoja_de_ruta_rooms")
          .select("*")
          .eq("hoja_de_ruta_id", mainData.id);

        if (roomError) throw roomError;
        if (roomData) {
          setRoomAssignments(
            roomData.map((room) => ({
              room_type: room.room_type,
              room_number: room.room_number || "",
              staff_member1_id: room.staff_member1_id || "",
              staff_member2_id: room.staff_member2_id || "",
            }))
          );
        }

        // Load images
        const { data: imageData, error: imageError } = await supabase
          .from("hoja_de_ruta_images")
          .select("*")
          .eq("hoja_de_ruta_id", mainData.id);

        if (imageError) throw imageError;
        if (imageData) {
          // Handle image data as needed - this might require additional work
          // depending on how you want to handle images
        }

        toast({
          title: "Éxito",
          description: "Hoja de Ruta cargada correctamente",
        });
      }
    } catch (error: any) {
      console.error("Error loading Hoja de Ruta:", error);
      toast({
        title: "Error",
        description: "Error al cargar la Hoja de Ruta",
        variant: "destructive",
      });
    }
  };

  const handleStateChange = () => {
    setHasChanges(true);
  };

  useEffect(() => {
    handleStateChange();
  }, [eventData, travelArrangements, roomAssignments]);

  return (
    <div>
      <div className="space-y-4">
        <ImageUploadSection 
          type="venue" 
          label="Imagen del Lugar"
          images={images}
          imagePreviews={imagePreviews}
          setImages={setImages}
          setImagePreviews={setImagePreviews}
        />
        <div className="space-y-4">
          <Label>Nombre del Evento</Label>
          <Input
            value={eventData.eventName}
            onChange={(e) =>
              setEventData((prev) => ({
                ...prev,
                eventName: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-4">
          <Label>Fecha del Evento</Label>
          <Input
            value={eventData.eventDates}
            onChange={(e) =>
              setEventData((prev) => ({
                ...prev,
                eventDates: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-4">
          <Label>Lugar</Label>
          <div className="space-y-4">
            <Label>Nombre</Label>
            <Input
              value={eventData.venue.name}
              onChange={(e) =>
                setEventData((prev) => ({
                  ...prev,
                  venue: {
                    ...prev.venue,
                    name: e.target.value,
                  },
                }))
              }
            />
            <Label>Dirección</Label>
            <Input
              value={eventData.venue.address}
              onChange={(e) =>
                setEventData((prev) => ({
                  ...prev,
                  venue: {
                    ...prev.venue,
                    address: e.target.value,
                  },
                }))
              }
            />
          </div>
        </div>
        <div className="space-y-4">
          <Label>Contactos</Label>
          <div className="space-y-4">
            {eventData.contacts.map((contact, index) => (
              <div key={index} className="space-y-4">
                <Label>Nombre</Label>
                <Input
                  value={contact.name}
                  onChange={(e) =>
                    handleContactChange(index, "name", e.target.value)
                  }
                />
                <Label>Rol</Label>
                <Input
                  value={contact.role}
                  onChange={(e) =>
                    handleContactChange(index, "role", e.target.value)
                  }
                />
                <Label>Teléfono</Label>
                <Input
                  value={contact.phone}
                  onChange={(e) =>
                    handleContactChange(index, "phone", e.target.value)
                  }
                />
              </div>
            ))}
            <Button onClick={addContact}>Agregar Contacto</Button>
          </div>
        </div>
        <div className="space-y-4">
          <Label>Logística</Label>
          <div className="space-y-4">
            <Label>Transporte</Label>
            <Input
              value={eventData.logistics.transport}
              onChange={(e) =>
                setEventData((prev) => ({
                  ...prev,
                  logistics: {
                    ...prev.logistics,
                    transport: e.target.value,
                  },
                }))
              }
            />
            <Label>Detalles de Carga</Label>
            <Input
              value={eventData.logistics.loadingDetails}
              onChange={(e) =>
                setEventData((prev) => ({
                  ...prev,
                  logistics: {
                    ...prev.logistics,
                    loadingDetails: e.target.value,
                  },
                }))
              }
            />
            <Label>Detalles de Descarga</Label>
            <Input
              value={eventData.logistics.unloadingDetails}
              onChange={(e) =>
                setEventData((prev) => ({
                  ...prev,
                  logistics: {
                    ...prev.logistics,
                    unloadingDetails: e.target.value,
                  },
                }))
              }
            />
          </div>
        </div>
        <div className="space-y-4">
          <Label>Personal</Label>
          <div className="space-y-4">
            {eventData.staff.map((person, index) => (
              <div key={index} className="space-y-4">
                <Label>Nombre</Label>
                <Input
                  value={person.name}
                  onChange={(e) =>
                    handleStaffChange(index, "name", e.target.value)
                  }
                />
                <Label>Primer Apellido</Label>
                <Input
                  value={person.surname1}
                  onChange={(e) =>
                    handleStaffChange(index, "surname1", e.target.value)
                  }
                />
                <Label>Segundo Apellido</Label>
                <Input
                  value={person.surname2}
                  onChange={(e) =>
                    handleStaffChange(index, "surname2", e.target.value)
                  }
                />
                <Label>Puesto</Label>
                <Input
                  value={person.position}
                  onChange={(e) =>
                    handleStaffChange(index, "position", e.target.value)
                  }
                />
              </div>
            ))}
            <Button onClick={addStaffMember}>Agregar Personal</Button>
          </div>
        </div>
        <div className="space-y-4">
          <Label>Programa</Label>
          <Textarea
            value={eventData.schedule}
            onChange={(e) =>
              setEventData((prev) => ({
                ...prev,
                schedule: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-4">
          <Label>Requisitos Eléctricos</Label>
          <Textarea
            value={eventData.powerRequirements}
            onChange={(e) =>
              setEventData((prev) => ({
                ...prev,
                powerRequirements: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-4">
          <Label>Necesidades Auxiliares</Label>
          <Textarea
            value={eventData.auxiliaryNeeds}
            onChange={(e) =>
              setEventData((prev) => ({
                ...prev,
                auxiliaryNeeds: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-4">
          <Label>Imágenes del Lugar</Label>
          <div className="grid grid-cols-3 gap-4">
            {imagePreviews.venue?.map((preview, index) => (
              <div key={index} className="relative">
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-32 object-cover rounded-md"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => removeImage("venue", index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Label>Mapa del Lugar</Label>
          <input
            type="file"
            accept="image/*"
            onChange={handleVenueMapUpload}
          />
          {venueMapPreview && (
            <img
              src={venueMapPreview}
              alt="Mapa del Lugar"
              className="w-full h-32 object-cover rounded-md"
            />
          )}
        </div>
        <div className="space-y-4">
          <Label>Arreglos de Viaje</Label>
          <div className="space-y-4">
            {travelArrangements.map((arrangement, index) => (
              <div key={index} className="space-y-4">
                <Label>Transporte</Label>
                <Input
                  value={arrangement.transportation_type}
                  onChange={(e) =>
                    updateTravelArrangement(index, "transportation_type", e.target.value)
                  }
                />
                <Label>Recogida</Label>
                <Input
                  value={`${arrangement.pickup_address || ""} ${arrangement.pickup_time || ""}`.trim()}
                  onChange={(e) =>
                    updateTravelArrangement(index, "pickup_address", e.target.value)
                  }
                />
                <Label>Salida</Label>
                <Input
                  value={arrangement.departure_time || ""}
                  onChange={(e) =>
                    updateTravelArrangement(index, "departure_time", e.target.value)
                  }
                />
                <Label>Llegada</Label>
                <Input
                  value={arrangement.arrival_time || ""}
                  onChange={(e) =>
                    updateTravelArrangement(index, "arrival_time", e.target.value)
                  }
                />
                <Label>Vuelo/Tren #</Label>
                <Input
                  value={arrangement.flight_train_number || ""}
                  onChange={(e) =>
                    updateTravelArrangement(index, "flight_train_number", e.target.value)
                  }
                />
                <Label>Notas</Label>
                <Input
                  value={arrangement.notes || ""}
                  onChange={(e) =>
                    updateTravelArrangement(index, "notes", e.target.value)
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTravelArrangement(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button onClick={addTravelArrangement}>Agregar Arreglo de Viaje</Button>
          </div>
        </div>
        <div className="space-y-4">
          <Label>Asignaciones de Habitaciones</Label>
          <div className="space-y-4">
            {roomAssignments.map((assignment, index) => (
              <div key={index} className="space-y-4">
                <Label>Tipo de Habitación</Label>
                <Input
                  value={assignment.room_type}
                  onChange={(e) =>
                    updateRoomAssignment(index, "room_type", e.target.value)
                  }
                />
                <Label>Número</Label>
                <Input
                  value={assignment.room_number || ""}
                  onChange={(e) =>
                    updateRoomAssignment(index, "room_number", e.target.value)
                  }
                />
                <Label>Personal 1</Label>
                <Input
                  value={assignment.staff_member1_id || ""}
                  onChange={(e) =>
                    updateRoomAssignment(index, "staff_member1_id", e.target.value)
                  }
                />
                <Label>Personal 2</Label>
                <Input
                  value={assignment.staff_member2_id || ""}
                  onChange={(e) =>
                    updateRoomAssignment(index, "staff_member2_id", e.target.value)
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRoomAssignment(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button onClick={addRoomAssignment}>Agregar Asignación de Habitación</Button>
          </div>
        </div>
        <div className="space-y-4">
          <Button
            onClick={generateDocument}
            disabled={!hasChanges}
            className="w-full"
          >
            Generar Hoja de Ruta
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HojaDeRutaGenerator;
