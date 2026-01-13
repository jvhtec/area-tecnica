import React, { useEffect, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useTourRateSubscriptions } from "@/hooks/useTourRateSubscriptions";
import { useJobExtras } from "@/hooks/useJobExtras";
import { useJobRatesApproval } from "@/hooks/useJobRatesApproval";
import { TourRatesPanel } from "@/components/tours/TourRatesPanel";
import { JobExtrasManagement } from "@/components/jobs/JobExtrasManagement";
import { JobExpensesPanel } from "@/components/jobs/JobExpensesPanel";

import { JobDetailsDocumentsTab } from "./job-details-dialog/tabs/JobDetailsDocumentsTab";
import { JobDetailsInfoTab } from "./job-details-dialog/tabs/JobDetailsInfoTab";
import { JobDetailsLocationTab } from "./job-details-dialog/tabs/JobDetailsLocationTab";
import { JobDetailsPersonnelTab } from "./job-details-dialog/tabs/JobDetailsPersonnelTab";
import { JobDetailsRestaurantsTab } from "./job-details-dialog/tabs/JobDetailsRestaurantsTab";
import { JobDetailsWeatherTab } from "./job-details-dialog/tabs/JobDetailsWeatherTab";
import { StaffingOrchestratorPanel } from "@/components/matrix/StaffingOrchestratorPanel";

export { enrichTimesheetsWithProfiles } from "./job-details-dialog/enrichTimesheetsWithProfiles";

interface JobDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: any;
  department?: string;
}

const JobDetailsDialogComponent: React.FC<JobDetailsDialogProps> = ({ open, onOpenChange, job, department = "sound" }) => {
  const [selectedTab, setSelectedTab] = useState("info");
  const { userRole, user } = useOptimizedAuth();
  const isManager = ["admin", "management"].includes(userRole || "");
  const isTechnicianRole = ["technician", "house_tech"].includes(userRole || "");
  const isHouseTech = userRole === "house_tech";
  const canSeeAutoStaffing = ["admin", "management", "logistics"].includes(userRole || "");
  const queryClient = useQueryClient();

  // Fetch comprehensive job data
  const {
    data: jobDetails,
    isLoading: isJobLoading,
    error: jobDocumentsError,
  } = useQuery({
    queryKey: ["job-details", job.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          `
          *,
          locations(id, name, formatted_address, latitude, longitude),
          job_assignments(
            job_id, technician_id, assigned_by, assigned_at,
            sound_role, lights_role, video_role, status,
            single_day, assignment_date,
            profiles(id, first_name, last_name, department, role, profile_picture_url)
          ),
          timesheets(technician_id, date),
          job_documents(id, file_name, file_path, uploaded_at, file_size, visible_to_tech, read_only, template_type),
          logistics_events(id, event_type, transport_type, event_date, event_time, license_plate)
        `
        )
        .eq("id", job.id)
        .single();

      if (error) throw error;
      console.log("JobDetailsDialog: Full job data loaded:", JSON.stringify(data, null, 2));
      console.log("JobDetailsDialog: Location data:", data?.locations);
      console.log("JobDetailsDialog: Job assignments:", data?.job_assignments?.length || 0);
      console.log("JobDetailsDialog: Job documents:", data?.job_documents?.length || 0);
      return data;
    },
    enabled: open,
  });

  // Extras setup and visibility
  const resolvedJobId = (jobDetails?.id as string) || job.id;
  const { data: jobExtras = [] } = useJobExtras(resolvedJobId);
  const { data: jobRatesApproval } = useJobRatesApproval(resolvedJobId);
  const jobRatesApproved = jobRatesApproval?.rates_approved ?? !!jobDetails?.rates_approved;
  const isDryhire = (jobDetails?.job_type || job?.job_type) === "dryhire";
  console.log("JobDetailsDialog: isDryhire =", isDryhire, "job_type =", jobDetails?.job_type || job?.job_type);

  const showExtrasTab = !isDryhire && (isManager || isHouseTech || (jobRatesApproved && jobExtras.length > 0));
  const canSeeRateTabs = (isManager || jobRatesApproved) && !isHouseTech;
  const showTourRatesTab = !isDryhire && jobDetails?.job_type === "tourdate" && canSeeRateTabs;

  const canManageExpenses = ["admin", "management", "logistics"].includes(userRole || "");
  const showExpensesTab = !isDryhire && canManageExpenses;

  const resolvedDocuments = jobDetails?.job_documents || job?.job_documents || [];
  const documentsLoading = isJobLoading;

  const expenseTechnicianOptions = useMemo(() => {
    const map = new Map<string, string>();
    (jobDetails?.job_assignments ?? []).forEach((assignment: any) => {
      const techId = assignment.technician_id;
      if (!techId || map.has(techId)) return;
      const name = [assignment.profiles?.first_name, assignment.profiles?.last_name].filter(Boolean).join(" ").trim();
      map.set(techId, name || techId);
    });
    (jobDetails?.timesheets ?? []).forEach((row: any) => {
      const techId = row.technician_id;
      if (!techId || map.has(techId)) return;
      const name = [row.technician?.first_name, row.technician?.last_name].filter(Boolean).join(" ").trim();
      map.set(techId, name || techId);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name: name || id }));
  }, [jobDetails?.job_assignments, jobDetails?.timesheets]);

  useEffect(() => {
    if (!showTourRatesTab && selectedTab === "tour-rates") {
      setSelectedTab("info");
    }
    if (!showExtrasTab && selectedTab === "extras") {
      setSelectedTab("info");
    }
    if (!showExpensesTab && selectedTab === "expenses") {
      setSelectedTab("info");
    }
    if (!canSeeAutoStaffing && selectedTab === "staffing") {
      setSelectedTab("info");
    }
  }, [showTourRatesTab, showExtrasTab, showExpensesTab, canSeeAutoStaffing, selectedTab]);

  // Reset selectedTab to 'info' when dialog opens OR when job changes
  const [lastOpenState, setLastOpenState] = useState(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  useEffect(() => {
    const jobIdChanged = job.id !== lastJobId;
    const dialogOpening = open && !lastOpenState;

    if (dialogOpening || (open && jobIdChanged)) {
      console.log("JobDetailsDialog: Resetting to info tab", { dialogOpening, jobIdChanged, jobId: job.id });
      setSelectedTab("info");
      setLastJobId(job.id);
    }
    setLastOpenState(open);
  }, [open, lastOpenState, job.id, lastJobId]);

  useEffect(() => {
    console.log("JobDetailsDialog: selectedTab changed to:", selectedTab);
  }, [selectedTab]);

  // Invalidate all job-related queries when job changes to ensure fresh data
  useEffect(() => {
    if (open && job.id) {
      console.log("JobDetailsDialog: Job changed, invalidating queries for job", job.id);
      queryClient.invalidateQueries({ queryKey: ["job-details", job.id] });
      queryClient.invalidateQueries({ queryKey: ["job-artists", job.id] });
      queryClient.invalidateQueries({ queryKey: ["job-restaurants", job.id] });
      queryClient.invalidateQueries({ queryKey: ["job-rider-files", job.id] });
    }
  }, [job.id, open, queryClient]);

  // Reset selectedTab if user is on a dryhire-excluded tab when isDryhire is true
  useEffect(() => {
    if (open && isDryhire && ["location", "personnel", "staffing", "documents", "restaurants", "weather", "extras", "expenses"].includes(selectedTab)) {
      console.log("JobDetailsDialog: Dryhire job detected, resetting from", selectedTab, "to info");
      setSelectedTab("info");
    }
  }, [open, isDryhire, selectedTab]);

  useTourRateSubscriptions();

  if (isJobLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col overflow-y-auto">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const gridColsClass = isDryhire ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-4 md:grid-cols-8";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] sm:w-[96vw] max-w-[1200px] xl:max-w-[1400px] max-h-[92vh] flex flex-col overflow-y-auto overflow-x-hidden px-3 sm:px-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
            <Calendar className="h-4 w-4 md:h-5 md:w-5" />
            <span className="truncate">{jobDetails?.title || "Detalles del trabajo"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overflow-x-hidden max-h-[75vh]">
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex flex-col min-w-0">
            <TabsList className={`grid w-full ${gridColsClass} flex-shrink-0 h-auto text-xs md:text-sm overflow-x-auto no-scrollbar`}>
              <TabsTrigger value="info" className="py-2">
                Información
              </TabsTrigger>
              {!isDryhire && (
                <TabsTrigger value="location" className="py-2">
                  Ubicación
                </TabsTrigger>
              )}
              {!isDryhire && (
                <TabsTrigger value="personnel" className="py-2">
                  Personal
                </TabsTrigger>
              )}
              {!isDryhire && canSeeAutoStaffing && (
                <TabsTrigger value="staffing" className="py-2">
                  Auto staffing
                </TabsTrigger>
              )}
              {!isDryhire && (
                <TabsTrigger value="documents" className="py-2">
                  Documentos
                </TabsTrigger>
              )}
              {!isDryhire && (
                <TabsTrigger value="restaurants" className="py-2">
                  Restaurantes
                </TabsTrigger>
              )}
              {!isDryhire && (
                <TabsTrigger value="weather" className="py-2">
                  Clima
                </TabsTrigger>
              )}
              {showTourRatesTab && (
                <TabsTrigger value="tour-rates" className="py-2">
                  Tarifas
                </TabsTrigger>
              )}
              {!isDryhire && showExtrasTab && (
                <TabsTrigger value="extras" className="py-2">
                  Extras
                </TabsTrigger>
              )}
              {showExpensesTab && (
                <TabsTrigger value="expenses" className="py-2">
                  Gastos
                </TabsTrigger>
              )}
            </TabsList>

            <div className="mt-3 md:mt-4 px-1 pr-1 min-w-0 overflow-x-hidden">
              <JobDetailsInfoTab
                open={open}
                job={job}
                jobDetails={jobDetails}
                resolvedJobId={resolvedJobId}
                isManager={isManager}
                isTechnicianRole={isTechnicianRole}
                isDryhire={isDryhire}
                jobRatesApproved={jobRatesApproved}
              />

              {!isDryhire && (
                <JobDetailsLocationTab open={open} jobDetails={jobDetails} isJobLoading={isJobLoading} />
              )}

              {!isDryhire && (
                <JobDetailsPersonnelTab jobDetails={jobDetails} isJobLoading={isJobLoading} department={department} />
              )}

              {!isDryhire && canSeeAutoStaffing && (
                <TabsContent value="staffing" className="space-y-4 min-w-0 overflow-x-hidden">
                  <StaffingOrchestratorPanel
                    jobId={resolvedJobId}
                    department={department}
                    jobTitle={jobDetails?.title || job?.title}
                  />
                </TabsContent>
              )}

              {!isDryhire && (
                <JobDetailsDocumentsTab
                  open={open}
                  jobId={job.id}
                  resolvedDocuments={resolvedDocuments}
                  documentsLoading={documentsLoading}
                  jobDocumentsError={jobDocumentsError}
                />
              )}

              {!isDryhire && (
                <JobDetailsRestaurantsTab open={open} jobId={job.id} jobDetails={jobDetails} isJobLoading={isJobLoading} />
              )}

              {!isDryhire && <JobDetailsWeatherTab jobDetails={jobDetails} isJobLoading={isJobLoading} />}

              {showTourRatesTab && resolvedJobId && (
                <TabsContent value="tour-rates" className="space-y-4 min-w-0 overflow-x-hidden">
                  <TourRatesPanel jobId={resolvedJobId} />
                </TabsContent>
              )}

              {!isDryhire && showExtrasTab && (
                <TabsContent value="extras" className="space-y-4 min-w-0 overflow-x-hidden">
                  <JobExtrasManagement jobId={resolvedJobId} isManager={isManager} technicianId={isManager ? undefined : user?.id || undefined} />
                </TabsContent>
              )}

              {showExpensesTab && (
                <TabsContent value="expenses" className="space-y-4 min-w-0 overflow-x-hidden">
                  <JobExpensesPanel
                    jobId={resolvedJobId || job.id}
                    jobTitle={jobDetails?.title || job?.title}
                    technicians={expenseTechnicianOptions}
                    canManage={canManageExpenses}
                  />
                </TabsContent>
              )}
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const JobDetailsDialog = React.memo(JobDetailsDialogComponent);

JobDetailsDialog.displayName = "JobDetailsDialog";
