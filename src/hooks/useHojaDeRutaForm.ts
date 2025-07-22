
import { useState, useEffect } from "react";
import { EventData, TravelArrangement, RoomAssignment } from "@/types/hoja-de-ruta";
import { useJobSelection } from "@/hooks/useJobSelection";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useHojaDeRutaPersistence } from "./useHojaDeRutaPersistence";

const initialEventData: EventData = {
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
    equipmentLogistics: "",
  },
  staff: [{ name: "", surname1: "", surname2: "", position: "" }],
  schedule: "",
  powerRequirements: "",
  auxiliaryNeeds: "",
};

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

  const [eventData, setEventData] = useState<EventData>(initialEventData);

  // Get hoja de ruta data using the persistence hook
  const { hojaDeRuta, isLoading: isLoadingHojaDeRuta } = useHojaDeRutaPersistence(selectedJobId);

  // Initialize form with existing data when hojaDeRuta changes
  useEffect(() => {
    console.log("🔄 FORM: Data initialization effect triggered");
    console.log("🔄 FORM: selectedJobId:", selectedJobId);
    console.log("🔄 FORM: hojaDeRuta:", hojaDeRuta ? "Found data" : "No data");
    
    if (selectedJobId && hojaDeRuta) {
      console.log("✅ FORM: Initializing form with existing data");
      
      setEventData({
        eventName: hojaDeRuta.event_name || "",
        eventDates: hojaDeRuta.event_dates || "",
        venue: {
          name: hojaDeRuta.venue_name || "",
          address: hojaDeRuta.venue_address || "",
        },
        contacts: hojaDeRuta.contacts?.length > 0 
          ? hojaDeRuta.contacts.map((contact: any) => ({
              name: contact.name || "",
              role: contact.role || "",
              phone: contact.phone || "",
            }))
          : [{ name: "", role: "", phone: "" }],
        logistics: {
          transport: hojaDeRuta.logistics?.transport || "",
          loadingDetails: hojaDeRuta.logistics?.loading_details || "",
          unloadingDetails: hojaDeRuta.logistics?.unloading_details || "",
          equipmentLogistics: hojaDeRuta.logistics?.equipment_logistics || "",
        },
        staff: hojaDeRuta.staff?.length > 0
          ? hojaDeRuta.staff.map((member: any) => ({
              name: member.name || "",
              surname1: member.surname1 || "",
              surname2: member.surname2 || "",
              position: member.position || "",
            }))
          : [{ name: "", surname1: "", surname2: "", position: "" }],
        schedule: hojaDeRuta.schedule || "",
        powerRequirements: hojaDeRuta.power_requirements || "",
        auxiliaryNeeds: hojaDeRuta.auxiliary_needs || "",
      });

      // Set travel arrangements
      if (hojaDeRuta.travel && hojaDeRuta.travel.length > 0) {
        console.log("🚗 FORM: Setting travel arrangements:", hojaDeRuta.travel.length);
        setTravelArrangements(hojaDeRuta.travel.map((arr: any) => ({
          transportation_type: arr.transportation_type,
          pickup_address: arr.pickup_address,
          pickup_time: arr.pickup_time,
          departure_time: arr.departure_time,
          arrival_time: arr.arrival_time,
          flight_train_number: arr.flight_train_number,
          notes: arr.notes,
        })));
      } else {
        setTravelArrangements([{ transportation_type: "van" }]);
      }

      // Set room assignments
      if (hojaDeRuta.rooms && hojaDeRuta.rooms.length > 0) {
        console.log("🏨 FORM: Setting room assignments:", hojaDeRuta.rooms.length);
        setRoomAssignments(hojaDeRuta.rooms.map((room: any) => ({
          room_type: room.room_type,
          room_number: room.room_number,
          staff_member1_id: room.staff_member1_id,
          staff_member2_id: room.staff_member2_id,
        })));
      } else {
        setRoomAssignments([{ room_type: "single" }]);
      }
    } else if (selectedJobId && !hojaDeRuta && !isLoadingHojaDeRuta) {
      // Reset form to initial state when no data is available for this job
      console.log("🆕 FORM: No existing data found, resetting to initial state");
      setEventData(initialEventData);
      setTravelArrangements([{ transportation_type: "van" }]);
      setRoomAssignments([{ room_type: "single" }]);
    }
  }, [hojaDeRuta, selectedJobId, isLoadingHojaDeRuta]);

  // Reset form when job selection changes
  useEffect(() => {
    console.log("🔄 FORM: Job selection changed to:", selectedJobId);
    if (selectedJobId) {
      setPowerRequirements("");
      fetchPowerRequirements(selectedJobId);
      fetchAssignedStaff(selectedJobId);
    } else {
      // Clear all data when no job is selected
      setEventData(initialEventData);
      setTravelArrangements([{ transportation_type: "van" }]);
      setRoomAssignments([{ room_type: "single" }]);
      setPowerRequirements("");
    }
  }, [selectedJobId]);

  const fetchPowerRequirements = async (jobId: string) => {
    try {
      console.log("⚡ FORM: Fetching power requirements for job:", jobId);
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
        
        console.log("⚡ FORM: Power requirements fetched successfully");
        setPowerRequirements(formattedRequirements);
        setEventData((prev) => ({
          ...prev,
          powerRequirements: formattedRequirements,
        }));
      }
    } catch (error: any) {
      console.error("❌ FORM: Error fetching power requirements:", error);
      toast({
        title: "Error",
        description: "No se pudieron obtener los requisitos eléctricos",
        variant: "destructive",
      });
    }
  };

  const fetchAssignedStaff = async (jobId: string) => {
    try {
      console.log("👥 FORM: Fetching assigned staff for job:", jobId);
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

        console.log("👥 FORM: Staff fetched successfully:", staffList.length);
        setEventData((prev) => ({
          ...prev,
          staff: staffList,
        }));
      }
    } catch (error) {
      console.error("❌ FORM: Error fetching assigned staff:", error);
      toast({
        title: "Error",
        description: "No se pudo obtener el personal asignado",
        variant: "destructive",
      });
    }
  };

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
    isLoadingHojaDeRuta,
  };
};
