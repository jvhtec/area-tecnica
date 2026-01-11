import { useState, useEffect, useMemo } from "react";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";
import { useJobs } from "@/hooks/useJobs";
import { isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { LightsHeader } from "@/components/lights/LightsHeader";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { CalendarSection } from "@/components/dashboard/CalendarSection";
import { Calculator, PieChart, FileText, Zap, FileStack, AlertTriangle, Plus, Database, Lock, Music, Box, Layout } from 'lucide-react';
import type { JobType } from "@/types/job";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ReportGenerator } from "../components/sound/ReportGenerator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AmplifierTool } from "@/components/sound/AmplifierTool";
import { useNavigate } from "react-router-dom";
import { MemoriaTecnica } from "@/components/sound/MemoriaTecnica";
import { IncidentReport } from "@/components/sound/tools";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { SoundVisionAccessRequestDialog } from "@/components/soundvision/SoundVisionAccessRequestDialog";
import { DepartmentMobileHub } from "@/components/department/DepartmentMobileHub";
import { MobileNavBar } from "@/components/layout/MobileNavBar";
import { buildNavigationItems } from "@/components/layout/SidebarNavigation";
import { supabase } from "@/integrations/supabase/client";
import { JobDetailsDialog } from "@/components/jobs/JobDetailsDialog";
import { EnhancedJobDetailsModal } from "@/components/department/EnhancedJobDetailsModal";
import { MobileAssignmentsDialog } from "@/components/department/MobileAssignmentsDialog";
import { selectPrimaryNavigationItems } from "@/components/layout/Layout";

const Sound = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [presetJobType, setPresetJobType] = useState<JobType | undefined>(undefined);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [showAmplifierTool, setShowAmplifierTool] = useState(false);
  const [showMemoriaTecnica, setShowMemoriaTecnica] = useState(false);
  const [showIncidentReport, setShowIncidentReport] = useState(false);
  const [showAccessRequestDialog, setShowAccessRequestDialog] = useState(false);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<any>(null);
  const [selectedJobForAssignments, setSelectedJobForAssignments] = useState<any>(null);
  const [showMobileAssignments, setShowMobileAssignments] = useState(false);

  const currentDepartment = "sound";
  const { data: jobs } = useJobs();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole, hasSoundVisionAccess, userDepartment } = useOptimizedAuth();

  // Generate navigation items for mobile nav bar
  const navigationItems = useMemo(() => {
    return buildNavigationItems({
      userRole,
      userDepartment,
      hasSoundVisionAccess,
    });
  }, [userRole, userDepartment, hasSoundVisionAccess]);

  const sortedMobileItems = useMemo(() => {
    if (navigationItems.length <= 1) {
      return navigationItems;
    }
    return [...navigationItems].sort(
      (a, b) => (a.mobilePriority ?? 99) - (b.mobilePriority ?? 99),
    );
  }, [navigationItems]);

  const primaryItems = useMemo(
    () =>
      selectPrimaryNavigationItems({
        items: sortedMobileItems,
        userDepartment,
        userRole,
      }),
    [sortedMobileItems, userDepartment, userRole],
  );

  const trayItems = useMemo(() => {
    if (!sortedMobileItems.length) {
      return [];
    }
    const used = new Set(primaryItems.map((item) => item.id));
    return sortedMobileItems.filter((item) => !used.has(item.id));
  }, [sortedMobileItems, primaryItems]);
  const mobileTheme = useMemo(() => ({
    bg: "bg-[#05070a]",
    card: "bg-[#0f1219] border-[#1f232e]",
    textMain: "text-white",
    textMuted: "text-[#94a3b8]",
    divider: "border-[#1f232e]",
    toolBg: "bg-[#151820] border-[#2a2e3b]",
    accent: "bg-blue-600 text-white",
    modalOverlay: "bg-black/90 backdrop-blur-md",
  }), []);

  const handleSignOut = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Comprehensive tools array with dialogs and routes (no Festivals)
  const allTools = [
    { label: "Pesos", to: "/pesos-tool", icon: Box, color: "text-pink-500" },
    { label: "Consumos", to: "/consumos-tool", icon: Calculator, color: "text-purple-500" },
    { label: "SV Report", onClick: () => setShowReportGenerator(true), icon: FileText, color: "text-blue-500" },
    { label: "Amplifier", onClick: () => setShowAmplifierTool(true), icon: Zap, color: "text-orange-500" },
    { label: "Memoria", onClick: () => setShowMemoriaTecnica(true), icon: FileStack, color: "text-cyan-500" },
    { label: "Incident", onClick: () => setShowIncidentReport(true), icon: AlertTriangle, color: "text-red-500" },
    { label: "Plano Escenario", to: "/stage-plot", icon: Layout, color: "text-green-500" },
    {
      label: hasSoundVisionAccess ? "SoundVision" : "Request Access",
      to: hasSoundVisionAccess ? "/soundvision-files" : undefined,
      onClick: !hasSoundVisionAccess ? () => setShowAccessRequestDialog(true) : undefined,
      icon: hasSoundVisionAccess ? Database : Lock,
      color: "text-indigo-500"
    },
  ];

  // Keyboard shortcut: Cmd/Ctrl+N to open create job dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isTyping = !!activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.isContentEditable
      );
      if (isTyping) return;

      const metaN = (e.key.toLowerCase() === 'n') && (e.metaKey || e.ctrlKey);
      if (metaN) {
        e.preventDefault();
        setPresetJobType(undefined);
        setIsJobDialogOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const getDepartmentJobs = () => {
    if (!jobs) return [];
    return jobs.filter(job => {
      if (job.job_type === 'tour') return false;

      const isInDepartment = job.job_departments?.some(dept =>
        dept.department === currentDepartment
      );
      if (job.tour_date_id) {
        return isInDepartment && job.tour_date;
      }
      return isInDepartment;
    });
  };

  const getSelectedDateJobs = () => {
    if (!date || !jobs) return [];
    const selectedDate = startOfDay(date);
    return getDepartmentJobs().filter(job => {
      // Skip jobs with invalid dates
      if (!job.start_time || !job.end_time) return false;

      const jobStartDate = startOfDay(new Date(job.start_time));
      const jobEndDate = endOfDay(new Date(job.end_time));

      return isWithinInterval(selectedDate, {
        start: jobStartDate,
        end: jobEndDate
      });
    });
  };

  const handleJobClick = (jobId: string) => {
    if (isMobile) {
      const jobData = jobs?.find(j => j.id === jobId) || null;
      setSelectedJobForAssignments(jobData);
      setShowMobileAssignments(true);
      setSelectedJobId(jobId);
      return;
    }
    setSelectedJobId(jobId);
    setIsAssignmentDialogOpen(true);
  };

  const handleEditClick = (job: any) => {
    setSelectedJob(job);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = async (jobId: string) => {
    if (!["admin", "management"].includes(userRole || "")) {
      toast({
        title: "Permission denied",
        description: "Only admin and management users can delete jobs",
        variant: "destructive"
      });
      return;
    }

    if (!window.confirm("Are you sure you want to delete this job? This action cannot be undone and will remove all related data.")) return;

    try {
      const result = await deleteJobOptimistically(jobId);

      if (result.success) {
        toast({
          title: "Job deleted",
          description: result.details || "The job has been removed and cleanup is running in background."
        });
        await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      } else {
        throw new Error(result.error || "Unknown deletion error");
      }
    } catch (error: any) {
      console.error("Error in optimistic job deletion:", error);
      toast({
        title: "Error deleting job",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile View - Full Screen Hub */}
      {isMobile && (
        <div className="p-4 pb-24 space-y-4">
          <DepartmentMobileHub
            department={currentDepartment}
            title="Departamento de sonido"
            icon={Music}
            tools={allTools}
            jobs={getDepartmentJobs()}
            date={date || new Date()}
            onDateSelect={setDate}
            canCreateJob={userRole ? ["admin", "management"].includes(userRole) : false}
            onCreateJob={() => { setPresetJobType(undefined); setIsJobDialogOpen(true); }}
            userRole={userRole}
            onEditJob={handleEditClick}
            onDeleteJob={handleDeleteClick}
            onJobClick={handleJobClick}
            onViewDetails={(job) => {
              setSelectedJobForDetails(job);
              setShowJobDetails(true);
            }}
            onManageAssignments={(job) => {
              setSelectedJobForAssignments(job);
              setSelectedJobId(job?.id || null);
              setShowMobileAssignments(true);
            }}
            onStaffClick={() => navigate('/personal')}
          />
          <MobileNavBar
            primaryItems={primaryItems}
            trayItems={trayItems}
            onSignOut={handleSignOut}
            isLoggingOut={isLoggingOut}
          />
        </div>
      )}

      {/* Desktop View - Wide Layout */}
      {!isMobile && (
        <div className="p-4 md:p-8">
          <div className="mx-auto w-full max-w-full space-y-6">
            <LightsHeader
              onCreateJob={(preset) => { setPresetJobType(preset); setIsJobDialogOpen(true); }}
              department="Sound"
              canCreate={userRole ? ["admin", "management"].includes(userRole) : true}
            />

            <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm">
              <div className="flex flex-wrap gap-3 sm:gap-4 items-center justify-end">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-auto py-2 sm:py-3"
                  onClick={() => navigate('/pesos-tool')}
                >
                  <Calculator className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Weight Calculator
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="h-auto py-2 sm:py-3"
                  onClick={() => navigate('/consumos-tool')}
                >
                  <PieChart className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Power Calculator
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="h-auto py-2 sm:py-3"
                  onClick={() => setShowReportGenerator(true)}
                >
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  SV Report
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="h-auto py-2 sm:py-3"
                  onClick={() => setShowAmplifierTool(true)}
                >
                  <Zap className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Amplifier
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="h-auto py-2 sm:py-3"
                  onClick={() => setShowMemoriaTecnica(true)}
                >
                  <FileStack className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Memoria Técnica
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="h-auto py-2 sm:py-3"
                  onClick={() => setShowIncidentReport(true)}
                >
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Incident Report
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="h-auto py-2 sm:py-3"
                  onClick={() => navigate('/stage-plot')}
                >
                  <Layout className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Plano de Escenario
                </Button>

                {hasSoundVisionAccess ? (
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-auto py-2 sm:py-3"
                    onClick={() => navigate('/soundvision-files')}
                  >
                    <Database className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    SoundVision
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-auto py-2 sm:py-3"
                    onClick={() => setShowAccessRequestDialog(true)}
                  >
                    <Lock className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Request Access
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8 2xl:col-span-9">
                <Card className="bg-card border-border text-foreground">
                  <CardContent className="p-0">
                    <CalendarSection
                      date={date}
                      onDateSelect={setDate}
                      jobs={getDepartmentJobs()}
                      department={currentDepartment}
                      onDateTypeChange={() => { }}
                    />
                  </CardContent>
                </Card>
              </div>
              <div className="xl:col-span-4 2xl:col-span-3">
                <div className="bg-card rounded-xl border border-border shadow-sm">
                  <TodaySchedule
                    jobs={getSelectedDateJobs()}
                    onEditClick={handleEditClick}
                    onDeleteClick={handleDeleteClick}
                    onJobClick={handleJobClick}
                    userRole={userRole}
                    selectedDate={date}
                    detailsOnlyMode={userRole ? ["admin", "management", "house_tech"].includes(userRole) : false}
                    department={currentDepartment}
                    viewMode="sidebar"
                  />
                </div>
              </div>
            </div>

            {/* Desktop FAB */}
            <Button
              className="sm:hidden fixed bottom-6 right-6 rounded-full h-12 w-12 p-0 shadow-lg"
              onClick={() => { setPresetJobType(undefined); setIsJobDialogOpen(true); }}
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs - Shared across mobile and desktop */}
      {isJobDialogOpen && (
        <CreateJobDialog
          open={isJobDialogOpen}
          onOpenChange={setIsJobDialogOpen}
          currentDepartment={currentDepartment}
          initialDate={date}
          initialJobType={presetJobType}
          onCreated={(job) => {
            setSelectedJobId(job.id);
            if (isMobile) {
              setSelectedJobForAssignments(job);
              setShowMobileAssignments(true);
            } else {
              setIsAssignmentDialogOpen(true);
            }
          }}
        />
      )}

      {!isMobile && selectedJobId && (
        <JobAssignmentDialog
          isOpen={isAssignmentDialogOpen}
          onClose={() => setIsAssignmentDialogOpen(false)}
          onAssignmentChange={() => { }}
          jobId={selectedJobId}
          department={currentDepartment}
        />
      )}

      {selectedJob && (
        <EditJobDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          job={selectedJob}
        />
      )}

      <Dialog open={showReportGenerator} onOpenChange={setShowReportGenerator}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generador de Reportes</DialogTitle>
          </DialogHeader>
          <ReportGenerator />
        </DialogContent>
      </Dialog>

      <Dialog open={showAmplifierTool} onOpenChange={setShowAmplifierTool}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Calculadora de Amplificadores</DialogTitle>
          </DialogHeader>
          <AmplifierTool />
        </DialogContent>
      </Dialog>

      <Dialog open={showMemoriaTecnica} onOpenChange={setShowMemoriaTecnica}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Memoria Técnica</DialogTitle>
          </DialogHeader>
          <MemoriaTecnica />
        </DialogContent>
      </Dialog>

      <Dialog open={showIncidentReport} onOpenChange={setShowIncidentReport}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reporte de Incidencia</DialogTitle>
          </DialogHeader>
          <IncidentReport />
        </DialogContent>
      </Dialog>

      <SoundVisionAccessRequestDialog
        open={showAccessRequestDialog}
        onOpenChange={setShowAccessRequestDialog}
      />

      {isMobile && selectedJobForDetails && showJobDetails && (
        <EnhancedJobDetailsModal
          theme={mobileTheme}
          isDark
          job={selectedJobForDetails}
          onClose={() => {
            setShowJobDetails(false);
            setSelectedJobForDetails(null);
          }}
          userRole={userRole}
          department={currentDepartment}
        />
      )}
      {!isMobile && selectedJobForDetails && (
        <JobDetailsDialog
          open={showJobDetails}
          onOpenChange={setShowJobDetails}
          job={selectedJobForDetails}
          department={currentDepartment}
        />
      )}

      {isMobile && selectedJobForAssignments && (
        <MobileAssignmentsDialog
          open={showMobileAssignments}
          onOpenChange={(open) => {
            setShowMobileAssignments(open);
            if (!open) {
              setSelectedJobForAssignments(null);
            }
          }}
          job={selectedJobForAssignments}
          department={currentDepartment}
          userRole={userRole}
        />
      )}
    </div>
  );
};

export default Sound;
