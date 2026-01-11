import { createClient } from "./deps.ts";
import { EVENT_TYPES } from "./config.ts";
import { jsonResponse } from "./http.ts";
import { sendNativePushNotification } from "./apns.ts";
import { sendPushNotification } from "./webpush.ts";
import type { CheckScheduledBody, NativePushTokenRow, PushPayload } from "./types.ts";

const loadNativeTokens = async (
  client: ReturnType<typeof createClient>,
  userIds: string[],
): Promise<NativePushTokenRow[]> => {
  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("push_device_tokens")
    .select("user_id, device_token, platform")
    .in("user_id", userIds)
    .returns<NativePushTokenRow[]>();

  if (error) {
    console.error("scheduled push fetch native tokens error", error);
    return [];
  }

  return data ?? [];
};

// ============================================================================
// DAILY MORNING SUMMARY HELPERS
// ============================================================================

type MorningSummaryData = {
  assignments: Array<{
    technician_id: string;
    job: {
      title: string;
      start_time: string;
    };
    profile: {
      first_name: string;
      last_name: string;
      nickname: string | null;
    };
  }>;
  unavailable: Array<{
    user_id: string;
    source: string;
    profile: {
      first_name: string;
      last_name: string;
      nickname: string | null;
    };
  }>;
  allTechs: Array<{
    id: string;
    first_name: string;
    last_name: string;
    nickname: string | null;
  }>;
};

async function getMorningSummaryDataForDepartment(
  client: ReturnType<typeof createClient>,
  department: string,
  targetDate: string, // YYYY-MM-DD
): Promise<MorningSummaryData> {
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);
  const tomorrowDate = nextDate.toISOString().split('T')[0];

  // 1) Get today's assignments for this department (house tech only)
  const { data: assignments = [] } = await client
    .from('job_assignments')
    .select(`
      technician_id,
      job:jobs!inner(title, start_time),
      profile:profiles!job_assignments_technician_id_fkey!inner(first_name, last_name, nickname, department, role)
    `)
    .eq('status', 'confirmed')
    .eq('profile.department', department)
    .eq('profile.role', 'house_tech')
    .gte('job.start_time', targetDate)
    .lt('job.start_time', tomorrowDate);

  // 2) Get today's unavailability for this department (primary source)
  const { data: unavailable = [] } = await client
    .from('availability_schedules')
    .select(`
      user_id,
      source,
      profile:profiles!availability_schedules_user_id_fkey!inner(first_name, last_name, nickname, department, role)
    `)
    .eq('date', targetDate)
    .eq('status', 'unavailable')
    .eq('profile.department', department);
  const unavailableHouseOnly = (unavailable as any[]).filter(u => (u as any)?.profile?.role === 'house_tech');

  // 3) Get all house techs in department (population)
  const { data: allTechs = [] } = await client
    .from('profiles')
    .select('id, first_name, last_name, nickname')
    .eq('department', department)
    .eq('role', 'house_tech');

  // 4) Legacy fallback: include legacy table marks (technician_availability)
  // Some environments still record travel/sick/day_off/vacation here.
  // We treat these as 'unavailable' for the day if they aren't already present.
  try {
    const techIds = (allTechs as any[]).map(t => t.id);
    if (techIds.length) {
      const { data: legacyRows, error: legacyErr } = await client
        .from('technician_availability')
        .select('technician_id, date, status')
        .in('technician_id', techIds)
        .eq('date', targetDate)
        .in('status', ['vacation', 'travel', 'sick', 'day_off']);
      if (!legacyErr && legacyRows && legacyRows.length) {
        const existing = new Set<string>((unavailableHouseOnly as any[]).map(u => (u as any).user_id));
        for (const row of legacyRows as any[]) {
          if (!existing.has(row.technician_id)) {
            const prof = (allTechs as any[]).find(t => t.id === row.technician_id);
            if (prof) {
              (unavailableHouseOnly as any[]).push({
                user_id: row.technician_id,
                source: row.status,
                profile: {
                  first_name: prof.first_name,
                  last_name: prof.last_name,
                  nickname: prof.nickname,
                },
              });
              existing.add(row.technician_id);
            }
          }
        }
      }
    }
  } catch (e: any) {
    // Ignore if legacy table missing
    if (!(e && e.code === '42P01')) {
      // Log non-table-missing errors for visibility
      console.log('morning summary legacy availability lookup warning:', e?.message || e);
    }
  }

  return {
    assignments: assignments as any,
    unavailable: unavailableHouseOnly as any,
    allTechs: allTechs as any,
  };
}

function formatMorningSummary(
  department: string,
  data: MorningSummaryData,
  targetDate: string,
): { title: string; body: string } {
  // Format date in Spanish
  const dateObj = new Date(targetDate + 'T00:00:00Z');
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dayName = dayNames[dateObj.getUTCDay()];
  const dayNum = dateObj.getUTCDate();
  const monthName = monthNames[dateObj.getUTCMonth()];
  const formattedDate = `${dayName} ${dayNum} de ${monthName}`;

  // Department names in Spanish (capitalize)
  const deptMap: Record<string, string> = {
    sound: 'Sonido',
    lights: 'Iluminación',
    video: 'Vídeo',
    logistics: 'Logística',
    production: 'Producción',
  };
  const deptName = deptMap[department] || department.toUpperCase();

  let message = `📅 Resumen ${deptName} - ${formattedDate}\n\n`;

  // Group assignments by job
  const jobGroups: Record<string, typeof data.assignments> = {};
  for (const assignment of data.assignments) {
    const jobTitle = assignment.job.title;
    if (!jobGroups[jobTitle]) {
      jobGroups[jobTitle] = [];
    }
    jobGroups[jobTitle].push(assignment);
  }

  // Format jobs section
  if (Object.keys(jobGroups).length > 0) {
    message += `🎤 EN TRABAJOS:\n`;
    for (const [jobTitle, assignments] of Object.entries(jobGroups)) {
      const techNames = assignments
        .map(a => a.profile.nickname || a.profile.first_name)
        .join(', ');
      message += `  • ${jobTitle}: ${techNames}\n`;
    }
    message += '\n';
  }

  // Calculate warehouse techs (available, not on jobs, not unavailable)
  const assignedTechIds = new Set(data.assignments.map(a => a.technician_id));
  const unavailableTechIds = new Set(data.unavailable.map(a => a.user_id));
  const warehouseTechs = data.allTechs.filter(
    t => !assignedTechIds.has(t.id) && !unavailableTechIds.has(t.id)
  );

  if (warehouseTechs.length > 0) {
    const names = warehouseTechs
      .map(t => t.nickname || t.first_name)
      .join(', ');
    message += `🏢 EN ALMACÉN: ${names}\n\n`;
  }

  // Group unavailable by source
  const bySource: Record<string, typeof data.unavailable> = {};
  for (const avail of data.unavailable) {
    const source = avail.source || 'other';
    if (!bySource[source]) {
      bySource[source] = [];
    }
    bySource[source].push(avail);
  }

  // Vacation
  if (bySource.vacation?.length) {
    const names = bySource.vacation
      .map(a => a.profile.nickname || a.profile.first_name)
      .join(', ');
    message += `🏖️ DE VACACIONES: ${names}\n`;
  }

  // Travel
  if (bySource.travel?.length) {
    const names = bySource.travel
      .map(a => a.profile.nickname || a.profile.first_name)
      .join(', ');
    message += `✈️ DE VIAJE: ${names}\n`;
  }

  // Sick
  if (bySource.sick?.length) {
    const names = bySource.sick
      .map(a => a.profile.nickname || a.profile.first_name)
      .join(', ');
    message += `🤒 ENFERMOS: ${names}\n`;
  }

  // Day off
  if (bySource.day_off?.length) {
    const names = bySource.day_off
      .map(a => a.profile.nickname || a.profile.first_name)
      .join(', ');
    message += `📅 DÍA LIBRE: ${names}\n`;
  }

  // Warehouse (manual)
  if (bySource.warehouse?.length) {
    const names = bySource.warehouse
      .map(a => a.profile.nickname || a.profile.first_name)
      .join(', ');
    message += `🏢 MARCADOS EN ALMACÉN: ${names}\n`;
  }

  // Summary stats
  const totalTechs = data.allTechs.length;
  const availableCount = warehouseTechs.length;
  message += `\n📊 ${availableCount}/${totalTechs} técnicos disponibles`;

  return {
    title: `Resumen del día - ${deptName}`,
    body: message,
  };
}

function formatMultiDepartmentSummary(
  departments: string[],
  dataByDept: Map<string, MorningSummaryData>,
  targetDate: string,
): { title: string; body: string } {
  // Format date in Spanish
  const dateObj = new Date(targetDate + 'T00:00:00Z');
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dayName = dayNames[dateObj.getUTCDay()];
  const dayNum = dateObj.getUTCDate();
  const monthName = monthNames[dateObj.getUTCMonth()];
  const formattedDate = `${dayName} ${dayNum} de ${monthName}`;

  // Department names in Spanish
  const deptMap: Record<string, string> = {
    sound: 'Sonido',
    lights: 'Iluminación',
    video: 'Vídeo',
    logistics: 'Logística',
    production: 'Producción',
  };

  let fullMessage = `📅 Resumen del día - ${formattedDate}\n\n`;

  // Process each department
  for (let i = 0; i < departments.length; i++) {
    const department = departments[i];
    const data = dataByDept.get(department);

    if (!data) continue;

    const deptName = deptMap[department] || department.toUpperCase();
    fullMessage += `━━━ ${deptName.toUpperCase()} ━━━\n\n`;

    // Group assignments by job
    const jobGroups: Record<string, typeof data.assignments> = {};
    for (const assignment of data.assignments) {
      const jobTitle = assignment.job.title;
      if (!jobGroups[jobTitle]) {
        jobGroups[jobTitle] = [];
      }
      jobGroups[jobTitle].push(assignment);
    }

    // Format jobs section
    if (Object.keys(jobGroups).length > 0) {
      fullMessage += `🎤 EN TRABAJOS:\n`;
      for (const [jobTitle, assignments] of Object.entries(jobGroups)) {
        const techNames = assignments
          .map(a => a.profile.nickname || a.profile.first_name)
          .join(', ');
        fullMessage += `  • ${jobTitle}: ${techNames}\n`;
      }
      fullMessage += '\n';
    }

    // Calculate warehouse techs
    const assignedTechIds = new Set(data.assignments.map(a => a.technician_id));
    const unavailableTechIds = new Set(data.unavailable.map(a => a.user_id));
    const warehouseTechs = data.allTechs.filter(
      t => !assignedTechIds.has(t.id) && !unavailableTechIds.has(t.id)
    );

    if (warehouseTechs.length > 0) {
      const names = warehouseTechs
        .map(t => t.nickname || t.first_name)
        .join(', ');
      fullMessage += `🏢 EN ALMACÉN: ${names}\n\n`;
    }

    // Group unavailable by source
    const bySource: Record<string, typeof data.unavailable> = {};
    for (const avail of data.unavailable) {
      const source = avail.source || 'other';
      if (!bySource[source]) {
        bySource[source] = [];
      }
      bySource[source].push(avail);
    }

    // Format unavailability
    let hasUnavailable = false;
    if (bySource.vacation?.length) {
      const names = bySource.vacation.map(a => a.profile.nickname || a.profile.first_name).join(', ');
      fullMessage += `🏖️ DE VACACIONES: ${names}\n`;
      hasUnavailable = true;
    }
    if (bySource.travel?.length) {
      const names = bySource.travel.map(a => a.profile.nickname || a.profile.first_name).join(', ');
      fullMessage += `✈️ DE VIAJE: ${names}\n`;
      hasUnavailable = true;
    }
    if (bySource.sick?.length) {
      const names = bySource.sick.map(a => a.profile.nickname || a.profile.first_name).join(', ');
      fullMessage += `🤒 ENFERMOS: ${names}\n`;
      hasUnavailable = true;
    }
    if (bySource.day_off?.length) {
      const names = bySource.day_off.map(a => a.profile.nickname || a.profile.first_name).join(', ');
      fullMessage += `📅 DÍA LIBRE: ${names}\n`;
      hasUnavailable = true;
    }
    if (bySource.warehouse?.length) {
      const names = bySource.warehouse.map(a => a.profile.nickname || a.profile.first_name).join(', ');
      fullMessage += `🏢 MARCADOS EN ALMACÉN: ${names}\n`;
      hasUnavailable = true;
    }

    // Summary stats
    const totalTechs = data.allTechs.length;
    const availableCount = warehouseTechs.length;
    fullMessage += `\n📊 ${availableCount}/${totalTechs} técnicos disponibles\n`;

    // Add separator between departments (except last one)
    if (i < departments.length - 1) {
      fullMessage += '\n';
    }
  }

  const deptNames = departments.map(d => deptMap[d] || d).join(', ');
  return {
    title: `Resumen del día - ${deptNames}`,
    body: fullMessage,
  };
}

async function checkAndGetScheduleConfig(
  client: ReturnType<typeof createClient>,
  eventType: string,
  force: boolean = false,
): Promise<{ shouldSend: boolean; config: any | null }> {
  // Get schedule configuration
  const { data: config, error } = await client
    .from('push_notification_schedules')
    .select('*')
    .eq('event_type', eventType)
    .maybeSingle();

  if (error || !config) {
    console.log('❌ No schedule config found for:', eventType);
    return { shouldSend: false, config: null };
  }

  if (!config.enabled) {
    console.log('⏸️ Schedule is disabled for:', eventType);
    return { shouldSend: false, config };
  }

  // If force flag is set (for testing), skip time check
  if (force) {
    console.log('⚡ Force flag set, skipping time check');
    return { shouldSend: true, config };
  }

  // Get current time in configured timezone
  const timezone = config.timezone || 'Europe/Madrid';
  const now = new Date();

  // Convert to target timezone using Intl API
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(now);
  const hourPart = parts.find(p => p.type === 'hour');
  const minutePart = parts.find(p => p.type === 'minute');
  const weekdayPart = parts.find(p => p.type === 'weekday');

  const currentHour = parseInt(hourPart?.value || '0');
  const currentMinute = parseInt(minutePart?.value || '0');
  const currentWeekday = weekdayPart?.value;

  // Map weekday to number (1=Monday, 7=Sunday)
  const weekdayMap: Record<string, number> = {
    'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7
  };
  const currentDayNum = weekdayMap[currentWeekday || ''] || 1;

  // Parse schedule time (HH:MM:SS)
  const [scheduleHour, scheduleMinute] = config.schedule_time.split(':').map((s: string) => parseInt(s));

  // Check if current day is in allowed days
  const daysOfWeek = config.days_of_week || [1, 2, 3, 4, 5];
  if (!daysOfWeek.includes(currentDayNum)) {
    console.log(`📅 Not scheduled for this day: ${currentWeekday} (${currentDayNum}), allowed: ${daysOfWeek}`);
    return { shouldSend: false, config };
  }

  // Check if current hour matches schedule hour
  if (currentHour !== scheduleHour) {
    console.log(`⏰ Not scheduled time: ${currentHour}:${currentMinute}, scheduled: ${scheduleHour}:${scheduleMinute}`);
    return { shouldSend: false, config };
  }

  // Check if already sent this hour (to avoid duplicate sends)
  if (config.last_sent_at) {
    const lastSent = new Date(config.last_sent_at);
    const lastSentFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    });

    const lastSentParts = lastSentFormatter.formatToParts(lastSent);
    const lastSentYear = lastSentParts.find(p => p.type === 'year')?.value;
    const lastSentMonth = lastSentParts.find(p => p.type === 'month')?.value;
    const lastSentDay = lastSentParts.find(p => p.type === 'day')?.value;
    const lastSentHour = parseInt(lastSentParts.find(p => p.type === 'hour')?.value || '0');

    const nowParts = formatter.formatToParts(now);
    const nowFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const nowDateParts = nowFormatter.formatToParts(now);
    const nowYear = nowDateParts.find(p => p.type === 'year')?.value;
    const nowMonth = nowDateParts.find(p => p.type === 'month')?.value;
    const nowDay = nowDateParts.find(p => p.type === 'day')?.value;

    if (lastSentYear === nowYear && lastSentMonth === nowMonth && lastSentDay === nowDay && lastSentHour === currentHour) {
      console.log(`✅ Already sent this hour: ${config.last_sent_at}`);
      return { shouldSend: false, config };
    }
  }

  console.log(`✅ Time check passed! Sending at ${currentHour}:${currentMinute} on ${currentWeekday}`);
  return { shouldSend: true, config };
}

export async function handleCheckScheduled(
  client: ReturnType<typeof createClient>,
  body: CheckScheduledBody,
) {
  const type = body.type;
  console.log(`🔍 Checking scheduled notification: ${type}`);

  // Check if it's time to send
  const { shouldSend, config } = await checkAndGetScheduleConfig(client, type, body.force);

  if (!shouldSend) {
    return jsonResponse({ status: 'skipped', reason: 'Not scheduled time or already sent' });
  }

  console.log(`✅ Proceeding to send scheduled notification: ${type}`);

  // Get current date in configured timezone
  const timezone = config.timezone || 'Europe/Madrid';
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dateFormatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const targetDate = `${year}-${month}-${day}`;

  // For daily morning summary, use granular user subscriptions
  if (type === EVENT_TYPES.DAILY_MORNING_SUMMARY) {
    // Query user subscriptions
    const { data: subscriptions, error: subsError } = await client
      .from('morning_summary_subscriptions')
      .select('user_id, subscribed_departments')
      .eq('enabled', true);

    if (subsError) {
      console.error('❌ Failed to load subscriptions:', subsError);
      return jsonResponse({ error: 'Failed to load user subscriptions' }, 500);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('⚠️ No users subscribed to morning summary');
      return jsonResponse({ status: 'skipped', reason: 'No users subscribed' });
    }

    console.log(`📨 Found ${subscriptions.length} subscribed users`);

    // Cache department data to avoid redundant queries
    const departmentDataCache = new Map<string, MorningSummaryData>();

    // Process each user
    const allResults: Array<{ endpoint: string; ok: boolean; status?: number; skipped?: boolean; user_id: string }> = [];
    let successfulUsers = 0;

    for (const subscription of subscriptions) {
      const userId = subscription.user_id;
      const departments = subscription.subscribed_departments as string[];

      if (!departments || departments.length === 0) {
        console.log(`⚠️ User ${userId} has no departments subscribed`);
        continue;
      }

      console.log(`\n👤 Processing user ${userId}: departments [${departments.join(', ')}]`);

      // Fetch data for each department (use cache if available)
      const dataByDept = new Map<string, MorningSummaryData>();
      for (const dept of departments) {
        if (!departmentDataCache.has(dept)) {
          console.log(`  📊 Fetching data for ${dept}...`);
          const data = await getMorningSummaryDataForDepartment(client, dept, targetDate);
          departmentDataCache.set(dept, data);
        }
        dataByDept.set(dept, departmentDataCache.get(dept)!);
      }

      // Format message (multi-department or single)
      let title: string;
      let text: string;
      if (departments.length === 1) {
        const formatted = formatMorningSummary(departments[0], dataByDept.get(departments[0])!, targetDate);
        title = formatted.title;
        text = formatted.body;
      } else {
        const formatted = formatMultiDepartmentSummary(departments, dataByDept, targetDate);
        title = formatted.title;
        text = formatted.body;
      }

      console.log(`  📝 Message: ${title}`);

      // Load push subscriptions for this user
      const { data: pushSubs, error: pushSubsErr } = await client
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', userId);

      if (pushSubsErr) {
        console.error(`  ❌ Failed to load push subscriptions for user ${userId}:`, pushSubsErr);
        continue;
      }

      const nativeTokens = await loadNativeTokens(client, [userId]);
      if ((!pushSubs || pushSubs.length === 0) && nativeTokens.length === 0) {
        console.log(`  ⚠️ User ${userId} has no push subscriptions`);
        continue;
      }

      // Build URL with query parameters for in-app viewing
      const deptParam = departments.join(',');
      const summaryUrl = `/morning-summary?date=${targetDate}&departments=${deptParam}`;

      const payload: PushPayload = {
        title,
        body: text,
        url: summaryUrl,
        type,
        meta: {
          departments,
          targetDate,
        },
      };

      // Send to all devices for this user
      let userSent = false;
      const sendPromises: Promise<void>[] = [];
      for (const pushSub of pushSubs || []) {
        sendPromises.push((async () => {
          const result = await sendPushNotification(
            client,
            { endpoint: pushSub.endpoint, p256dh: pushSub.p256dh, auth: pushSub.auth },
            payload
          );
          allResults.push({
            endpoint: pushSub.endpoint,
            ok: result.ok,
            status: 'status' in result ? (result as any).status : undefined,
            skipped: 'skipped' in result ? (result as any).skipped : undefined,
            user_id: userId,
          });
          if (result.ok) userSent = true;
        })());
      }

      for (const tokenRow of nativeTokens) {
        sendPromises.push((async () => {
          const result = await sendNativePushNotification(client, tokenRow.device_token, payload);
          allResults.push({
            endpoint: `apns:${tokenRow.device_token}`,
            ok: result.ok,
            status: 'status' in result ? (result as any).status : undefined,
            skipped: 'skipped' in result ? (result as any).skipped : undefined,
            user_id: userId,
          });
          if (result.ok) userSent = true;
        })());
      }

      await Promise.all(sendPromises);

      if (userSent) {
        successfulUsers++;
        console.log(`  ✅ Sent to ${(pushSubs?.length || 0) + nativeTokens.length} device(s) for user ${userId}`);
      }
    }

    // Update last_sent_at timestamp
    await client
      .from('push_notification_schedules')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('event_type', type);

    console.log(`\n✅ Summary: Sent to ${successfulUsers}/${subscriptions.length} users, ${allResults.length} total notifications`);

    return jsonResponse({
      status: 'sent',
      results: allResults,
      count: allResults.length,
      users: successfulUsers,
    });
  }

  // For other scheduled notification types (future expansion)
  return jsonResponse({ status: 'error', reason: 'Unsupported scheduled notification type' }, 400);
}
