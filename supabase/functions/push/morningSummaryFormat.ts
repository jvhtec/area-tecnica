import type { MorningSummaryData } from "./morningSummaryTypes.ts";

export function formatMorningSummary(
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

export function formatMultiDepartmentSummary(
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
