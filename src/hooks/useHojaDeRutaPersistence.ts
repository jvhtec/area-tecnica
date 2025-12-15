import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { EventData, TravelArrangement, Accommodation } from "@/types/hoja-de-ruta";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface SaveCallbacks {
  onSuccess?: () => void;
  onError?: (error: any) => void;
  onSettled?: () => void;
}

export const useHojaDeRutaPersistence = (
  jobId: string, 
  callbacks: SaveCallbacks = {}
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled } = callbacks;

  // Fetch existing hoja de ruta data with new structure
  const { data: hojaDeRuta, isLoading, error: fetchError } = useQuery({
    queryKey: ['hoja-de-ruta', jobId],
    queryFn: async () => {
      if (!jobId) return null;

      console.log("🔍 FETCH: Starting to fetch hoja de ruta data for job:", jobId);

      // Fetch main hoja de ruta data
      const { data: mainData, error: mainError } = await supabase
        .from('hoja_de_ruta')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

      if (mainError) {
        console.error('❌ FETCH: Error fetching main data:', mainError);
        throw mainError;
      }

      if (!mainData) {
        console.log("📝 FETCH: No hoja de ruta found for job");
        return null;
      }

      console.log("✅ FETCH: Main data fetched:", mainData);

      // Fetch all related data in parallel
      const [
        { data: contacts, error: contactsError },
        { data: staff, error: staffError },
        { data: logistics, error: logisticsError },
        { data: transport, error: transportError },
        { data: travelArrangements, error: travelError },
        { data: accommodations, error: accommodationsError },
        { data: images, error: imagesError }
      ] = await Promise.all([
        supabase.from('hoja_de_ruta_contacts').select('*').eq('hoja_de_ruta_id', mainData.id),
        supabase.from('hoja_de_ruta_staff').select('*').eq('hoja_de_ruta_id', mainData.id),
        supabase.from('hoja_de_ruta_logistics').select('*').eq('hoja_de_ruta_id', mainData.id).maybeSingle(),
        supabase.from('hoja_de_ruta_transport').select('*').eq('hoja_de_ruta_id', mainData.id),
        supabase.from('hoja_de_ruta_travel_arrangements').select('*').eq('hoja_de_ruta_id', mainData.id),
        supabase.from('hoja_de_ruta_accommodations').select(`
          *,
          hoja_de_ruta_room_assignments(*)
        `).eq('hoja_de_ruta_id', mainData.id),
        supabase.from('hoja_de_ruta_images').select('*').eq('hoja_de_ruta_id', mainData.id)
      ]);

      // Handle any errors
      const errors = [
        { name: 'contacts', error: contactsError },
        { name: 'staff', error: staffError },
        { name: 'logistics', error: logisticsError },
        { name: 'transport', error: transportError },
        { name: 'travel', error: travelError },
        { name: 'accommodations', error: accommodationsError },
        { name: 'images', error: imagesError }
      ].filter(item => item.error);

      if (errors.length > 0) {
        console.error('❌ FETCH: Errors fetching related data:', errors);
        // Don't throw, just log warnings for non-critical data
        errors.forEach(({ name, error }) => {
          console.warn(`⚠️ FETCH: Warning fetching ${name}:`, error);
        });
      }

      console.log("🔄 FETCH: Transforming data to frontend format");

      // Attempt to get venue from the job's location as the primary source
      let venueFromJob: { name?: string; address?: string; coordinates?: { lat: number; lng: number } } | null = null;
      try {
        const { data: jobRec, error: jobErr } = await supabase
          .from('jobs')
          .select('location_id')
          .eq('id', jobId)
          .maybeSingle();

        if (!jobErr && jobRec?.location_id) {
          const { data: loc, error: locErr } = await supabase
            .from('locations')
            .select('name, formatted_address, latitude, longitude')
            .eq('id', jobRec.location_id)
            .maybeSingle();
          if (!locErr && loc) {
            venueFromJob = {
              name: loc.name || undefined,
              address: (loc.formatted_address || loc.name) || undefined,
              coordinates: (typeof loc.latitude === 'number' && typeof loc.longitude === 'number')
                ? { lat: loc.latitude, lng: loc.longitude }
                : undefined,
            };
          }
        }
      } catch (e) {
        console.warn('FETCH: Unable to read job location, falling back to hoja_de_ruta venue:', e);
      }

      // Transform the data back to the frontend format
      const eventData: EventData = {
        eventName: mainData.event_name || '',
        eventDates: mainData.event_dates || '',
        venue: venueFromJob || {
          name: mainData.venue_name || '',
          address: mainData.venue_address || '',
          coordinates: mainData.venue_latitude && mainData.venue_longitude ? {
            lat: parseFloat(mainData.venue_latitude),
            lng: parseFloat(mainData.venue_longitude)
          } : undefined
        },
        contacts: contacts?.length ? contacts.map(c => ({
          name: c.name,
          role: c.role || '',
          phone: c.phone || ''
        })) : [{ name: '', role: '', phone: '' }],
        logistics: {
          transport: transport?.length ? transport.map(t => ({
            id: t.id,
            transport_type: t.transport_type,
            driver_name: t.driver_name,
            driver_phone: t.driver_phone,
            license_plate: t.license_plate,
            company: t.company,
            date_time: t.date_time ? String(t.date_time).replace(' ', 'T').slice(0, 16) : '',
            has_return: t.has_return,
            return_date_time: t.return_date_time ? String(t.return_date_time).replace(' ', 'T').slice(0, 16) : ''
          })) : [],
          loadingDetails: logistics?.loading_details || '',
          unloadingDetails: logistics?.unloading_details || '',
          equipmentLogistics: logistics?.equipment_logistics || ''
        },
        staff: staff?.length ? staff.map(s => ({
          name: s.name,
          surname1: s.surname1 || '',
          surname2: s.surname2 || '',
          position: s.position || '',
          dni: s.dni || ''
        })) : [{ name: '', surname1: '', surname2: '', position: '', dni: '' }],
        schedule: mainData.schedule || '',
        // Load multi-day program if available
        programScheduleDays: (mainData as any).program_schedule_json || undefined,
        powerRequirements: mainData.power_requirements || '',
        auxiliaryNeeds: mainData.auxiliary_needs || '',
        weather: mainData.weather_data || []
      };

      // Transform accommodations data
      const accommodationsData = accommodations?.map(acc => ({
        id: acc.id,
        hotel_name: acc.hotel_name,
        address: acc.address || '',
        check_in: acc.check_in || '',
        check_out: acc.check_out || '',
        coordinates: acc.latitude && acc.longitude ? {
          lat: parseFloat(acc.latitude),
          lng: parseFloat(acc.longitude)
        } : undefined,
        rooms: acc.hoja_de_ruta_room_assignments?.map(room => ({
          room_type: room.room_type,
          room_number: room.room_number || '',
          staff_member1_id: room.staff_member1_id || '',
          staff_member2_id: room.staff_member2_id || ''
        })) || []
      })) || [];

      // Transform travel arrangements
      const travelData = travelArrangements?.map(travel => ({
        transportation_type: travel.transportation_type,
        pickup_address: travel.pickup_address,
        pickup_time: travel.pickup_time,
        flight_train_number: travel.flight_train_number,
        departure_time: travel.departure_time,
        arrival_time: travel.arrival_time,
        driver_name: travel.driver_name,
        driver_phone: travel.driver_phone,
        plate_number: travel.plate_number,
        notes: travel.notes
      })) || [];

      console.log("✅ FETCH: Data transformation complete");
      console.log("📊 FETCH: Event data:", eventData);
      console.log("🏨 FETCH: Accommodations:", accommodationsData);
      console.log("✈️ FETCH: Travel arrangements:", travelData);

      return {
        ...mainData, // Include all original metadata fields
        eventData,
        travelArrangements: travelData,
        accommodations: accommodationsData,
        images: images || []
      };
    },
    enabled: !!jobId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });

  // Create or update hoja de ruta with enhanced functionality
  const saveHojaDeRuta = useMutation({
    mutationFn: async ({ eventData, userId }: { eventData: EventData; userId: string }) => {
      console.log("💾 SAVE: Starting to save hoja de ruta data for job:", jobId);
      console.log("📊 SAVE: Event data to save:", eventData);

      if (!jobId) {
        throw new Error('No job ID provided');
      }

      // Validate required fields
      if (!eventData.eventName?.trim()) {
        throw new Error('Event name is required');
      }

      const now = new Date().toISOString();

      // First, upsert the main hoja de ruta record
      const mainData = {
        job_id: jobId,
        event_name: eventData.eventName,
        event_dates: eventData.eventDates || '',
        venue_name: eventData.venue?.name || '',
        venue_address: eventData.venue?.address || '',
        venue_latitude: eventData.venue?.coordinates?.lat || null,
        venue_longitude: eventData.venue?.coordinates?.lng || null,
        schedule: eventData.schedule || '',
        // Save multi-day program as JSONB
        program_schedule_json: eventData.programScheduleDays && eventData.programScheduleDays.length > 0 ? eventData.programScheduleDays : null,
        power_requirements: eventData.powerRequirements || '',
        auxiliary_needs: eventData.auxiliaryNeeds || '',
        weather_data: eventData.weather || null,
        updated_at: now,
        last_modified: now,
        last_modified_by: userId
      };

      console.log("🔄 SAVE: Upserting main data:", mainData);

      const { data: savedMain, error: mainError } = await supabase
        .from('hoja_de_ruta')
        .upsert(mainData, { 
          onConflict: 'job_id',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (mainError) {
        console.error('❌ SAVE: Error saving main data:', mainError);
        throw mainError;
      }

      console.log("✅ SAVE: Main data saved:", savedMain);

      const hojaDeRutaId = savedMain.id;

      // Save logistics data
      const logisticsData = {
        hoja_de_ruta_id: hojaDeRutaId,
        loading_details: eventData.logistics?.loadingDetails || '',
        unloading_details: eventData.logistics?.unloadingDetails || '',
        equipment_logistics: eventData.logistics?.equipmentLogistics || ''
      };

      console.log("🔄 SAVE: Upserting logistics data:", logisticsData);

      const { error: logisticsError } = await supabase
        .from('hoja_de_ruta_logistics')
        .upsert(logisticsData, { onConflict: 'hoja_de_ruta_id' });

      if (logisticsError) {
        console.error('❌ SAVE: Error saving logistics:', logisticsError);
        // Do not throw, just log the error
      }

      // Save transport data (delete existing and insert new)
      if (eventData.logistics?.transport && Array.isArray(eventData.logistics.transport)) {
        const { error: deleteTransportError } = await supabase
          .from('hoja_de_ruta_transport')
          .delete()
          .eq('hoja_de_ruta_id', hojaDeRutaId);

        if (deleteTransportError) {
          console.error('❌ SAVE: Error deleting old transport:', deleteTransportError);
          // Do not throw, just log the error
        }

        if (eventData.logistics.transport.length > 0) {
          const transportData = eventData.logistics.transport.map(transport => ({
            hoja_de_ruta_id: hojaDeRutaId,
            transport_type: transport.transport_type,
            driver_name: transport.driver_name || '',
            driver_phone: transport.driver_phone || '',
            license_plate: transport.license_plate || '',
            company: transport.company || null,
            date_time: transport.date_time || null,
            has_return: transport.has_return || false,
            return_date_time: transport.return_date_time || null
          }));

          console.log("🔄 SAVE: Inserting transport data:", transportData);

          const { error: transportError } = await supabase
            .from('hoja_de_ruta_transport')
            .insert(transportData);

          if (transportError) {
            console.error('❌ SAVE: Error saving transport:', transportError);
            // Do not throw, just log the error
          }
        }
      }

      // Save contacts (delete existing and insert new)
      const { error: deleteContactsError } = await supabase
        .from('hoja_de_ruta_contacts')
        .delete()
        .eq('hoja_de_ruta_id', hojaDeRutaId);

      if (deleteContactsError) {
        console.error('❌ SAVE: Error deleting old contacts:', deleteContactsError);
        // Do not throw, just log the error
      }

      const validContacts = eventData.contacts?.filter(c => 
        c.name?.trim() || c.role?.trim() || c.phone?.trim()
      ) || [];

      if (validContacts.length > 0) {
        const contactsData = validContacts.map(contact => ({
          hoja_de_ruta_id: hojaDeRutaId,
          name: contact.name || '',
          role: contact.role || '',
          phone: contact.phone || ''
        }));

        console.log("🔄 SAVE: Inserting contacts data:", contactsData);

        const { error: contactsError } = await supabase
          .from('hoja_de_ruta_contacts')
          .insert(contactsData);

        if (contactsError) {
          console.error('❌ SAVE: Error saving contacts:', contactsError);
          // Do not throw, just log the error
        }
      }

      // Save staff (delete existing and insert new)
      const { error: deleteStaffError } = await supabase
        .from('hoja_de_ruta_staff')
        .delete()
        .eq('hoja_de_ruta_id', hojaDeRutaId);

      if (deleteStaffError) {
        console.error('❌ SAVE: Error deleting old staff:', deleteStaffError);
        // Do not throw, just log the error
      }

      const validStaff = eventData.staff?.filter(s => 
        s.name?.trim() || s.surname1?.trim() || s.surname2?.trim() || s.position?.trim()
      ) || [];

      if (validStaff.length > 0) {
        const staffData = validStaff.map(staff => ({
          hoja_de_ruta_id: hojaDeRutaId,
          name: staff.name || '',
          surname1: staff.surname1 || '',
          surname2: staff.surname2 || '',
          position: staff.position || '',
          dni: staff.dni || ''
        }));

        console.log("🔄 SAVE: Inserting staff data:", staffData);

        const { error: staffError } = await supabase
          .from('hoja_de_ruta_staff')
          .insert(staffData);

        if (staffError) {
          console.error('❌ SAVE: Error saving staff:', staffError);
          // Do not throw, just log the error
        }
      }

      console.log("✅ SAVE: All data saved successfully");
      return savedMain;
    },
    onSuccess: (data) => {
      console.log("🎉 SAVE: Success callback - invalidating queries");
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta', jobId] });
      onSuccess?.();
    },
    onError: (error) => {
      console.error("💥 SAVE: Error callback:", error);
      onError?.(error);
    },
    onSettled: () => {
      console.log("🏁 SAVE: Settled callback");
      onSettled?.();
    }
  });

  // Save travel arrangements
  const saveTravelArrangements = useMutation({
    mutationFn: async (travelArrangements: TravelArrangement[]) => {
      console.log("✈️ SAVE TRAVEL: Starting to save travel arrangements for job:", jobId);
      console.log("📊 SAVE TRAVEL: Travel data:", travelArrangements);

      if (!jobId) {
        throw new Error('No job ID provided');
      }

      // First get the hoja de ruta ID
      const { data: hojaDeRuta, error: fetchError } = await supabase
        .from('hoja_de_ruta')
        .select('id')
        .eq('job_id', jobId)
        .maybeSingle();

      if (fetchError || !hojaDeRuta) {
        console.error('❌ SAVE TRAVEL: Error fetching hoja de ruta:', fetchError);
        throw new Error('Hoja de ruta not found. Please save the main data first.');
      }

      const hojaDeRutaId = hojaDeRuta.id;

      // Delete existing travel arrangements
      const { error: deleteError } = await supabase
        .from('hoja_de_ruta_travel_arrangements')
        .delete()
        .eq('hoja_de_ruta_id', hojaDeRutaId);

      if (deleteError) {
        console.error('❌ SAVE TRAVEL: Error deleting old travel arrangements:', deleteError);
        throw deleteError;
      }

      // Insert new travel arrangements if any
      const validArrangements = travelArrangements.filter(arrangement => 
        arrangement.transportation_type?.trim() ||
        arrangement.pickup_address?.trim() ||
        arrangement.pickup_time?.trim() ||
        arrangement.departure_time?.trim() ||
        arrangement.arrival_time?.trim()
      );

      if (validArrangements.length > 0) {
        const travelData = validArrangements.map(arrangement => ({
          hoja_de_ruta_id: hojaDeRutaId,
          transportation_type: arrangement.transportation_type,
          pickup_address: arrangement.pickup_address || '',
          pickup_time: arrangement.pickup_time || null,
          flight_train_number: arrangement.flight_train_number || '',
          departure_time: arrangement.departure_time || null,
          arrival_time: arrangement.arrival_time || null,
          driver_name: arrangement.driver_name || '',
          driver_phone: arrangement.driver_phone || '',
          plate_number: arrangement.plate_number || '',
          notes: arrangement.notes || ''
        }));

        console.log("🔄 SAVE TRAVEL: Inserting travel data:", travelData);

        const { error: insertError } = await supabase
          .from('hoja_de_ruta_travel_arrangements')
          .insert(travelData);

        if (insertError) {
          console.error('❌ SAVE TRAVEL: Error saving travel arrangements:', insertError);
          throw insertError;
        }
      }

      console.log("✅ SAVE TRAVEL: Travel arrangements saved successfully");
      return travelArrangements;
    },
    onSuccess: () => {
      console.log("🎉 SAVE TRAVEL: Success - invalidating queries");
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta', jobId] });
    },
    onError: (error) => {
      console.error("💥 SAVE TRAVEL: Error:", error);
      onError?.(error);
    }
  });

  // Save accommodations
  const saveAccommodations = useMutation({
    mutationFn: async (accommodations: Accommodation[]) => {
      console.log("🏨 SAVE ACCOMMODATION: Starting to save accommodations for job:", jobId);
      console.log("📊 SAVE ACCOMMODATION: Accommodation data:", accommodations);

      if (!jobId) {
        throw new Error('No job ID provided');
      }

      // First get the hoja de ruta ID
      const { data: hojaDeRuta, error: fetchError } = await supabase
        .from('hoja_de_ruta')
        .select('id')
        .eq('job_id', jobId)
        .maybeSingle();

      if (fetchError || !hojaDeRuta) {
        console.error('❌ SAVE ACCOMMODATION: Error fetching hoja de ruta:', fetchError);
        throw new Error('Hoja de ruta not found. Please save the main data first.');
      }

      const hojaDeRutaId = hojaDeRuta.id;

      // Delete existing accommodations and their room assignments (cascade should handle rooms)
      const { error: deleteError } = await supabase
        .from('hoja_de_ruta_accommodations')
        .delete()
        .eq('hoja_de_ruta_id', hojaDeRutaId);

      if (deleteError) {
        console.error('❌ SAVE ACCOMMODATION: Error deleting old accommodations:', deleteError);
        throw deleteError;
      }

      // Insert new accommodations if any
      const validAccommodations = accommodations.filter(acc => 
        acc.hotel_name?.trim() || acc.address?.trim()
      );

      if (validAccommodations.length > 0) {
        for (const accommodation of validAccommodations) {
          // Insert accommodation
          const accommodationData = {
            hoja_de_ruta_id: hojaDeRutaId,
            hotel_name: accommodation.hotel_name || '',
            address: accommodation.address || '',
            check_in: accommodation.check_in || '',
            check_out: accommodation.check_out || '',
            latitude: accommodation.coordinates?.lat || null,
            longitude: accommodation.coordinates?.lng || null
          };

          console.log("🔄 SAVE ACCOMMODATION: Inserting accommodation:", accommodationData);

          const { data: savedAccommodation, error: accommodationError } = await supabase
            .from('hoja_de_ruta_accommodations')
            .insert(accommodationData)
            .select()
            .single();

          if (accommodationError) {
            console.error('❌ SAVE ACCOMMODATION: Error saving accommodation:', accommodationError);
            throw accommodationError;
          }

          // Insert room assignments if any
          const validRooms = accommodation.rooms?.filter(room => 
            room.room_type?.trim() || room.room_number?.trim() || 
            room.staff_member1_id?.trim() || room.staff_member2_id?.trim()
          ) || [];

          if (validRooms.length > 0) {
            const roomsData = validRooms.map(room => ({
              accommodation_id: savedAccommodation.id,
              room_type: room.room_type,
              room_number: room.room_number || '',
              staff_member1_id: room.staff_member1_id || '',
              staff_member2_id: room.staff_member2_id || ''
            }));

            console.log("🔄 SAVE ACCOMMODATION: Inserting rooms:", roomsData);

            const { error: roomsError } = await supabase
              .from('hoja_de_ruta_room_assignments')
              .insert(roomsData);

            if (roomsError) {
              console.error('❌ SAVE ACCOMMODATION: Error saving rooms:', roomsError);
              throw roomsError;
            }
          }
        }
      }

      console.log("✅ SAVE ACCOMMODATION: Accommodations saved successfully");
      return accommodations;
    },
    onSuccess: () => {
      console.log("🎉 SAVE ACCOMMODATION: Success - invalidating queries");
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta', jobId] });
    },
    onError: (error) => {
      console.error("💥 SAVE ACCOMMODATION: Error:", error);
      onError?.(error);
    }
  });

  // Save venue images
  const saveVenueImages = useMutation({
    mutationFn: async (images: { image_path: string; image_type: string }[]) => {
      console.log("📸 SAVE IMAGES: Starting to save venue images for job:", jobId);
      console.log("📊 SAVE IMAGES: Images data:", images);

      if (!jobId) {
        throw new Error('No job ID provided');
      }

      // First get the hoja de ruta ID
      const { data: hojaDeRuta, error: fetchError } = await supabase
        .from('hoja_de_ruta')
        .select('id')
        .eq('job_id', jobId)
        .maybeSingle();

      if (fetchError || !hojaDeRuta) {
        console.error('❌ SAVE IMAGES: Error fetching hoja de ruta:', fetchError);
        throw new Error('Hoja de ruta not found. Please save the main data first.');
      }

      const hojaDeRutaId = hojaDeRuta.id;

      // Delete existing images
      const { error: deleteError } = await supabase
        .from('hoja_de_ruta_images')
        .delete()
        .eq('hoja_de_ruta_id', hojaDeRutaId);

      if (deleteError) {
        console.error('❌ SAVE IMAGES: Error deleting old images:', deleteError);
        throw deleteError;
      }

      // Insert new images if any
      if (images.length > 0) {
        const imagesData = images.map(img => ({
          hoja_de_ruta_id: hojaDeRutaId,
          image_path: img.image_path,
          image_type: img.image_type
        }));

        console.log("🔄 SAVE IMAGES: Inserting images data:", imagesData);

        const { error: insertError } = await supabase
          .from('hoja_de_ruta_images')
          .insert(imagesData);

        if (insertError) {
          console.error('❌ SAVE IMAGES: Error saving images:', insertError);
          throw insertError;
        }
      }

      console.log("✅ SAVE IMAGES: Images saved successfully");
      return images;
    },
    onSuccess: () => {
      console.log("🎉 SAVE IMAGES: Success - invalidating queries");
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta', jobId] });
    },
    onError: (error) => {
      console.error("💥 SAVE IMAGES: Error:", error);
      onError?.(error);
    }
  });

  // Force a manual refetch of the data with cache invalidation
  const refreshData = useCallback(() => {
    if (jobId) {
      console.log("🔄 REFRESH: Manually refreshing data for job:", jobId);
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta', jobId] });
    }
  }, [jobId, queryClient]);

  return {
    hojaDeRuta: hojaDeRuta || null,
    isLoading,
    fetchError,
    saveHojaDeRuta: saveHojaDeRuta.mutateAsync,
    isSaving: saveHojaDeRuta.isPending,
    saveTravelArrangements: saveTravelArrangements.mutateAsync,
    isSavingTravel: saveTravelArrangements.isPending,
    saveRoomAssignments: saveAccommodations.mutateAsync, // Alias for backward compatibility
    isSavingRooms: saveAccommodations.isPending,
    saveAccommodations: saveAccommodations.mutateAsync,
    saveVenueImages: saveVenueImages.mutateAsync,
    isSavingImages: saveVenueImages.isPending,
    refreshData,
    resetSaveMutation: saveHojaDeRuta.reset,
    resetTravelMutation: saveTravelArrangements.reset,
    resetRoomsMutation: saveAccommodations.reset,
    resetImagesMutation: saveVenueImages.reset,
  };
};
