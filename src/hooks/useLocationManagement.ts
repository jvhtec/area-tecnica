import { supabase } from "@/lib/supabase";

export const useLocationManagement = () => {
  const getOrCreateLocation = async (locationName: string) => {
    if (!locationName) return null;
    
    console.log("Checking for existing location:", locationName);
    
    // First try to get the existing location
    const { data: existingLocation, error: fetchError } = await supabase
      .from('locations')
      .select('id')
      .eq('name', locationName)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching location:", fetchError);
      throw fetchError;
    }

    // If location exists, return its ID
    if (existingLocation) {
      console.log("Found existing location:", existingLocation);
      return existingLocation.id;
    }

    console.log("Creating new location:", locationName);
    
    // If location doesn't exist, create it
    const { data: newLocation, error: createError } = await supabase
      .from('locations')
      .insert({ name: locationName })
      .select()
      .single();

    if (createError) {
      console.error("Error creating location:", createError);
      throw createError;
    }

    console.log("Created new location:", newLocation);
    return newLocation.id;
  };

  return {
    getOrCreateLocation
  };
};