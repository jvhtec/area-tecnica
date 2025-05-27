
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FLEX_API_BASE_URL = 'https://api.intranet.sectorpro.es';

interface FlexFolderPayload {
  parent_id?: string;
  name: string;
  description?: string;
}

interface FlexFolderResponse {
  id: string;
  name: string;
  parent_id?: string;
}

async function createFlexFolder(payload: FlexFolderPayload, authToken: string): Promise<FlexFolderResponse> {
  console.log("Creating Flex folder with payload:", payload);
  
  try {
    const response = await fetch(`${FLEX_API_BASE_URL}/element`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log("Created Flex folder:", result);
    return result;
  } catch (error) {
    console.error("Flex folder creation error:", error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { tourId, createRootFolders, createDateFolders } = await req.json()
    
    if (!tourId) {
      throw new Error('Tour ID is required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authToken = Deno.env.get('X_AUTH_TOKEN')
    
    if (!supabaseUrl || !supabaseKey || !authToken) {
      throw new Error('Missing environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get tour information
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('*')
      .eq('id', tourId)
      .single()

    if (tourError) throw tourError

    let result = { success: true, data: tour }

    // Create root folders if requested
    if (createRootFolders) {
      console.log("Creating root folders for tour:", tour.name)
      
      // Create main tour folder
      const mainFolder = await createFlexFolder({
        name: tour.name,
        description: `Tour folder for ${tour.name}`
      }, authToken)

      // Create department folders
      const departments = ['sound', 'lights', 'video', 'production', 'personnel', 'comercial']
      const folderIds: Record<string, string> = { main: mainFolder.id }

      for (const dept of departments) {
        const deptFolder = await createFlexFolder({
          parent_id: mainFolder.id,
          name: dept.charAt(0).toUpperCase() + dept.slice(1),
          description: `${dept} folder for ${tour.name}`
        }, authToken)
        folderIds[dept] = deptFolder.id
      }

      // Update tour with folder IDs
      const { error: updateError } = await supabase
        .from('tours')
        .update({
          flex_folders_created: true,
          flex_main_folder_id: folderIds.main,
          flex_sound_folder_id: folderIds.sound,
          flex_lights_folder_id: folderIds.lights,
          flex_video_folder_id: folderIds.video,
          flex_production_folder_id: folderIds.production,
          flex_personnel_folder_id: folderIds.personnel,
          flex_comercial_folder_id: folderIds.comercial
        })
        .eq('id', tourId)

      if (updateError) throw updateError

      result.data = { ...tour, ...folderIds, flex_folders_created: true }
    }

    // Create date folders if requested
    if (createDateFolders) {
      console.log("Creating date folders for tour:", tour.name)
      
      // Get tour dates
      const { data: tourDates, error: tourDatesError } = await supabase
        .from("tour_dates")
        .select("*")
        .eq("tour_id", tourId)
        .order("date", { ascending: true })

      if (tourDatesError) throw tourDatesError

      if (!tourDates || tourDates.length === 0) {
        throw new Error('No tour dates found for this tour')
      }

      // Ensure tour has root folders
      if (!tour.flex_main_folder_id) {
        throw new Error('Tour root folders must be created before date folders')
      }

      // Create folders for each tour date
      for (const tourDate of tourDates) {
        const dateStr = new Date(tourDate.date).toISOString().split('T')[0]
        const dateFolderName = `${dateStr} - ${tour.name}`
        
        // Create date folder under main tour folder
        const dateFolder = await createFlexFolder({
          parent_id: tour.flex_main_folder_id,
          name: dateFolderName,
          description: `Date folder for ${tour.name} on ${dateStr}`
        }, authToken)

        // Create department subfolders for this date
        const departments = ['sound', 'lights', 'video', 'production']
        for (const dept of departments) {
          await createFlexFolder({
            parent_id: dateFolder.id,
            name: dept.charAt(0).toUpperCase() + dept.slice(1),
            description: `${dept} folder for ${tour.name} on ${dateStr}`
          }, authToken)
        }

        // Store the flex folder reference
        await supabase
          .from("flex_folders")
          .insert({
            tour_date_id: tourDate.id,
            job_id: null, // This is a tour date folder, not a job folder
            element_id: dateFolder.id,
            folder_type: 'tour_date',
            department: null
          })
      }
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error("Error in create-flex-folders:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
