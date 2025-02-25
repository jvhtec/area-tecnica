
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { EventData, TravelArrangement, RoomAssignment } from "@/types/hoja-de-ruta";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useHojaDeRutaPersistence = (jobId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing hoja de ruta data
  const { data: hojaDeRuta, isLoading } = useQuery({
    queryKey: ['hoja-de-ruta', jobId],
    queryFn: async () => {
      if (!jobId) return null;

      console.log("Fetching hoja de ruta data for job:", jobId);

      // Get the most recent hoja de ruta entry for this job
      const { data: mainData, error: mainError } = await supabase
        .from('hoja_de_ruta')
        .select('*')
        .eq('job_id', jobId)
        .order('last_modified', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (mainError) {
        console.error('Error fetching hoja de ruta:', mainError);
        return null;
      }

      // If no data exists, return null
      if (!mainData) return null;

      console.log("Found main hoja de ruta data:", mainData);

      // Fetch all related data
      const [
        { data: contacts },
        { data: staff },
        { data: logistics },
        { data: travel },
        { data: rooms },
        { data: images }
      ] = await Promise.all([
        supabase.from('hoja_de_ruta_contacts').select('*').eq('hoja_de_ruta_id', mainData.id),
        supabase.from('hoja_de_ruta_staff').select('*').eq('hoja_de_ruta_id', mainData.id),
        supabase.from('hoja_de_ruta_logistics').select('*').eq('hoja_de_ruta_id', mainData.id),
        supabase.from('hoja_de_ruta_travel').select('*').eq('hoja_de_ruta_id', mainData.id),
        supabase.from('hoja_de_ruta_rooms').select('*').eq('hoja_de_ruta_id', mainData.id),
        supabase.from('hoja_de_ruta_images').select('*').eq('hoja_de_ruta_id', mainData.id)
      ]);

      console.log("Fetched related data:", {
        contacts,
        staff,
        logistics,
        travel,
        rooms,
        images
      });

      return {
        ...mainData,
        contacts: contacts || [],
        staff: staff || [],
        logistics: logistics?.[0] || null,
        travel: travel || [],
        rooms: rooms || [],
        images: images || []
      };
    },
    enabled: !!jobId
  });

  // Create or update hoja de ruta
  const { mutateAsync: saveHojaDeRuta, isPending: isSaving } = useMutation({
    mutationFn: async (data: EventData) => {
      console.log("Starting save operation with data:", data);
      
      if (!jobId) throw new Error('No job ID provided');

      try {
        // First, upsert the main hoja_de_ruta record
        const { data: mainRecord, error: mainError } = await supabase
          .from('hoja_de_ruta')
          .upsert({
            job_id: jobId,
            event_name: data.eventName,
            event_dates: data.eventDates,
            venue_name: data.venue.name,
            venue_address: data.venue.address,
            schedule: data.schedule,
            power_requirements: data.powerRequirements,
            auxiliary_needs: data.auxiliaryNeeds
          })
          .select()
          .single();

        if (mainError) throw mainError;

        console.log("Saved main record:", mainRecord);

        // Update logistics with all fields including equipment_logistics
        const { error: logisticsError } = await supabase
          .from('hoja_de_ruta_logistics')
          .upsert({
            hoja_de_ruta_id: mainRecord.id,
            transport: data.logistics.transport,
            loading_details: data.logistics.loadingDetails,
            unloading_details: data.logistics.unloadingDetails,
            equipment_logistics: data.logistics.equipmentLogistics
          });

        if (logisticsError) throw logisticsError;

        // Update contacts
        if (data.contacts.length > 0) {
          await supabase
            .from('hoja_de_ruta_contacts')
            .delete()
            .eq('hoja_de_ruta_id', mainRecord.id);

          const { error: contactsError } = await supabase
            .from('hoja_de_ruta_contacts')
            .insert(data.contacts.map(contact => ({
              hoja_de_ruta_id: mainRecord.id,
              name: contact.name,
              role: contact.role,
              phone: contact.phone
            })));

          if (contactsError) throw contactsError;
        }

        // Update staff members
        if (data.staff.length > 0) {
          await supabase
            .from('hoja_de_ruta_staff')
            .delete()
            .eq('hoja_de_ruta_id', mainRecord.id);

          const { error: staffError } = await supabase
            .from('hoja_de_ruta_staff')
            .insert(data.staff.map(member => ({
              hoja_de_ruta_id: mainRecord.id,
              name: member.name,
              surname1: member.surname1,
              surname2: member.surname2,
              position: member.position
            })));

          if (staffError) throw staffError;
        }

        console.log("Successfully saved all data");
        return mainRecord;
      } catch (error) {
        console.error("Error in saveHojaDeRuta:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta', jobId] });
      toast({
        title: "Guardado con éxito",
        description: "Los cambios se han guardado correctamente.",
      });
    },
    onError: (error) => {
      console.error('Error saving hoja de ruta:', error);
      toast({
        title: "Error al guardar",
        description: "No se pudieron guardar los cambios. Por favor, intente nuevamente.",
        variant: "destructive",
      });
    }
  });

  // Save travel arrangements
  const { mutateAsync: saveTravelArrangements } = useMutation({
    mutationFn: async ({ hojaDeRutaId, arrangements }: { hojaDeRutaId: string, arrangements: TravelArrangement[] }) => {
      await supabase
        .from('hoja_de_ruta_travel')
        .delete()
        .eq('hoja_de_ruta_id', hojaDeRutaId);

      if (arrangements.length > 0) {
        return supabase
          .from('hoja_de_ruta_travel')
          .insert(arrangements.map(arr => ({
            hoja_de_ruta_id: hojaDeRutaId,
            transportation_type: arr.transportation_type,
            pickup_address: arr.pickup_address,
            pickup_time: arr.pickup_time,
            departure_time: arr.departure_time,
            arrival_time: arr.arrival_time,
            flight_train_number: arr.flight_train_number,
            notes: arr.notes
          })));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta', jobId] });
      toast({
        title: "Arreglos de viaje guardados",
        description: "Los arreglos de viaje se han actualizado correctamente.",
      });
    }
  });

  // Save room assignments
  const { mutateAsync: saveRoomAssignments } = useMutation({
    mutationFn: async ({ hojaDeRutaId, assignments }: { hojaDeRutaId: string, assignments: RoomAssignment[] }) => {
      await supabase
        .from('hoja_de_ruta_rooms')
        .delete()
        .eq('hoja_de_ruta_id', hojaDeRutaId);

      if (assignments.length > 0) {
        return supabase
          .from('hoja_de_ruta_rooms')
          .insert(assignments.map(room => ({
            hoja_de_ruta_id: hojaDeRutaId,
            room_type: room.room_type,
            room_number: room.room_number,
            staff_member1_id: room.staff_member1_id,
            staff_member2_id: room.staff_member2_id
          })));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta', jobId] });
      toast({
        title: "Asignaciones de habitaciones guardadas",
        description: "Las asignaciones de habitaciones se han actualizado correctamente.",
      });
    }
  });

  // Save venue images
  const { mutateAsync: saveVenueImages } = useMutation({
    mutationFn: async ({ hojaDeRutaId, images }: { hojaDeRutaId: string, images: { image_path: string, image_type: string }[] }) => {
      await supabase
        .from('hoja_de_ruta_images')
        .delete()
        .eq('hoja_de_ruta_id', hojaDeRutaId);

      if (images.length > 0) {
        return supabase
          .from('hoja_de_ruta_images')
          .insert(images.map(img => ({
            hoja_de_ruta_id: hojaDeRutaId,
            image_path: img.image_path,
            image_type: img.image_type
          })));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta', jobId] });
      toast({
        title: "Imágenes guardadas",
        description: "Las imágenes se han actualizado correctamente.",
      });
    }
  });

  return {
    hojaDeRuta,
    isLoading,
    saveHojaDeRuta,
    isSaving,
    saveTravelArrangements,
    saveRoomAssignments,
    saveVenueImages
  };
};
