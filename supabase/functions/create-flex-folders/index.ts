import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { requireAuthenticatedRole } from "../_shared/auth.ts";
import { fetchWithRetry } from "../_shared/flexFetch.ts";
import {
  executeProvisioningPlan,
  FlexProvisioningDeterministicError,
  provisioningFailureStatus,
  type ProvisioningNode,
} from "../_shared/flex-folders/engine.ts";
import { buildJobPlan, makeJobStore, seedKnownJobElements } from "../_shared/flex-folders/jobPlan.ts";
import { makeProvisioningStore } from "../_shared/flex-folders/store.ts";
import {
  buildRootPlan,
  childDepartmentsForTour,
  documentNumberFor,
  flexDate,
  plannerOwnedTourSemanticKeys,
  ROOT_DEPARTMENTS,
  type TourRecord,
} from "../_shared/flex-folders/tourPlan.ts";
import { allowedRolesForProvisioningOperation, type FlexProvisioningOperation } from "../_shared/flex-folders/access.ts";
import { buildArtistSchedule } from "../_shared/flex-folders/artistSchedule.ts";
import { getErrorStatus, HttpError } from "../_shared/http.ts";
import {
  DEPARTMENT_IDS,
  DEPARTMENT_SUFFIXES,
  FLEX_FOLDER_IDS,
  RESPONSIBLE_PERSON_IDS,
} from "../../../src/utils/flex-folders/constants.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
const FLEX_API_BASE_URL = Deno.env.get("FLEX_API_BASE_URL") ||
  "https://sectorpro.flexrentalsolutions.com/f5/api";
interface LeaseRow {
  operation_id: string;
  lease_token: string | null;
  status: string;
  acquired: boolean;
}
const createFlexElement = async (payload: Record<string, unknown>, authToken: string) => {
  const response = await fetchWithRetry(`${FLEX_API_BASE_URL}/element`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": authToken,
      apikey: authToken,
      "X-Requested-With": "XMLHttpRequest",
      "X-API-Client": "flex5-desktop",
    },
    body: JSON.stringify(payload),
  }, { retryOnTimeout: false });
  if (!response.ok) {
    const message = `Flex returned HTTP ${response.status}`;
    if (response.status >= 400 && response.status < 500 && response.status !== 408) {
      throw new FlexProvisioningDeterministicError(message);
    }
    throw new Error(message);
  }
  return await response.json() as { elementId?: string };
};
const loadTourDepartments = async (supabase: SupabaseClient, tourId: string): Promise<Set<string>> => {
  const { data, error } = await supabase
    .from("jobs")
    .select("job_departments(department)")
    .eq("tour_id", tourId);
  if (error) throw error;
  const selected = new Set<string>();
  for (const job of data || []) {
    for (const row of job.job_departments || []) {
      if (typeof row.department === "string") selected.add(row.department);
    }
  }
  if (selected.size === 0) {
    throw new HttpError(409, "Persist at least one technical department before creating tour folders");
  }
  return selected;
};
const loadTourRange = async (supabase: SupabaseClient, tour: TourRecord) => {
  if (tour.start_date && tour.end_date) return { start: tour.start_date, end: tour.end_date };
  const { data, error } = await supabase
    .from("tour_dates")
    .select("date")
    .eq("tour_id", tour.id)
    .order("date", { ascending: true });
  if (error) throw error;
  if (!data?.length) throw new HttpError(400, "Tour has no dates");
  return { start: data[0].date, end: data[data.length - 1].date };
};

const loadTourPlannerOwnedSemanticKeys = async (
  supabase: SupabaseClient,
  tourId: string,
): Promise<Set<string>> => {
  const { data: operation, error: operationError } = await supabase
    .from("flex_provisioning_operations")
    .select("id")
    .eq("scope_key", `tour-root:${tourId}`)
    .maybeSingle();
  if (operationError) throw operationError;
  if (!operation) return new Set();
  const { data: nodes, error: nodeError } = await supabase
    .from("flex_provisioning_nodes")
    .select("semantic_key,payload")
    .eq("operation_id", operation.id);
  if (nodeError) throw nodeError;
  return plannerOwnedTourSemanticKeys(nodes || []);
};
const seedKnownTourElements = async (
  supabase: SupabaseClient,
  operationId: string,
  tour: TourRecord,
) => {
  const known: Array<[string, string | null]> = [
    ["root", tour.flex_main_folder_id],
    ...ROOT_DEPARTMENTS.map((department) => [`department:${department}`, tour[`flex_${department}_folder_id`]] as [string, string | null]),
    ["department:estructura", tour.flex_estructura_folder_id],
  ];
  for (const [semanticKey, elementId] of known) {
    if (!elementId) continue;
    const { error } = await supabase.from("flex_provisioning_nodes").upsert({
      operation_id: operationId,
      semantic_key: semanticKey,
      state: "needs_reconciliation",
      element_id: elementId,
      payload: { provisioningOrigin: "legacy-tour-column" },
    }, { onConflict: "operation_id,semantic_key", ignoreDuplicates: true });
    if (error) throw error;
  }
};

const makeStore = (supabase: SupabaseClient, operationId: string, tourId: string) =>
  makeProvisioningStore(supabase, operationId, async (node, elementId, parentTrackingId) => {
    const tracking = node.tracking as { folderType: string; department?: string; tourColumn?: string };
    const { data: existing, error: readError } = await supabase.from("flex_folders")
      .select("id").eq("element_id", elementId).maybeSingle();
    if (readError) throw readError;
    let trackingId = existing?.id as string | undefined;
    if (!trackingId) {
      const { data, error } = await supabase.from("flex_folders").insert({
        job_id: null,
        parent_id: parentTrackingId || null,
        element_id: elementId,
        department: tracking.department || null,
        folder_type: tracking.folderType,
      }).select("id").single();
      if (error) throw error;
      trackingId = data.id;
    }
    if (tracking.tourColumn) {
      const { error } = await supabase.from("tours").update({ [tracking.tourColumn]: elementId }).eq("id", tourId);
      if (error) throw error;
    }
    return trackingId;
  });

const DRYHIRE_MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const buildDryhirePlan = (year: number): ProvisioningNode[] => {
  const nodes: ProvisioningNode[] = [];
  const yearSuffix = String(year).slice(-2);
  for (const department of ["sound", "lights"] as const) {
    const prefix = department === "sound" ? "666" : "555";
    const label = department === "sound" ? "Sonido" : "Luces";
    const rootDocument = `${prefix}.${yearSuffix}`;
    nodes.push({
      key: `department:${department}`,
      payload: {
        definitionId: FLEX_FOLDER_IDS.mainFolder,
        open: true,
        locked: false,
        name: `Dry Hire ${year} - ${label}`,
        plannedStartDate: `${year}-01-01T00:00:00.000Z`,
        plannedEndDate: `${year}-12-31T23:59:59.000Z`,
        locationId: FLEX_FOLDER_IDS.location,
        departmentId: DEPARTMENT_IDS[department],
        personResponsibleId: RESPONSIBLE_PERSON_IDS[department],
        documentNumber: rootDocument,
      },
      tracking: { kind: "root", year, department },
    });
    DRYHIRE_MONTHS.forEach((name, index) => {
      const month = String(index + 1).padStart(2, "0");
      const finalDay = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
      nodes.push({
        key: `department:${department}:month:${month}`,
        parentKey: `department:${department}`,
        payload: {
          definitionId: FLEX_FOLDER_IDS.subFolder,
          open: true,
          locked: false,
          name,
          plannedStartDate: `${year}-${month}-01T00:00:00.000Z`,
          plannedEndDate: `${year}-${month}-${String(finalDay).padStart(2, "0")}T23:59:59.000Z`,
          locationId: FLEX_FOLDER_IDS.location,
          departmentId: DEPARTMENT_IDS[department],
          personResponsibleId: RESPONSIBLE_PERSON_IDS[department],
          documentNumber: `${rootDocument}.${month}`,
        },
        tracking: { kind: "month", year, department, month },
      });
    });
  }
  return nodes;
};

const makeDryhireStore = (
  supabase: SupabaseClient,
  operationId: string,
) => makeProvisioningStore(supabase, operationId, async (node, elementId) => {
    const tracking = node.tracking as { kind: string; year: number; department: string; month?: string };
    if (tracking.kind === "root") return undefined;
    const { data: existing, error: readError } = await supabase.from("dryhire_parent_folders")
      .select("id,element_id").eq("year", tracking.year).eq("department", tracking.department)
      .eq("month", tracking.month).maybeSingle();
    if (readError) throw readError;
    if (existing?.id) {
      if (existing.element_id !== elementId) throw new Error(`Dry-hire month ${node.key} has a conflicting remote ID`);
      return existing.id;
    }
    const { data, error } = await supabase.from("dryhire_parent_folders").insert({
      year: tracking.year, department: tracking.department, month: tracking.month, element_id: elementId,
    }).select("id").single();
    if (error) throw error;
    return data.id;
  });

const provisionDryhireYear = async (
  supabase: SupabaseClient,
  year: number,
  flexToken: string,
  reconcile: boolean,
  requestedBy: string,
) => {
  const { data: leaseData, error: leaseError } = await supabase.rpc("acquire_flex_provisioning_lease", {
    p_scope_key: `dryhire-year:${year}`,
    p_operation_type: "dryhire-year",
    p_scope_id: String(year),
    p_lease_seconds: 600,
    p_reconcile: reconcile,
    p_requested_by: requestedBy,
  });
  if (leaseError) throw leaseError;
  const lease = (leaseData?.[0] || null) as LeaseRow | null;
  if (!lease?.acquired || !lease.lease_token) {
    return { success: lease?.status === "complete", status: lease?.status || "in_progress" };
  }
  try {
    const [{ data: legacyRows, error: legacyError }, { data: stateRows, error: stateError }] = await Promise.all([
      supabase.from("dryhire_parent_folders").select("id").eq("year", year).limit(1),
      supabase.from("flex_provisioning_nodes").select("id").eq("operation_id", lease.operation_id).limit(1),
    ]);
    if (legacyError || stateError) throw legacyError || stateError;
    if (legacyRows?.length && !stateRows?.length) {
      throw new Error("Legacy partial dry-hire year requires manual parent reconciliation");
    }
    const outcome = await executeProvisioningPlan(
      buildDryhirePlan(year),
      makeDryhireStore(supabase, lease.operation_id),
      (payload) => createFlexElement(payload, flexToken),
    );
    const { error } = await supabase.rpc("finish_flex_provisioning_lease", {
      p_operation_id: lease.operation_id, p_lease_token: lease.lease_token,
      p_status: "complete", p_last_error: null,
    });
    if (error) throw error;
    return { success: true, status: "complete", data: outcome };
  } catch (error) {
    await supabase.rpc("finish_flex_provisioning_lease", {
      p_operation_id: lease.operation_id, p_lease_token: lease.lease_token,
      p_status: provisioningFailureStatus(error), p_last_error: { code: "dryhire_year_interrupted" },
    }).then(() => undefined, () => undefined);
    throw error;
  }
};

const provisionArtistExtras = async (
  supabase: SupabaseClient,
  artistId: string,
  expectedJobId: string,
  dayStartTime: string,
  flexToken: string,
  reconcile: boolean,
  requestedBy: string,
) => {
  const { data: artist, error: artistError } = await supabase.from("festival_artists")
    .select("id,job_id,name,date,show_start,show_end,isaftermidnight").eq("id", artistId).single();
  if (artistError || !artist) throw new HttpError(404, "Artist not found");
  if (!artist.job_id || artist.job_id !== expectedJobId) throw new HttpError(403, "Artist does not belong to this job");
  if (!artist.date) throw new HttpError(400, "Artist has no festival date");
  const { data: job, error: jobError } = await supabase.from("jobs").select("id,title").eq("id", artist.job_id).single();
  if (jobError || !job) throw new HttpError(404, "Job not found");
  const { data: commercial, error: commercialError } = await supabase.from("flex_folders")
    .select("id,element_id").eq("job_id", artist.job_id).eq("folder_type", "department")
    .eq("department", "comercial").maybeSingle();
  if (commercialError) throw commercialError;
  if (!commercial) throw new HttpError(409, "Create the job Commercial folder first");
  const { data: existingExtras, error: extrasError } = await supabase.from("flex_folders")
    .select("id,element_id").eq("job_id", artist.job_id).eq("folder_type", "comercial_extras")
    .eq("department", "sound").maybeSingle();
  if (extrasError) throw extrasError;

  const { shortDate, schedule } = buildArtistSchedule({
    date: String(artist.date),
    show_start: artist.show_start,
    show_end: artist.show_end,
    isaftermidnight: artist.isaftermidnight,
  }, dayStartTime);
  const { count, error: countError } = await supabase.from("flex_folders")
    .select("id", { count: "exact", head: true }).eq("job_id", artist.job_id)
    .eq("folder_type", "comercial_presupuesto");
  if (countError) throw countError;

  const { data: leaseData, error: leaseError } = await supabase.rpc("acquire_flex_provisioning_lease", {
    p_scope_key: `festival-artist-extras:${artistId}`,
    p_operation_type: "festival-artist-extras",
    p_scope_id: artistId,
    p_lease_seconds: 180,
    p_reconcile: reconcile,
    p_requested_by: requestedBy,
  });
  if (leaseError) throw leaseError;
  const lease = (leaseData?.[0] || null) as LeaseRow | null;
  if (!lease?.acquired || !lease.lease_token) return { success: lease?.status === "complete", status: lease?.status };

  let remoteWritePossible = false;
  try {
    const { data: ordinal, error: ordinalError } = await supabase.rpc("allocate_flex_provisioning_sequence", {
      p_operation_id: lease.operation_id,
      p_sequence_group: `festival-artist-extras:${artist.job_id}`,
      p_minimum: (count || 0) + 1,
    });
    if (ordinalError) throw ordinalError;
    if (!Number.isInteger(ordinal) || ordinal < 1) throw new Error("Failed to allocate artist budget ordinal");
    const documentNumber = `${shortDate}.${ordinal}SQT`;
    if (existingExtras) {
      const { error } = await supabase.from("flex_provisioning_nodes").upsert({
        operation_id: lease.operation_id, semantic_key: "extras:sound", state: "persisted",
        element_id: existingExtras.element_id, tracking_row_id: existingExtras.id,
      }, { onConflict: "operation_id,semantic_key", ignoreDuplicates: true });
      if (error) throw error;
    }
    const plan: ProvisioningNode[] = [
      {
        key: "extras:sound",
        externalParentElementId: commercial.element_id,
        payload: {
          definitionId: FLEX_FOLDER_IDS.subFolder, open: true, locked: false,
          name: `Extras ${job.title?.trim() || "Sin título"} - Sonido`, ...schedule,
          locationId: FLEX_FOLDER_IDS.location, departmentId: DEPARTMENT_IDS.sound,
          documentNumber: `${shortDate}ESQT`, personResponsibleId: RESPONSIBLE_PERSON_IDS.sound,
        },
        tracking: { folderType: "comercial_extras" },
      },
      {
        key: `artist:${artistId}:budget`,
        parentKey: "extras:sound",
        payload: {
          definitionId: FLEX_FOLDER_IDS.presupuesto, open: true, locked: false,
          name: `${artist.name} - Extras`, ...schedule,
          locationId: FLEX_FOLDER_IDS.location, departmentId: DEPARTMENT_IDS.sound,
          documentNumber, personResponsibleId: RESPONSIBLE_PERSON_IDS.sound,
        },
        tracking: { folderType: "comercial_presupuesto" },
      },
    ];
    const store = makeProvisioningStore(supabase, lease.operation_id, async (node, elementId, parentTrackingId) => {
      if (node.key === "extras:sound" && existingExtras) return existingExtras.id;
      const { data: tracked, error: trackedError } = await supabase.from("flex_folders")
        .select("id").eq("element_id", elementId).maybeSingle();
      if (trackedError) throw trackedError;
      if (tracked?.id) return tracked.id;
      const { data, error } = await supabase.from("flex_folders").insert({
        job_id: artist.job_id,
        parent_id: node.key === "extras:sound" ? commercial.id : (parentTrackingId || existingExtras?.id || null),
        element_id: elementId, department: "sound", folder_type: node.tracking.folderType,
      }).select("id").single();
      if (error) throw error;
      return data.id;
    });
    const outcome = await executeProvisioningPlan(plan, store, (payload) => {
      remoteWritePossible = true;
      return createFlexElement(payload, flexToken);
    });
    const { error } = await supabase.rpc("finish_flex_provisioning_lease", {
      p_operation_id: lease.operation_id, p_lease_token: lease.lease_token, p_status: "complete", p_last_error: null,
    });
    if (error) throw error;
    return { success: true, status: "complete", documentNumber, data: outcome };
  } catch (error) {
    await supabase.rpc("finish_flex_provisioning_lease", {
      p_operation_id: lease.operation_id, p_lease_token: lease.lease_token,
      p_status: provisioningFailureStatus(error, remoteWritePossible), p_last_error: { code: "artist_extras_interrupted" },
    }).then(() => undefined, () => undefined);
    throw error;
  }
};

const provisionJob = async (
  supabase: SupabaseClient,
  jobId: string,
  options: Record<string, unknown> | undefined,
  flexToken: string,
  reconcile: boolean,
  requestedBy: string,
) => {
  const { data: job, error: jobError } = await supabase.from("jobs")
    .select("*,locations(name)").eq("id", jobId).single();
  if (jobError || !job) throw new HttpError(404, "Job not found");
  const { data: departmentRows, error: departmentError } = await supabase.from("job_departments")
    .select("department").eq("job_id", jobId);
  if (departmentError) throw departmentError;
  const selected = new Set<string>((departmentRows || []).map((row) => row.department).filter(Boolean));
  let tour: Record<string, unknown> | undefined;
  let isTourPackOnly = false;
  if (job.job_type === "tourdate") {
    if (!job.tour_id) throw new HttpError(409, "Tour date has no tour");
    const { data, error } = await supabase.from("tours").select("*").eq("id", job.tour_id).single();
    if (error || !data) throw new HttpError(404, "Tour not found");
    tour = data;
    if (job.tour_date_id) {
      const { data: tourDate, error: tourDateError } = await supabase.from("tour_dates")
        .select("is_tour_pack_only").eq("id", job.tour_date_id).single();
      if (tourDateError || !tourDate) throw new HttpError(404, "Tour date not found");
      isTourPackOnly = tourDate.is_tour_pack_only === true;
    }
  }
  const start = flexDate(job.start_time);
  const end = flexDate(job.end_time);
  const documentNumber = documentNumberFor(job.start_time);
  const operationType = job.job_type === "tourdate" ? "tour-date" : "job";
  let plan: ProvisioningNode[];
  if (job.job_type === "dryhire") {
    const timezone = typeof job.timezone === "string" && job.timezone ? job.timezone : "Europe/Madrid";
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    const wallClock = (value: string) => { const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value])); return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000Z`; };
    const dateParts = Object.fromEntries(formatter.formatToParts(new Date(job.start_time)).map((part) => [part.type, part.value]));
    const year = Number(dateParts.year);
    const month = String(dateParts.month);
    const department = selected.has("lights") && !selected.has("sound") ? "lights" : "sound";
    const { data: parent, error: parentError } = await supabase.from("dryhire_parent_folders").select("id,element_id").eq("year", year).eq("month", month).eq("department", department).single();
    if (parentError || !parent) throw new HttpError(409, "Create the dry-hire year/month folders first");
    const deptSuffix = DEPARTMENT_SUFFIXES[department];
    const common = { open: true, locked: false, plannedStartDate: wallClock(job.start_time), plannedEndDate: wallClock(job.end_time), locationId: FLEX_FOLDER_IDS.location, departmentId: DEPARTMENT_IDS[department], personResponsibleId: RESPONSIBLE_PERSON_IDS[department] };
    plan = [
      { key: "dryhire", externalParentElementId: parent.element_id, payload: { ...common, definitionId: FLEX_FOLDER_IDS.subFolder, name: `Dry Hire - ${job.title}`, documentNumber: `${String(dateParts.year).slice(-2)}${month}${dateParts.day}${deptSuffix}` }, tracking: { folderType: "dryhire", department, externalParentTrackingId: parent.id } },
      { key: "dryhire:budget", parentKey: "dryhire", payload: { ...common, definitionId: FLEX_FOLDER_IDS.presupuestoDryHire, name: `Presupuesto - ${job.title}`, documentNumber: `${String(dateParts.year).slice(-2)}${month}${dateParts.day}${deptSuffix}DH` }, tracking: { folderType: "dryhire_presupuesto", department } },
    ];
  } else {
    plan = buildJobPlan({ job, selected, options: options as never, start, end, documentNumber, tour, isTourPackOnly });
  }
  if (job.job_type === "tourdate" && plan.some((node) => node.externalParentElementId === "")) {
    throw new HttpError(409, "Create or reconcile the tour roots first");
  }
  const { data: leaseData, error: leaseError } = await supabase.rpc("acquire_flex_provisioning_lease", {
    p_scope_key: `${operationType}:${jobId}`, p_operation_type: operationType, p_scope_id: jobId,
    p_lease_seconds: 600, p_reconcile: reconcile,
    p_requested_by: requestedBy,
  });
  if (leaseError) throw leaseError;
  const lease = (leaseData?.[0] || null) as LeaseRow | null;
  if (!lease?.acquired || !lease.lease_token) return { success: lease?.status === "complete", status: lease?.status || "in_progress" };
  try {
    await seedKnownJobElements(supabase, lease.operation_id, job, plan);
    const outcome = await executeProvisioningPlan(plan, makeJobStore(supabase, lease.operation_id, job), (payload) => createFlexElement(payload, flexToken));
    const { error: flagError } = await supabase.from("jobs").update({ flex_folders_created: true }).eq("id", jobId);
    if (flagError) throw flagError;
    const { error: finishError } = await supabase.rpc("finish_flex_provisioning_lease", { p_operation_id: lease.operation_id, p_lease_token: lease.lease_token, p_status: "complete", p_last_error: null });
    if (finishError) throw finishError;
    return { success: true, status: "complete", data: outcome };
  } catch (error) {
    await supabase.rpc("finish_flex_provisioning_lease", { p_operation_id: lease.operation_id, p_lease_token: lease.lease_token, p_status: provisioningFailureStatus(error), p_last_error: { code: "job_provisioning_interrupted" } }).then(() => undefined, () => undefined);
    throw error;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let lease: LeaseRow | null = null;
  let supabase: SupabaseClient | null = null;
  try {
    const body = await req.json() as Record<string, unknown>;
    const tourId = typeof body.tourId === "string" ? body.tourId : "";
    const legacyRoot = body.createRootFolders === true && body.createDateFolders !== true;
    const operation = typeof body.operation === "string" ? body.operation : legacyRoot ? "tour-root" : "";
    if (operation !== "job" && operation !== "tour-date" && operation !== "tour-root" && operation !== "dryhire-year" && operation !== "festival-artist-extras") {
      throw new HttpError(409, "Update the app to create tour dates through the canonical job/date workflow");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const flexToken = Deno.env.get("X_AUTH_TOKEN");
    if (!supabaseUrl || !serviceRoleKey || !flexToken) throw new Error("Missing environment variables");
    supabase = createClient(supabaseUrl, serviceRoleKey);
    const caller = await requireAuthenticatedRole(supabase, req, {
      logContext: "create-flex-folders",
      allowedRoles: allowedRolesForProvisioningOperation(operation as FlexProvisioningOperation),
    });

    if (operation === "job" || operation === "tour-date") {
      const jobId = typeof body.jobId === "string" ? body.jobId : "";
      if (!jobId) throw new HttpError(400, "Job ID is required");
      const options = body.options && typeof body.options === "object" && !Array.isArray(body.options)
        ? body.options as Record<string, unknown>
        : body.options === undefined ? undefined : {};
      const result = await provisionJob(supabase, jobId, options, flexToken, body.reconcile === true, caller.userId);
      return new Response(JSON.stringify(result), { status: result.success ? 200 : 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (operation === "dryhire-year") {
      const year = Number(body.year);
      if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new HttpError(400, "Invalid dry-hire year");
      const dryhireResult = await provisionDryhireYear(supabase, year, flexToken, body.reconcile === true, caller.userId);
      return new Response(JSON.stringify(dryhireResult), {
        status: dryhireResult.success ? 200 : 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (operation === "festival-artist-extras") {
      const artistId = typeof body.artistId === "string" ? body.artistId : "";
      const jobId = typeof body.jobId === "string" ? body.jobId : "";
      const dayStartTime = typeof body.dayStartTime === "string" ? body.dayStartTime : "07:00";
      if (!artistId || !jobId) throw new HttpError(400, "Artist ID and job ID are required");
      const artistResult = await provisionArtistExtras(
        supabase, artistId, jobId, dayStartTime, flexToken, body.reconcile === true, caller.userId,
      );
      return new Response(JSON.stringify(artistResult), {
        status: artistResult.success ? 200 : 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tourId) throw new HttpError(400, "Tour ID is required");

    const { data: tourData, error: tourError } = await supabase.from("tours").select("*").eq("id", tourId).single();
    if (tourError || !tourData) throw new HttpError(404, "Tour not found");
    const tour = tourData as TourRecord;
    const [selected, range, plannerOwnedSemanticKeys] = await Promise.all([
      loadTourDepartments(supabase, tourId),
      loadTourRange(supabase, tour),
      loadTourPlannerOwnedSemanticKeys(supabase, tourId),
    ]);
    const childDepartments = childDepartmentsForTour(tour, selected, plannerOwnedSemanticKeys);
    const plan = buildRootPlan(tour, selected, range, childDepartments);

    const { data: leaseData, error: leaseError } = await supabase.rpc("acquire_flex_provisioning_lease", {
      p_scope_key: `tour-root:${tourId}`,
      p_operation_type: "tour-root",
      p_scope_id: tourId,
      p_lease_seconds: 300,
      p_reconcile: body.reconcile === true,
      p_requested_by: caller.userId,
    });
    if (leaseError) throw leaseError;
    lease = (leaseData?.[0] || null) as LeaseRow | null;
    if (!lease?.acquired || !lease.lease_token) {
      return new Response(JSON.stringify({ success: lease?.status === "complete", status: lease?.status || "in_progress" }), {
        status: lease?.status === "complete" ? 200 : 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await seedKnownTourElements(supabase, lease.operation_id, tour);
    const outcome = await executeProvisioningPlan(
      plan,
      makeStore(supabase, lease.operation_id, tourId),
      (payload) => createFlexElement(payload, flexToken),
    );

    const { error: tourUpdateError } = await supabase.from("tours").update({ flex_folders_created: true }).eq("id", tourId);
    if (tourUpdateError) throw tourUpdateError;
    const { error: finishError } = await supabase.rpc("finish_flex_provisioning_lease", {
      p_operation_id: lease.operation_id,
      p_lease_token: lease.lease_token,
      p_status: "complete",
      p_last_error: null,
    });
    if (finishError) throw finishError;

    if (outcome.created > 0) {
      await supabase.rpc("log_activity_as", {
        _actor_id: caller.userId,
        _code: "flex.folders.created",
        _job_id: null,
        _entity_type: "flex",
        _entity_id: tourId,
        _payload: { scope: "root", tour_id: tourId, nodes_created: outcome.created },
        _visibility: "management",
      }).then(() => undefined, () => undefined);
    }

    return new Response(JSON.stringify({ success: true, status: "complete", data: outcome }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (supabase && lease?.lease_token) {
      await supabase.rpc("finish_flex_provisioning_lease", {
        p_operation_id: lease.operation_id,
        p_lease_token: lease.lease_token,
        p_status: provisioningFailureStatus(error),
        p_last_error: { code: "provisioning_interrupted" },
      }).then(() => undefined, () => undefined);
    }
    const status = getErrorStatus(error, 500);
    const message = error instanceof HttpError && error.exposeDetails ? error.message : "Internal server error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
