
import { useState, useEffect } from "react";
import { EventData, TravelArrangement, RoomAssignment } from "@/types/hoja-de-ruta";
import { useJobSelection } from "@/hooks/useJobSelection";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export const useHojaDeRutaForm = () => {
  const { toast } = useToast();
  const { data: jobs, isLoading: isLoadingJobs } = useJobSelection();
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [powerRequirements, setPowerRequirements] = useState<string>("");
  const [travelArrangements, setTravelArrangements] = useState<TravelArrangement[]>([
    { transportation_type: "van" },
  ]);
  const [roomAssignments, setRoomAssignments] = useState<RoomAssignment[]>([
    { room_type: "single" },
  ]);

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
      equipmentLogistics: "", // Add the new field
    },
    staff: [{ name: "", surname1: "", surname2: "", position: "" }],
    schedule: "",
    powerRequirements: "",
    auxiliaryNeeds: "",
  });

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

  return {
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
  };
};
