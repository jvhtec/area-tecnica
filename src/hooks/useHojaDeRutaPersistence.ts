
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
      console.log("🔍 PERSISTENCE: Fetching hoja de ruta data for job:", jobId);
      if (!jobId) {
        console.log("❌ PERSISTENCE: No jobId provided, returning null");
        return null;
      }

      try {
        // Get the hoja de ruta record for this job (now unique due to constraint)
        const { data: mainData, error: mainError } = await supabase
          .from('hoja_de_ruta')
          .select('*')
          .eq('job_id', jobId)
          .maybeSingle();

        if (mainError) {
          console.error('Error fetching hoja de ruta:', mainError);
          throw mainError;
        }

        // If no data exists, return null
        if (!mainData) {
          console.log("📝 PERSISTENCE: No existing hoja de ruta found for job:", jobId);
          return null;
        }

        console.log("✅ PERSISTENCE: Found hoja de ruta data:", mainData);

        // Fetch all related data in parallel
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

        console.log("📊 PERSISTENCE: Fetched related data:", {
          contacts: contacts?.length || 0,
          staff: staff?.length || 0,
          logistics: logistics?.length || 0,
          travel: travel?.length || 0,
          rooms: rooms?.length || 0,
          images: images?.length || 0
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
      } catch (error) {
        console.error("❌ PERSISTENCE: Error in fetch:", error);
        throw error;
      }
    },
    enabled: !!jobId
  });

  // Create or update hoja de ruta with proper upsert
  const { mutateAsync: saveHojaDeRuta, isPending: isSaving } = useMutation({
    mutationFn: async (data: EventData) => {
      console.log("💾 PERSISTENCE: Starting save operation");
      console.log("💾 PERSISTENCE: Job ID:", jobId);
      console.log("💾 PERSISTENCE: Data to save:", data);
      
      if (!jobId) throw new Error('No job ID provided');

      try {
        // Use upsert to handle both insert and update cases
        const { data: upsertedRecord, error: upsertError } = await supabase
          .from('hoja_de_ruta')
          .upsert({
            job_id: jobId,
            event_name: data.eventName,
            event_dates: data.eventDates,
            venue_name: data.venue.name,
            venue_address: data.venue.address,
            schedule: data.schedule,
            power_requirements: data.powerRequirements,
            auxiliary_needs: data.auxiliaryNeeds,
            last_modified: new Date().toISOString(),
            created_by: (await supabase.auth.getUser()).data.user?.id
          }, {
            onConflict: 'job_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (upsertError) {
          console.error("❌ PERSISTENCE: Upsert error:", upsertError);
          throw upsertError;
        }

        console.log("✅ PERSISTENCE: Upserted main record:", upsertedRecord);

        // Update logistics with all fields including equipment_logistics
        const { error: logisticsError } = await supabase
          .from('hoja_de_ruta_logistics')
          .upsert({
            hoja_de_ruta_id: upsertedRecord.id,
            transport: data.logistics.transport,
            loading_details: data.logistics.loadingDetails,
            unloading_details: data.logistics.unloadingDetails,
            equipment_logistics: data.logistics.equipmentLogistics
          }, {
            onConflict: 'hoja_de_ruta_id',
            ignoreDuplicates: false
          });

        if (logisticsError) {
          console.error("❌ PERSISTENCE: Logistics error:", logisticsError);
          throw logisticsError;
        }

        // Update contacts - delete existing and insert new ones
        if (data.contacts.length > 0) {
          await supabase
            .from('hoja_de_ruta_contacts')
            .delete()
            .eq('hoja_de_ruta_id', upsertedRecord.id);

          const { error: contactsError } = await supabase
            .from('hoja_de_ruta_contacts')
            .insert(data.contacts.map(contact => ({
              hoja_de_ruta_id: upsertedRecord.id,
              name: contact.name,
              role: contact.role,
              phone: contact.phone
            })));

          if (contactsError) {
            console.error("❌ PERSISTENCE: Contacts error:", contactsError);
            throw contactsError;
          }
        }

        // Update staff members - delete existing and insert new ones
        if (data.staff.length > 0) {
          await supabase
            .from('hoja_de_ruta_staff')
            .delete()
            .eq('hoja_de_ruta_id', upsertedRecord.id);

          const { error: staffError } = await supabase
            .from('hoja_de_ruta_staff')
            .insert(data.staff.map(member => ({
              hoja_de_ruta_id: upsertedRecord.id,
              name: member.name,
              surname1: member.surname1,
              surname2: member.surname2,
              position: member.position
            })));

          if (staffError) {
            console.error("❌ PERSISTENCE: Staff error:", staffError);
            throw staffError;
          }
        }

        console.log("✅ PERSISTENCE: Successfully saved all data");
        return upsertedRecord;
      } catch (error) {
        console.error("❌ PERSISTENCE: Error in saveHojaDeRuta:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta', jobId] });
      toast({
        title: "✅ Guardado con éxito",
        description: "Los cambios se han guardado correctamente.",
      });
    },
    onError: (error) => {
      console.error('❌ PERSISTENCE: Error saving hoja de ruta:', error);
      toast({
        title: "❌ Error al guardar",
        description: `No se pudieron guardar los cambios: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Save travel arrangements with proper error handling
  const { mutateAsync: saveTravelArrangements } = useMutation({
    mutationFn: async ({ hojaDeRutaId, arrangements }: { hojaDeRutaId: string, arrangements: TravelArrangement[] }) => {
      console.log("🚗 PERSISTENCE: Saving travel arrangements:", arrangements.length);
      
      await supabase
        .from('hoja_de_ruta_travel')
        .delete()
        .eq('hoja_de_ruta_id', hojaDeRutaId);

      if (arrangements.length > 0) {
        const { error } = await supabase
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
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta', jobId] });
      toast({
        title: "🚗 Arreglos de viaje guardados",
        description: "Los arreglos de viaje se han actualizado correctamente.",
      });
    },
    onError: (error) => {
      console.error('❌ PERSISTENCE: Error saving travel arrangements:', error);
      toast({
        title: "❌ Error al guardar viajes",
        description: `No se pudieron guardar los arreglos de viaje: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Save room assignments with proper error handling
  const { mutateAsync: saveRoomAssignments } = useMutation({
    mutationFn: async ({ hojaDeRutaId, assignments }: { hojaDeRutaId: string, assignments: RoomAssignment[] }) => {
      console.log("🏨 PERSISTENCE: Saving room assignments:", assignments.length);
      
      await supabase
        .from('hoja_de_ruta_rooms')
        .delete()
        .eq('hoja_de_ruta_id', hojaDeRutaId);

      if (assignments.length > 0) {
        const { error } = await supabase
          .from('hoja_de_ruta_rooms')
          .insert(assignments.map(room => ({
            hoja_de_ruta_id: hojaDeRutaId,
            room_type: room.room_type,
            room_number: room.room_number,
            staff_member1_id: room.staff_member1_id,
            staff_member2_id: room.staff_member2_id
          })));
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta', jobId] });
      toast({
        title: "🏨 Asignaciones de habitaciones guardadas",
        description: "Las asignaciones de habitaciones se han actualizado correctamente.",
      });
    },
    onError: (error) => {
      console.error('❌ PERSISTENCE: Error saving room assignments:', error);
      toast({
        title: "❌ Error al guardar habitaciones",
        description: `No se pudieron guardar las asignaciones de habitaciones: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Save venue images with proper error handling
  const { mutateAsync: saveVenueImages } = useMutation({
    mutationFn: async ({ hojaDeRutaId, images }: { hojaDeRutaId: string, images: { image_path: string, image_type: string }[] }) => {
      console.log("📸 PERSISTENCE: Saving venue images:", images.length);
      
      await supabase
        .from('hoja_de_ruta_images')
        .delete()
        .eq('hoja_de_ruta_id', hojaDeRutaId);

      if (images.length > 0) {
        const { error } = await supabase
          .from('hoja_de_ruta_images')
          .insert(images.map(img => ({
            hoja_de_ruta_id: hojaDeRutaId,
            image_path: img.image_path,
            image_type: img.image_type
          })));
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta', jobId] });
      toast({
        title: "📸 Imágenes guardadas",
        description: "Las imágenes se han actualizado correctamente.",
      });
    },
    onError: (error) => {
      console.error('❌ PERSISTENCE: Error saving venue images:', error);
      toast({
        title: "❌ Error al guardar imágenes",
        description: `No se pudieron guardar las imágenes: ${error.message}`,
        variant: "destructive",
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
