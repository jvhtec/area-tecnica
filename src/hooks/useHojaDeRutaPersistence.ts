
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { EventData, TravelArrangement, RoomAssignment } from "@/types/hoja-de-ruta";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useHojaDeRutaPersistence = (jobId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing hoja de ruta data
  const { data: hojaDeRuta, isLoading, error: fetchError, refetch } = useQuery({
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
          { data: contacts, error: contactsError },
          { data: staff, error: staffError },
          { data: logistics, error: logisticsError },
          { data: travel, error: travelError },
          { data: rooms, error: roomsError },
          { data: images, error: imagesError }
        ] = await Promise.all([
          supabase.from('hoja_de_ruta_contacts').select('*').eq('hoja_de_ruta_id', mainData.id),
          supabase.from('hoja_de_ruta_staff').select('*').eq('hoja_de_ruta_id', mainData.id),
          supabase.from('hoja_de_ruta_logistics').select('*').eq('hoja_de_ruta_id', mainData.id),
          supabase.from('hoja_de_ruta_travel').select('*').eq('hoja_de_ruta_id', mainData.id),
          supabase.from('hoja_de_ruta_rooms').select('*').eq('hoja_de_ruta_id', mainData.id),
          supabase.from('hoja_de_ruta_images').select('*').eq('hoja_de_ruta_id', mainData.id)
        ]);

        // Check for errors in any of the requests
        if (contactsError || staffError || logisticsError || travelError || roomsError || imagesError) {
          console.error("❌ PERSISTENCE: Error fetching related data:", { 
            contactsError, staffError, logisticsError, travelError, roomsError, imagesError 
          });
          throw new Error("Failed to fetch complete hoja de ruta data");
        }

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
    enabled: !!jobId,
    staleTime: 30000, // Consider data fresh for 30 seconds
    retry: 2, // Retry failed requests twice
  });

  // Improved validation before save
  const validateData = (data: EventData): boolean => {
    // Basic validation to ensure required fields are present
    if (!data.eventName?.trim()) {
      toast({
        title: "❌ Datos incompletos",
        description: "El nombre del evento es obligatorio",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // Helper function to update cache optimistically
  const updateCacheOptimistically = useCallback((updatedData: any) => {
    queryClient.setQueryData(['hoja-de-ruta', jobId], updatedData);
  }, [queryClient, jobId]);

  // Create or update hoja de ruta with improved state management
  const { mutateAsync: saveHojaDeRuta, isPending: isSaving, reset: resetSaveMutation } = useMutation({
    mutationFn: async (data: EventData) => {
      console.log("💾 PERSISTENCE: Starting save operation");
      console.log("💾 PERSISTENCE: Job ID:", jobId);
      
      if (!jobId) throw new Error('No job ID provided');
      if (!validateData(data)) throw new Error('Data validation failed');

      try {
        // Start with a clean timestamp for last_modified
        const timestamp = new Date().toISOString();
        const userId = (await supabase.auth.getUser()).data.user?.id;
        
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
            last_modified: timestamp,
            created_by: userId,
            // For new records, set initial values
            document_version: hojaDeRuta ? hojaDeRuta.document_version : 1,
            status: hojaDeRuta ? hojaDeRuta.status : 'draft',
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
          // First delete existing contacts
          const { error: deleteContactsError } = await supabase
            .from('hoja_de_ruta_contacts')
            .delete()
            .eq('hoja_de_ruta_id', upsertedRecord.id);
            
          if (deleteContactsError) {
            console.error("❌ PERSISTENCE: Error deleting contacts:", deleteContactsError);
            throw deleteContactsError;
          }

          // Then insert new contacts
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
          // First delete existing staff
          const { error: deleteStaffError } = await supabase
            .from('hoja_de_ruta_staff')
            .delete()
            .eq('hoja_de_ruta_id', upsertedRecord.id);
            
          if (deleteStaffError) {
            console.error("❌ PERSISTENCE: Error deleting staff:", deleteStaffError);
            throw deleteStaffError;
          }

          // Then insert new staff
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
    onSuccess: (savedRecord) => {
      // Update cache with the new data immediately
      updateCacheOptimistically({
        ...savedRecord,
        contacts: hojaDeRuta?.contacts || [],
        staff: hojaDeRuta?.staff || [],
        logistics: hojaDeRuta?.logistics || null,
        travel: hojaDeRuta?.travel || [],
        rooms: hojaDeRuta?.rooms || [],
        images: hojaDeRuta?.images || []
      });
      
      toast({
        title: "✅ Guardado con éxito",
        description: "Los cambios se han guardado correctamente.",
      });
    },
    onError: (error: any) => {
      console.error('❌ PERSISTENCE: Error saving hoja de ruta:', error);
      toast({
        title: "❌ Error al guardar",
        description: `No se pudieron guardar los cambios: ${error.message}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Reset the mutation state to allow subsequent saves
      setTimeout(() => {
        resetSaveMutation();
      }, 1000);
    }
  });

  // Save travel arrangements with improved state management
  const { mutateAsync: saveTravelArrangements, isPending: isSavingTravel, reset: resetTravelMutation } = useMutation({
    mutationFn: async ({ hojaDeRutaId, arrangements }: { hojaDeRutaId: string, arrangements: TravelArrangement[] }) => {
      console.log("🚗 PERSISTENCE: Saving travel arrangements:", arrangements.length);
      
      // First delete existing travel arrangements
      const { error: deleteError } = await supabase
        .from('hoja_de_ruta_travel')
        .delete()
        .eq('hoja_de_ruta_id', hojaDeRutaId);
        
      if (deleteError) {
        console.error("❌ PERSISTENCE: Error deleting travel arrangements:", deleteError);
        throw deleteError;
      }

      // Then insert new travel arrangements if there are any
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
        
        if (error) {
          console.error("❌ PERSISTENCE: Error inserting travel arrangements:", error);
          throw error;
        }
      }
      
      return { success: true, count: arrangements.length };
    },
    onSuccess: () => {
      // Only update the travel part of the cache
      if (hojaDeRuta) {
        updateCacheOptimistically({
          ...hojaDeRuta,
          travel: hojaDeRuta.travel || []
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ PERSISTENCE: Error saving travel arrangements:', error);
      toast({
        title: "❌ Error al guardar viajes",
        description: `No se pudieron guardar los arreglos de viaje: ${error.message}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setTimeout(() => {
        resetTravelMutation();
      }, 1000);
    }
  });

  // Save room assignments with improved state management
  const { mutateAsync: saveRoomAssignments, isPending: isSavingRooms, reset: resetRoomsMutation } = useMutation({
    mutationFn: async ({ hojaDeRutaId, assignments }: { hojaDeRutaId: string, assignments: RoomAssignment[] }) => {
      console.log("🏨 PERSISTENCE: Saving room assignments:", assignments.length);
      
      // First delete existing room assignments
      const { error: deleteError } = await supabase
        .from('hoja_de_ruta_rooms')
        .delete()
        .eq('hoja_de_ruta_id', hojaDeRutaId);
        
      if (deleteError) {
        console.error("❌ PERSISTENCE: Error deleting room assignments:", deleteError);
        throw deleteError;
      }

      // Then insert new room assignments if there are any
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
        
        if (error) {
          console.error("❌ PERSISTENCE: Error inserting room assignments:", error);
          throw error;
        }
      }
      
      return { success: true, count: assignments.length };
    },
    onSuccess: () => {
      // Only update the rooms part of the cache
      if (hojaDeRuta) {
        updateCacheOptimistically({
          ...hojaDeRuta,
          rooms: hojaDeRuta.rooms || []
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ PERSISTENCE: Error saving room assignments:', error);
      toast({
        title: "❌ Error al guardar habitaciones",
        description: `No se pudieron guardar las asignaciones de habitaciones: ${error.message}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setTimeout(() => {
        resetRoomsMutation();
      }, 1000);
    }
  });

  // Save venue images with improved state management
  const { mutateAsync: saveVenueImages, isPending: isSavingImages, reset: resetImagesMutation } = useMutation({
    mutationFn: async ({ hojaDeRutaId, images }: { hojaDeRutaId: string, images: { image_path: string, image_type: string }[] }) => {
      console.log("📸 PERSISTENCE: Saving venue images:", images.length);
      
      // First delete existing images
      const { error: deleteError } = await supabase
        .from('hoja_de_ruta_images')
        .delete()
        .eq('hoja_de_ruta_id', hojaDeRutaId);
        
      if (deleteError) {
        console.error("❌ PERSISTENCE: Error deleting images:", deleteError);
        throw deleteError;
      }

      // Then insert new images if there are any
      if (images.length > 0) {
        const { error } = await supabase
          .from('hoja_de_ruta_images')
          .insert(images.map(img => ({
            hoja_de_ruta_id: hojaDeRutaId,
            image_path: img.image_path,
            image_type: img.image_type
          })));
        
        if (error) {
          console.error("❌ PERSISTENCE: Error inserting images:", error);
          throw error;
        }
      }
      
      return { success: true, count: images.length };
    },
    onSuccess: () => {
      // Only update the images part of the cache
      if (hojaDeRuta) {
        updateCacheOptimistically({
          ...hojaDeRuta,
          images: hojaDeRuta.images || []
        });
      }
    },
    onError: (error: any) => {
      console.error('❌ PERSISTENCE: Error saving venue images:', error);
      toast({
        title: "❌ Error al guardar imágenes",
        description: `No se pudieron guardar las imágenes: ${error.message}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setTimeout(() => {
        resetImagesMutation();
      }, 1000);
    }
  });

  // Force a manual refetch of the data with cache invalidation
  const refreshData = useCallback(() => {
    if (jobId) {
      console.log("🔄 PERSISTENCE: Manually refreshing data for job:", jobId);
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta', jobId] });
      return refetch();
    }
    return Promise.resolve({ data: null, error: null, isLoading: false });
  }, [jobId, refetch, queryClient]);

  return {
    hojaDeRuta,
    isLoading,
    fetchError,
    saveHojaDeRuta,
    isSaving,
    saveTravelArrangements,
    isSavingTravel,
    saveRoomAssignments,
    isSavingRooms,
    saveVenueImages,
    isSavingImages,
    refreshData,
    // Expose mutation reset functions for better state management
    resetSaveMutation,
    resetTravelMutation,
    resetRoomsMutation,
    resetImagesMutation
  };
};
