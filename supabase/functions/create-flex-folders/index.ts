
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { fetchWithRetry } from "../_shared/flexFetch.ts";
import { requireAdminOrManagement } from "../_shared/auth.ts";
import {
  ESTRUCTURA_DEPARTMENT,
  ESTRUCTURA_PULL_SHEETS,
  ESTRUCTURA_SOURCE_DEPARTMENTS,
} from "../../../src/domain/estructura.ts";
import {
  DEPARTMENT_IDS,
  DEPARTMENT_SUFFIXES,
  FLEX_FOLDER_IDS,
  RESPONSIBLE_PERSON_IDS,
} from "../../../src/utils/flex-folders/constants.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const FLEX_API_BASE_URL = 'https://api.intranet.sectorpro.es';
const FLEX_DIRECT_API_BASE_URL = Deno.env.get('FLEX_API_BASE_URL') ||
  'https://sectorpro.flexrentalsolutions.com/f5/api';

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

interface TypedFlexElementResponse {
  elementId: string;
}

type AppSupabaseClient = ReturnType<typeof createClient>;

interface TourFlexRecord {
  id: string;
  name: string;
  flex_main_folder_id: string | null;
  flex_estructura_folder_id: string | null;
}

interface TourDateRecord {
  id: string;
  date: string;
}

interface LinkedTourDateJob {
  id: string;
  tour_date_id: string | null;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
}

interface EstructuraTrackedRow {
  id: string;
  element_id: string;
  folder_type: string;
  source_department: string | null;
  job_id: string | null;
}

async function createTypedFlexElement(
  payload: Record<string, unknown>,
  authToken: string,
): Promise<TypedFlexElementResponse> {
  const response = await fetchWithRetry(`${FLEX_DIRECT_API_BASE_URL}/element`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': authToken,
      apikey: authToken,
      'X-Requested-With': 'XMLHttpRequest',
      'X-API-Client': 'flex5-desktop',
    },
    body: JSON.stringify(payload),
  }, { retryOnTimeout: false });
  if (!response.ok) {
    throw new Error(`Flex returned ${response.status} while creating an Estructura element`);
  }
  const result = await response.json() as TypedFlexElementResponse;
  if (!result.elementId) throw new Error('Flex returned no elementId for an Estructura element');
  return result;
}

const flexDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid Flex date: ${value}`);
  return `${date.toISOString().split('.')[0]}.000Z`;
};

const tourDateDocumentNumber = (value: string): string =>
  new Date(value).toISOString().slice(2, 10).replaceAll('-', '');

async function resolveActorName(supabase: ReturnType<typeof createClient>, actorId: string | null): Promise<string | null> {
  if (!actorId) return null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('first_name,last_name,nickname,email')
      .eq('id', actorId)
      .maybeSingle();
    if (!data) return null;
    const full = `${data.first_name || ''} ${data.last_name || ''}`.trim();
    if (full) return full;
    if ((data as any).nickname) return (data as any).nickname as string;
    return data.email || null;
  } catch (_err) {
    return null;
  }
}

async function createFlexFolder(payload: FlexFolderPayload, authToken: string): Promise<FlexFolderResponse> {
  console.log("Creating Flex folder", { hasParent: Boolean(payload.parent_id) });
  
  try {
    // Folder creation is not idempotent on the Flex side, so a timed-out
    // attempt is never replayed (it may have landed); 5xx/429 are retried.
    const response = await fetchWithRetry(`${FLEX_API_BASE_URL}/element`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload)
    }, { retryOnTimeout: false });
    
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

/**
 * Gets the selected departments for a tour by checking its jobs
 */
async function getTourDepartments(supabase: any, tourId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      job_departments (department)
    `)
    .eq('tour_id', tourId)
    .limit(1);

  if (error || !data || data.length === 0) {
    console.log("No departments found for tour, defaulting to all departments");
    return ['sound', 'lights', 'video', 'production', 'personnel', 'comercial'];
  }

  const departments = data[0].job_departments?.map((jd: any) => jd.department) || [];
  console.log("Found departments for tour:", departments);
  return departments;
}

/**
 * Determines which departments should have folders created
 */
function shouldCreateDepartmentFolder(department: string, selectedDepartments: string[]): boolean {
  // Always create these administrative departments
  const alwaysCreateDepartments = ['production', 'personnel', 'comercial'];
  
  if (alwaysCreateDepartments.includes(department)) {
    return true;
  }

  // For technical departments (sound, lights, video), only create if selected
  const technicalDepartments = ['sound', 'lights', 'video'];
  if (technicalDepartments.includes(department)) {
    return selectedDepartments.includes(department);
  }

  return false;
}

async function ensureTrackedTourEstructuraRoot(
  supabase: AppSupabaseClient,
  tour: TourFlexRecord,
  authToken: string,
): Promise<string> {
  if (!tour.flex_main_folder_id) {
    throw new Error('Tour root folder must exist before Estructura');
  }

  let elementId = tour.flex_estructura_folder_id as string | null;
  if (!elementId) {
    const created = await createFlexFolder({
      parent_id: tour.flex_main_folder_id,
      name: 'Estructura',
      description: `Estructura folder for ${tour.name}`,
    }, authToken);
    elementId = created.id;
    const { error: updateError } = await supabase
      .from('tours')
      .update({ flex_estructura_folder_id: elementId })
      .eq('id', tour.id);
    if (updateError) throw updateError;
    tour.flex_estructura_folder_id = elementId;
  }

  const { data: tracked, error: trackedError } = await supabase
    .from('flex_folders')
    .select('id')
    .eq('element_id', elementId)
    .limit(1);
  if (trackedError) throw trackedError;
  if (!tracked?.length) {
    const { error: insertError } = await supabase.from('flex_folders').insert({
      job_id: null,
      parent_id: tour.flex_main_folder_id,
      element_id: elementId,
      department: ESTRUCTURA_DEPARTMENT,
      folder_type: 'tour_department',
    });
    if (insertError) throw insertError;
  }

  return elementId;
}

async function ensureTourDateEstructura(
  supabase: AppSupabaseClient,
  tour: TourFlexRecord,
  tourDate: TourDateRecord,
  linkedJob: LinkedTourDateJob | undefined,
  authToken: string,
): Promise<void> {
  const parentElementId = await ensureTrackedTourEstructuraRoot(supabase, tour, authToken);
  const { data: existingRows, error: existingError } = await supabase
    .from('flex_folders')
    .select('id, element_id, folder_type, source_department, job_id')
    .eq('tour_date_id', tourDate.id)
    .eq('department', ESTRUCTURA_DEPARTMENT);
  if (existingError) throw existingError;

  const jobId = linkedJob?.id ?? null;
  const dateValue = String(linkedJob?.start_time || tourDate.date);
  const endValue = String(linkedJob?.end_time || `${String(tourDate.date).slice(0, 10)}T23:59:59Z`);
  const dateLabel = new Date(tourDate.date).toISOString().split('T')[0];
  const documentNumber = tourDateDocumentNumber(dateValue);
  const trackedRows = (existingRows || []) as EstructuraTrackedRow[];
  let dateFolder = trackedRows.find((row) => row.folder_type === 'tourdate');

  if (!dateFolder) {
    const created = await createTypedFlexElement({
      definitionId: FLEX_FOLDER_IDS.subFolder,
      parentElementId,
      open: true,
      locked: false,
      name: `${dateLabel} - ${tour.name} - Estructura`,
      plannedStartDate: flexDate(dateValue),
      plannedEndDate: flexDate(endValue),
      locationId: FLEX_FOLDER_IDS.location,
      departmentId: DEPARTMENT_IDS.estructura,
      documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES.estructura}`,
      personResponsibleId: FLEX_FOLDER_IDS.mainResponsible,
    }, authToken);
    const { data, error } = await supabase
      .from('flex_folders')
      .insert({
        tour_date_id: tourDate.id,
        job_id: jobId,
        parent_id: parentElementId,
        element_id: created.elementId,
        folder_type: 'tourdate',
        department: ESTRUCTURA_DEPARTMENT,
      })
      .select('id, element_id, folder_type, source_department, job_id')
      .single();
    if (error || !data) throw error || new Error('Unable to track Estructura tour-date folder');
    dateFolder = data;
  } else if (!dateFolder.job_id && jobId) {
    const { error } = await supabase.from('flex_folders').update({ job_id: jobId }).eq('id', dateFolder.id);
    if (error) throw error;
  }

  for (const sourceDepartment of ESTRUCTURA_SOURCE_DEPARTMENTS) {
    const existing = trackedRows.find(
      (row) => row.folder_type === 'pull_sheet' && row.source_department === sourceDepartment,
    );
    if (existing) {
      if (!existing.job_id && jobId) {
        const { error } = await supabase.from('flex_folders').update({ job_id: jobId }).eq('id', existing.id);
        if (error) throw error;
      }
      continue;
    }

    const config = ESTRUCTURA_PULL_SHEETS[sourceDepartment];
    const created = await createTypedFlexElement({
      definitionId: FLEX_FOLDER_IDS.pullSheet,
      parentElementId: dateFolder.element_id,
      open: true,
      locked: false,
      name: `${linkedJob?.title || `${dateLabel} - ${tour.name}`} - ${config.nameSuffix}`,
      plannedStartDate: flexDate(dateValue),
      plannedEndDate: flexDate(endValue),
      locationId: FLEX_FOLDER_IDS.location,
      departmentId: DEPARTMENT_IDS.estructura,
      documentNumber: `${documentNumber}${config.documentSuffix}`,
      personResponsibleId: RESPONSIBLE_PERSON_IDS[sourceDepartment],
    }, authToken);
    const { error } = await supabase.from('flex_folders').insert({
      tour_date_id: tourDate.id,
      job_id: jobId,
      parent_id: dateFolder.id,
      element_id: created.elementId,
      folder_type: 'pull_sheet',
      department: ESTRUCTURA_DEPARTMENT,
      source_department: sourceDepartment,
    });
    if (error) throw error;
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
    const caller = await requireAdminOrManagement(supabase, req, {
      logContext: 'create-flex-folders',
    })
    const actorId = caller.userId
    const actorName = await resolveActorName(supabase, actorId)
    const activityEvents: Array<{ payload: Record<string, unknown>; visibility?: 'management' | 'job_participants' | 'house_plus_job' | 'actor_only' }> = []

    // Get tour information
    const { data: tour, error: tourError } = await supabase
      .from('tours')
      .select('*')
      .eq('id', tourId)
      .single()

    if (tourError) throw tourError

    const result = { success: true, data: tour }

    // Create root folders if requested
    if (createRootFolders && tour.flex_folders_created && tour.flex_main_folder_id) {
      // Idempotency guard: a re-run (double click, client retry) must not
      // create a duplicate folder tree in Flex.
      console.log("Root folders already exist for tour, skipping creation:", tour.name)
      await ensureTrackedTourEstructuraRoot(supabase, tour, authToken)
    } else if (createRootFolders) {
      console.log("Creating root folders for tour:", tour.name)

      // Get selected departments for this tour
      const selectedDepartments = await getTourDepartments(supabase, tourId);
      console.log("Selected departments for root folder creation:", selectedDepartments);
      
      // Create main tour folder
      const mainFolder = await createFlexFolder({
        name: tour.name,
        description: `Tour folder for ${tour.name}`
      }, authToken)

      // Create department folders (conditional for technical departments)
      const allDepartments = ['sound', 'lights', 'video', 'production', 'personnel', 'comercial']
      const folderIds: Record<string, string> = { main: mainFolder.id }

      for (const dept of allDepartments) {
        // Check if this department should have a folder created
        if (!shouldCreateDepartmentFolder(dept, selectedDepartments)) {
          console.log(`Skipping ${dept} folder - department not selected`);
          continue;
        }

        const deptFolder = await createFlexFolder({
          parent_id: mainFolder.id,
          name: dept.charAt(0).toUpperCase() + dept.slice(1),
          description: `${dept} folder for ${tour.name}`
        }, authToken)
        folderIds[dept] = deptFolder.id
      }

      const estructuraFolder = await createFlexFolder({
        parent_id: mainFolder.id,
        name: 'Estructura',
        description: `Estructura folder for ${tour.name}`,
      }, authToken)
      folderIds.estructura = estructuraFolder.id

      // Update tour with folder IDs (only for created folders)
      const updateData: any = {
        flex_folders_created: true,
        flex_main_folder_id: folderIds.main,
      }

      // Only set folder IDs for departments that were actually created
      if (folderIds.sound) updateData.flex_sound_folder_id = folderIds.sound
      if (folderIds.lights) updateData.flex_lights_folder_id = folderIds.lights
      if (folderIds.video) updateData.flex_video_folder_id = folderIds.video
      if (folderIds.production) updateData.flex_production_folder_id = folderIds.production
      if (folderIds.personnel) updateData.flex_personnel_folder_id = folderIds.personnel
      if (folderIds.comercial) updateData.flex_comercial_folder_id = folderIds.comercial
      updateData.flex_estructura_folder_id = folderIds.estructura

      const { error: updateError } = await supabase
        .from('tours')
        .update(updateData)
        .eq('id', tourId)

      if (updateError) throw updateError

      const { error: estructuraTrackingError } = await supabase.from('flex_folders').insert({
        job_id: null,
        parent_id: folderIds.main,
        element_id: folderIds.estructura,
        department: ESTRUCTURA_DEPARTMENT,
        folder_type: 'tour_department',
      })
      if (estructuraTrackingError) throw estructuraTrackingError

      Object.assign(tour, updateData)

      result.data = { ...tour, ...folderIds, flex_folders_created: true }

      activityEvents.push({
        payload: {
          folder: tour.name,
          scope: 'root',
          tour_id: tourId,
          departments: Object.keys(folderIds).filter((key) => key !== 'main'),
        },
        visibility: 'management',
      })
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

      // Get selected departments for date folder creation
      const selectedDepartments = await getTourDepartments(supabase, tourId);
      console.log("Selected departments for date folder creation:", selectedDepartments);

      const { data: linkedJobs, error: linkedJobsError } = await supabase
        .from('jobs')
        .select('id, tour_date_id, title, start_time, end_time')
        .eq('tour_id', tourId);
      if (linkedJobsError) throw linkedJobsError;
      const typedLinkedJobs = (linkedJobs || []) as LinkedTourDateJob[];
      const jobsByTourDate = new Map<string, LinkedTourDateJob>(
        typedLinkedJobs
          .filter((job): job is LinkedTourDateJob & { tour_date_id: string } => Boolean(job.tour_date_id))
          .map((job) => [job.tour_date_id, job]),
      );

      // Idempotency guard: skip dates that already have a Flex folder so a
      // re-run only fills in the missing ones. A failed read must abort —
      // treating it as "no folders" would recreate the whole tree in Flex.
      const { data: existingDateFolders, error: existingDateFoldersError } = await supabase
        .from('flex_folders')
        .select('tour_date_id')
        .eq('folder_type', 'tour_date')
        .in('tour_date_id', tourDates.map((td: any) => td.id))
      if (existingDateFoldersError) throw existingDateFoldersError
      const datesWithFolders = new Set(
        (existingDateFolders || []).map((row: any) => row.tour_date_id).filter(Boolean)
      )

      // Create folders for each tour date
      let createdDateCount = 0
      for (const tourDate of tourDates) {
        await ensureTourDateEstructura(
          supabase,
          tour,
          tourDate,
          jobsByTourDate.get(tourDate.id),
          authToken,
        )
        if (datesWithFolders.has(tourDate.id)) {
          console.log("Date folder already exists, skipping:", tourDate.date)
          continue
        }
        const dateStr = new Date(tourDate.date).toISOString().split('T')[0]
        const dateFolderName = `${dateStr} - ${tour.name}`
        
        // Create date folder under main tour folder
        const dateFolder = await createFlexFolder({
          parent_id: tour.flex_main_folder_id,
          name: dateFolderName,
          description: `Date folder for ${tour.name} on ${dateStr}`
        }, authToken)

        // Create department subfolders for this date (only for selected departments)
        const allDepartments = ['sound', 'lights', 'video', 'production', 'personnel', 'comercial']
        for (const dept of allDepartments) {
          // Check if this department should have a folder created
          if (!shouldCreateDepartmentFolder(dept, selectedDepartments)) {
            console.log(`Skipping ${dept} date folder - department not selected`);
            continue;
          }

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

        createdDateCount += 1
      }

      activityEvents.push({
        payload: {
          folder: tour.name,
          scope: 'dates',
          tour_id: tourId,
          dates_created: createdDateCount,
        },
        visibility: 'management',
      })

      // Fire push broadcast explicitly for tourdate folder creation
      try {
        const pushUrl = `${supabaseUrl}/functions/v1/push`;
        await fetch(pushUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            action: 'broadcast',
            type: 'flex.tourdate_folder.created',
            url: `/tours/${tourId}`,
            tour_id: tourId,
            tour_name: tour.name,
            dates_count: createdDateCount,
            actor_name: actorName || undefined,
          })
        }).catch(() => undefined);
      } catch (_err) {
        // non-blocking
      }
    }

    if (activityEvents.length) {
      try {
        await Promise.all(
          activityEvents.map((event) => {
            const code = (event.payload as any)?.scope === 'dates'
              ? 'flex.tourdate_folder.created'
              : 'flex.folders.created';
            return supabase.rpc('log_activity_as', {
              _actor_id: actorId,
              _code: code,
              _job_id: null,
              _entity_type: 'flex',
              _entity_id: tourId,
              _payload: event.payload,
              _visibility: event.visibility ?? 'management',
            })
          })
        )
      } catch (activityError) {
        console.warn('[create-flex-folders] Failed to log activity event', activityError)
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
    const status = typeof error?.status === 'number' ? error.status : 400
    const message = status >= 500 ? 'Internal server error' : error.message
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status,
      },
    )
  }
})
