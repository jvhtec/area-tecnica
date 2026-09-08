import { supabase } from "@/integrations/supabase/client";
import { useLocationManagement } from "@/hooks/useLocationManagement";
import type { Department } from "@/types/department";
import type { InvoicingCompany } from "@/types/job";
import { createTourRootFolders } from "@/utils/tourFolders";

interface TourCreationData {
  title: string;
  description: string;
  dates: { date: string; location: string }[];
  color: string;
  departments: Department[];
  startDate?: string;
  endDate?: string;
  invoicingCompany?: InvoicingCompany | null;
}

export const useTourCreationMutation = () => {
  const { getOrCreateLocation } = useLocationManagement();

  const createTourWithDates = async ({
    title,
    description,
    dates,
    color,
    departments,
    startDate,
    endDate,
    invoicingCompany,
  }: TourCreationData) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error("Authentication validation failed");
    if (!user?.id) throw new Error("Authentication required to create a tour");

    const validDates = dates.filter((date) => date.date).sort(
      (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
    );
    if (validDates.length === 0) throw new Error("At least one valid date is required");

    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .insert({
        name: title,
        description,
        start_date: startDate || validDates[0].date,
        end_date: endDate || validDates[validDates.length - 1].date,
        color,
        invoicing_company: invoicingCompany,
      })
      .select()
      .single();
    if (tourError) throw tourError;

    // Persist dates, jobs, and their department selection first. The server
    // provisioning operation loads this authoritative context and never turns
    // a missing/failed selection read into "all departments".
    for (const dateInfo of validDates) {
      let locationId: string | null = null;
      let locationName = "No Location";
      if (dateInfo.location) {
        locationId = await getOrCreateLocation(dateInfo.location);
        locationName = dateInfo.location;
      }

      const { data: tourDate, error: tourDateError } = await supabase
        .from("tour_dates")
        .insert({
          tour_id: tour.id,
          date: dateInfo.date,
          start_date: dateInfo.date,
          end_date: dateInfo.date,
          tour_date_type: "show",
          location_id: locationId,
        })
        .select("id,date")
        .single();
      if (tourDateError) throw tourDateError;

      const { data: dateJob, error: dateJobError } = await supabase
        .from("jobs")
        .insert({
          title: `${title} (${locationName})`,
          description,
          start_time: `${dateInfo.date}T00:00:00`,
          end_time: `${dateInfo.date}T23:59:59`,
          location_id: locationId,
          job_type: "tourdate",
          tour_date_id: tourDate.id,
          tour_id: tour.id,
          color,
          invoicing_company: invoicingCompany,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (dateJobError) throw dateJobError;

      if (departments.length > 0) {
        const { error: departmentError } = await supabase.from("job_departments").insert(
          departments.map((department) => ({ job_id: dateJob.id, department }))
        );
        if (departmentError) throw departmentError;
      }

      const { error: dateTypeError } = await supabase.from("job_date_types").insert({
        job_id: dateJob.id,
        date: dateInfo.date,
        type: "show",
      });
      if (dateTypeError) throw dateTypeError;
    }

    const provisioning = await createTourRootFolders(tour.id);
    if (!provisioning.success) {
      // Keep the domain records so repair retries attach to this same tour.
      throw new Error(provisioning.error || "No se pudieron crear las carpetas Flex de la gira");
    }

    return tour;
  };

  return { createTourWithDates };
};
