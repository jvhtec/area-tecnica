import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { EventData, TravelArrangement, Accommodation, Restaurant } from '@/types/hoja-de-ruta';

export const useHojaDeRutaData = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHojaDeRutaById = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('hoja_de_ruta')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchHojaDeRutaByJobId = useCallback(async (jobId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('hoja_de_ruta')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveHojaDeRuta = useCallback(async (
    jobId: string,
    eventData: EventData,
    travelArrangements: TravelArrangement[],
    accommodations: Accommodation[]
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if exists
      const existing = await fetchHojaDeRutaByJobId(jobId);
      
      const hojaData = {
        job_id: jobId,
        event_name: eventData.eventName,
        event_dates: eventData.eventDates,
        venue_name: eventData.venue?.name,
        venue_address: eventData.venue?.address,
        venue_latitude: eventData.venue?.coordinates?.lat,
        venue_longitude: eventData.venue?.coordinates?.lng,
        schedule: eventData.schedule,
        power_requirements: eventData.powerRequirements,
        auxiliary_needs: eventData.auxiliaryNeeds,
        status: 'draft',
        last_modified: new Date().toISOString()
      };

      let savedHoja;
      if (existing) {
        const { data, error } = await supabase
          .from('hoja_de_ruta')
          .update(hojaData)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        savedHoja = data;
      } else {
        const { data, error } = await supabase
          .from('hoja_de_ruta')
          .insert({
            ...hojaData,
            created_by: (await supabase.auth.getUser()).data.user?.id
          })
          .select()
          .single();
        
        if (error) throw error;
        savedHoja = data;
      }

      // Save related data
      await Promise.all([
        saveContacts(savedHoja.id, eventData.contacts || []),
        saveStaff(savedHoja.id, eventData.staff || []),
        saveTravelArrangements(savedHoja.id, travelArrangements),
        saveAccommodations(savedHoja.id, accommodations),
        saveRestaurants(savedHoja.id, eventData.restaurants || [])
      ]);

      return savedHoja;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchHojaDeRutaByJobId]);

  return {
    isLoading,
    error,
    fetchHojaDeRutaById,
    fetchHojaDeRutaByJobId,
    saveHojaDeRuta
  };
};

// Helper functions
const saveContacts = async (hojaId: string, contacts: any[]) => {
  // Delete existing contacts
  await supabase.from('hoja_de_ruta_contacts').delete().eq('hoja_de_ruta_id', hojaId);
  
  // Insert new contacts
  if (contacts.length > 0) {
    const contactsData = contacts
      .filter(contact => contact.name?.trim())
      .map(contact => ({
        hoja_de_ruta_id: hojaId,
        name: contact.name,
        role: contact.role,
        phone: contact.phone
      }));
    
    if (contactsData.length > 0) {
      await supabase.from('hoja_de_ruta_contacts').insert(contactsData);
    }
  }
};

const saveStaff = async (hojaId: string, staff: any[]) => {
  // Delete existing staff
  await supabase.from('hoja_de_ruta_staff').delete().eq('hoja_de_ruta_id', hojaId);
  
  // Insert new staff
  if (staff.length > 0) {
    const staffData = staff
      .filter(member => member.name?.trim())
      .map(member => ({
        hoja_de_ruta_id: hojaId,
        name: member.name,
        surname1: member.surname1,
        surname2: member.surname2,
        position: member.position,
        dni: member.dni
      }));
    
    if (staffData.length > 0) {
      await supabase.from('hoja_de_ruta_staff').insert(staffData);
    }
  }
};

const saveTravelArrangements = async (hojaId: string, arrangements: TravelArrangement[]) => {
  // Delete existing arrangements
  await supabase.from('hoja_de_ruta_transport').delete().eq('hoja_de_ruta_id', hojaId);
  
  // Insert new arrangements
  if (arrangements.length > 0) {
    const arrangementsData = arrangements
      .filter(arr => arr.transportation_type?.trim() || arr.pickup_address?.trim())
      .map(arr => ({
        hoja_de_ruta_id: hojaId,
        transport_type: arr.transportation_type,
        driver_name: arr.driver_name,
        driver_phone: arr.driver_phone,
        license_plate: arr.plate_number,
        date_time: arr.pickup_time ? new Date(`2000-01-01T${arr.pickup_time}`).toISOString() : null,
        return_date_time: arr.departure_time ? new Date(`2000-01-01T${arr.departure_time}`).toISOString() : null,
        has_return: !!arr.departure_time
      }));
    
    if (arrangementsData.length > 0) {
      await supabase.from('hoja_de_ruta_transport').insert(arrangementsData);
    }
  }
};

const saveAccommodations = async (hojaId: string, accommodations: Accommodation[]) => {
  // Delete existing accommodations and rooms
  const { data: existingAccommodations } = await supabase
    .from('hoja_de_ruta_accommodations')
    .select('id')
    .eq('hoja_de_ruta_id', hojaId);
  
  if (existingAccommodations) {
    for (const acc of existingAccommodations) {
      await supabase.from('hoja_de_ruta_room_assignments').delete().eq('accommodation_id', acc.id);
    }
    await supabase.from('hoja_de_ruta_accommodations').delete().eq('hoja_de_ruta_id', hojaId);
  }
  
  // Insert new accommodations
  for (const accommodation of accommodations) {
    if (accommodation.hotel_name?.trim()) {
      const { data: savedAccommodation } = await supabase
        .from('hoja_de_ruta_accommodations')
        .insert({
          hoja_de_ruta_id: hojaId,
          hotel_name: accommodation.hotel_name,
          address: accommodation.address,
          check_in: accommodation.check_in,
          check_out: accommodation.check_out,
          latitude: accommodation.coordinates?.lat,
          longitude: accommodation.coordinates?.lng
        })
        .select()
        .single();
      
      if (savedAccommodation && accommodation.rooms.length > 0) {
        const roomsData = accommodation.rooms
          .filter(room => room.room_type?.trim())
          .map(room => ({
            accommodation_id: savedAccommodation.id,
            room_type: room.room_type,
            room_number: room.room_number,
            staff_member1_id: room.staff_member1_id,
            staff_member2_id: room.staff_member2_id
          }));
        
        if (roomsData.length > 0) {
          await supabase.from('hoja_de_ruta_room_assignments').insert(roomsData);
        }
      }
    }
  }
};

const saveRestaurants = async (hojaId: string, restaurants: Restaurant[]) => {
  // Delete existing restaurants
  await supabase.from('hoja_de_ruta_restaurants').delete().eq('hoja_de_ruta_id', hojaId);
  
  // Insert new restaurants
  if (restaurants.length > 0) {
    const restaurantsData = restaurants
      .filter(restaurant => restaurant.name?.trim() && restaurant.googlePlaceId)
      .map(restaurant => ({
        hoja_de_ruta_id: hojaId,
        google_place_id: restaurant.googlePlaceId,
        name: restaurant.name,
        address: restaurant.address,
        rating: restaurant.rating,
        price_level: restaurant.priceLevel,
        cuisine: restaurant.cuisine || [],
        phone: restaurant.phone,
        website: restaurant.website,
        latitude: restaurant.coordinates?.lat,
        longitude: restaurant.coordinates?.lng,
        distance: restaurant.distance,
        photos: restaurant.photos || [],
        is_selected: restaurant.isSelected || false
      }));
    
    if (restaurantsData.length > 0) {
      await supabase.from('hoja_de_ruta_restaurants').insert(restaurantsData);
    }
  }
};