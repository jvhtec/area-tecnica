import { supabase } from "@/lib/supabase";
import {
  exportShiftsTablePDF,
  type ShiftsTablePdfData,
} from "@/utils/shiftsTablePdfExport";
import { attachShiftAssignmentsAndProfiles } from "@/utils/pdf/festivalPdfSectionBuilders";
import {
  isNonEmptyBlob,
  runWithConcurrency,
  type FestivalPdfProgress,
} from "@/utils/pdf/festivalPdfSupport";
import type { PrintOptions } from "@/components/festival/pdf/PrintOptionsDialog";

type Options = {
  jobId: string;
  jobTitle: string;
  logoUrl: string | null;
  options: PrintOptions;
  pdfConcurrency: number;
  reportProgress: (progress: FestivalPdfProgress) => void;
};

export const generateFestivalShiftPdfs = async ({
  jobId,
  jobTitle,
  logoUrl,
  options,
  pdfConcurrency,
  reportProgress,
}: Options): Promise<Blob[]> => {
  const shiftPdfs: Blob[] = [];
  if (options.includeShiftSchedules) {
    console.log("Starting shift table PDF generation");

    // Get all dates from job_date_types instead of only artist dates
    const { data: jobDates, error: jobDatesError } = await supabase
      .from("job_date_types")
      .select("date")
      .eq("job_id", jobId)
      .order("date");

    if (jobDatesError) {
      console.error("Error fetching job dates:", jobDatesError);
    } else {
      const allJobDates = [...new Set(jobDates?.map((d) => d.date) || [])];
      console.log("Processing shift schedules for all job dates:", allJobDates);
      const selectedJobDates = allJobDates.filter((date): date is string =>
        Boolean(date)
      );
      let completedShiftPdfs = 0;
      reportProgress({
        phase: "shift-schedules",
        completed: completedShiftPdfs,
        total: selectedJobDates.length,
        label: "Preparando horarios de turnos",
      });

      const generatedShiftPdfs = await runWithConcurrency(
        selectedJobDates,
        async (date) => {
          try {
            const { data: shiftsData, error: shiftsError } = await supabase
              .from("festival_shifts")
              .select(
                `
              id, job_id, name, date, start_time, end_time, department, stage
            `
              )
              .eq("job_id", jobId)
              .eq("date", date);

            if (shiftsError) {
              return null;
            }

            const filteredShifts = shiftsData?.filter(
              (shift) =>
                !shift.stage ||
                options.shiftScheduleStages.includes(Number(shift.stage))
            );

            if (filteredShifts && filteredShifts.length > 0) {
              try {
                console.log(
                  `Generating shifts PDF for date ${date} with ${filteredShifts.length} shifts`
                );
                const shiftIds = filteredShifts.map((shift) => shift.id);
                const { data: assignmentsData, error: assignmentsError } =
                  await supabase
                    .from("festival_shift_assignments")
                    .select(
                      "id, shift_id, technician_id, external_technician_name, role"
                    )
                    .in("shift_id", shiftIds);

                if (assignmentsError) {
                  console.error(
                    `Error fetching assignments for date ${date}:`,
                    assignmentsError
                  );
                  return null;
                }

                const technicianIds = Array.from(
                  new Set(
                    (assignmentsData || [])
                      .map((assignment) => assignment.technician_id)
                      .filter((technicianId): technicianId is string =>
                        Boolean(technicianId)
                      )
                  )
                );

                let profilesById = new Map<
                  string,
                  {
                    id: string;
                    first_name: string | null;
                    last_name: string | null;
                    email: string | null;
                    department: string | null;
                    role: string | null;
                  }
                >();

                if (technicianIds.length > 0) {
                  const { data: profilesData, error: profilesError } =
                    await supabase
                      .from("profiles")
                      .select(
                        "id, first_name, last_name, email, department, role"
                      )
                      .in("id", technicianIds);

                  if (profilesError) {
                    console.error(
                      `Error fetching profiles for date ${date}:`,
                      profilesError
                    );
                  } else {
                    profilesById = new Map(
                      (profilesData || []).map((profile) => [
                        profile.id,
                        profile,
                      ])
                    );
                  }
                }

                const typedShifts = attachShiftAssignmentsAndProfiles(
                  filteredShifts,
                  assignmentsData || [],
                  profilesById
                );

                const shiftsTableData: ShiftsTablePdfData = {
                  jobTitle: jobTitle || "Festival",
                  date: date,
                  jobId: jobId,
                  shifts: typedShifts,
                  logoUrl,
                };

                console.log(
                  `Creating shifts table PDF with ${typedShifts.length} shifts and logoUrl: ${logoUrl}`
                );
                const shiftPdf = await exportShiftsTablePDF(shiftsTableData);

                console.log(
                  `Generated shifts PDF for date ${date}, size: ${shiftPdf.size} bytes, type: ${shiftPdf.type}`
                );
                if (shiftPdf && shiftPdf.size > 0) {
                  return shiftPdf;
                } else {
                  console.warn(
                    `Generated empty shifts PDF for date ${date}, skipping`
                  );
                }
              } catch (err) {
                console.error(
                  `Error generating shifts PDF for date ${date}:`,
                  err
                );
              }
            } else {
              console.log(
                `No shifts found for date ${date}, skipping shifts PDF generation`
              );
            }
            return null;
          } finally {
            completedShiftPdfs += 1;
            reportProgress({
              phase: "shift-schedules",
              completed: completedShiftPdfs,
              total: selectedJobDates.length,
              label: "Generando horarios de turnos",
            });
          }
        },
        pdfConcurrency
      );

      shiftPdfs.push(...generatedShiftPdfs.filter(isNonEmptyBlob));
    }
  }
  return shiftPdfs;
};
