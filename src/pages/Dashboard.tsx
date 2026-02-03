import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOptimizedJobs } from "@/hooks/useOptimizedJobs";
import { addDays, endOfMonth, format, startOfMonth, subDays } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardPath } from "@/utils/roleBasedRouting";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isJobOnDate } from "@/utils/timezoneUtils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";
import { useOptimizedMessagesSubscriptions } from "@/hooks/useOptimizedSubscriptions";
import { useIsMobile } from "@/hooks/use-mobile";

const DashboardMobileHub = lazy(() =>
  import("@/components/dashboard/DashboardMobileHub").then((m) => ({ default: m.DashboardMobileHub }))
);
const DashboardHeader = lazy(() =>
  import("@/components/dashboard/DashboardHeader").then((m) => ({ default: m.DashboardHeader }))
);
const CalendarSection = lazy(() =>
  import("@/components/dashboard/CalendarSection").then((m) => ({ default: m.CalendarSection }))
);
const TodaySchedule = lazy(() =>
  import("@/components/dashboard/TodaySchedule").then((m) => ({ default: m.TodaySchedule }))
);
const MessagesDialog = lazy(() =>
  import("@/components/dashboard/MessagesDialog").then((m) => ({ default: m.MessagesDialog }))
);
const EmailComposerDialog = lazy(() =>
  import("@/components/dashboard/EmailComposerDialog").then((m) => ({ default: m.EmailComposerDialog }))
);
const EditJobDialog = lazy(() =>
  import("@/components/jobs/EditJobDialog").then((m) => ({ default: m.EditJobDialog }))
);
const JobDetailsDialog = lazy(() =>
  import("@/components/jobs/JobDetailsDialog").then((m) => ({ default: m.JobDetailsDialog }))
);

const getSelectedDateJobs = (date: Date | undefined, jobs: any[]) => {
  if (!date || !jobs) return [];

  return jobs.filter(job => {
    if (job.job_type === 'tour') return false;

    // Use timezone-aware date comparison
    const jobTimezone = job.timezone || 'Europe/Madrid';
    return isJobOnDate(job.start_time, job.end_time, date, jobTimezone);
  });
};

const Dashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { userRole, user, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? "";
  const lazyFallback = (
    <div className="flex items-center justify-center py-6">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  // Early security check: Only allow admin, management, logistics
  useEffect(() => {
    if (authLoading) return;

    if (userRole && !['admin', 'management', 'logistics'].includes(userRole)) {
      const redirectPath = getDashboardPath(userRole as any);
      navigate(redirectPath, { replace: true });
    }
  }, [userRole, authLoading, navigate]);

  // Dashboard state
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [timeSpan, setTimeSpan] = useState<string>("1week");

  // Modal state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  // New Dialog States
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);

  // Data fetching with optimized hook
  const monthAnchor = date ?? new Date();
  const jobsRangeStart = subDays(startOfMonth(monthAnchor), 7);
  const jobsRangeEnd = addDays(endOfMonth(monthAnchor), 14);
  const { data: jobs = [], isLoading } = useOptimizedJobs(undefined, jobsRangeStart, jobsRangeEnd);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Ensure realtime updates for messages are wired
  useOptimizedMessagesSubscriptions(userId);

  const { data: pendingExpensesSummary, isLoading: isLoadingPendingExpenses } = useQuery({
    queryKey: ['dashboard-expenses-summary'],
    enabled: !!userRole && ['admin', 'management', 'logistics'].includes(userRole),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_expenses')
        .select('amount_eur, job_id')
        .eq('status', 'submitted');
      if (error) throw error;
      const rows = (data || []) as Array<{ amount_eur: number | null; job_id: string }>;
      const total = rows.reduce((sum, row) => sum + Number(row.amount_eur ?? 0), 0);
      const jobMap = new Map<string, number>();
      rows.forEach((row) => {
        if (!row.job_id) return;
        jobMap.set(row.job_id, (jobMap.get(row.job_id) || 0) + Number(row.amount_eur ?? 0));
      });
      const topJobs = Array.from(jobMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([jobId, amount]) => ({ jobId, amount }));
      return {
        count: rows.length,
        total,
        jobs: topJobs,
      };
    },
    staleTime: 15_000,
  });

  // Parse optional deep-link params (e.g. open messages dialog)
  useEffect(() => {
    if (authLoading) return;
    if (!userRole || !["admin", "management"].includes(userRole)) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("showMessages") === "true") {
      setMessagesOpen(true);
    }
  }, [authLoading, userRole]);

  const canManage = userRole === "admin" || userRole === "management";

  const openMessages = useCallback(() => setMessagesOpen(true), []);
  const openEmailComposer = useCallback(() => setEmailComposerOpen(true), []);

  // Event handlers
  const handleJobClick = useCallback((jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    setSelectedJob(job);
    setIsDetailsDialogOpen(true);
  }, [jobs]);

  const handleEditClick = useCallback((job: any) => {
    if (userRole === "logistics") return;
    setSelectedJob(job);
    setIsEditDialogOpen(true);
  }, [userRole]);

  const handleDeleteClick = useCallback(async (jobId: string) => {
    // Check permissions
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
      // Call optimistic deletion service
      const result = await deleteJobOptimistically(jobId);

      if (result.success) {
        toast({
          title: "Job deleted",
          description: result.details || "The job has been removed and cleanup is running in background."
        });

        // Invalidate queries to refresh the list
        await queryClient.invalidateQueries({ queryKey: ["optimized-jobs"] });
      } else {
        throw new Error(result.error || "Unknown deletion error");
      }
    } catch (error: any) {
      console.error("Dashboard: Error in optimistic job deletion:", error);
      toast({
        title: "Error deleting job",
        description: error.message,
        variant: "destructive"
      });
    }
  }, [queryClient, toast, userRole]);

  const handleDateTypeChange = useCallback(() => {}, []);

  const selectedDateJobs = useMemo(() => getSelectedDateJobs(date, jobs), [date, jobs]);

  // Show loading state while checking authorization
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900 dark:border-white" />
      </div>
    );
  }

  // Don't render anything if user is unauthorized (they'll be redirected)
  if (!userRole || !['admin', 'management', 'logistics'].includes(userRole)) {
    return null;
  }

  // Mobile view - use DashboardMobileHub
  if (isMobile) {
    return (
      <>
        <Suspense fallback={lazyFallback}>
          <DashboardMobileHub
            jobs={jobs}
            date={date}
            onDateSelect={setDate}
            userRole={userRole}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
            onJobClick={handleJobClick}
            onMessagesClick={canManage ? openMessages : undefined}
            onEmailClick={canManage ? openEmailComposer : undefined}
          />
        </Suspense>

        {/* Dialogs */}
        {selectedJob && isEditDialogOpen ? (
          <Suspense fallback={lazyFallback}>
            <EditJobDialog
              open={isEditDialogOpen}
              onOpenChange={setIsEditDialogOpen}
              job={selectedJob}
            />
          </Suspense>
        ) : null}

        {selectedJob && isDetailsDialogOpen ? (
          <Suspense fallback={lazyFallback}>
            <JobDetailsDialog
              open={isDetailsDialogOpen}
              onOpenChange={setIsDetailsDialogOpen}
              job={selectedJob}
            />
          </Suspense>
        ) : null}

        {messagesOpen ? (
          <Suspense fallback={lazyFallback}>
            <MessagesDialog
              open={messagesOpen}
              onOpenChange={setMessagesOpen}
            />
          </Suspense>
        ) : null}

        {emailComposerOpen ? (
          <Suspense fallback={lazyFallback}>
            <EmailComposerDialog
              open={emailComposerOpen}
              onOpenChange={setEmailComposerOpen}
            />
          </Suspense>
        ) : null}
      </>
    );
  }

  // Desktop view - existing layout
  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
      <div className="mx-auto w-full max-w-full space-y-6">
        <Suspense fallback={lazyFallback}>
          <DashboardHeader timeSpan={timeSpan} onTimeSpanChange={setTimeSpan} />
        </Suspense>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Main Content Area */}
          <div className="xl:col-span-8 2xl:col-span-9 space-y-6">
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
              <Suspense fallback={lazyFallback}>
                <CalendarSection
                  date={date}
                  onDateSelect={setDate}
                  jobs={jobs}
                  onDateTypeChange={handleDateTypeChange}
                />
              </Suspense>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-6 xl:col-span-4 2xl:col-span-3">
            {/* Quick Actions */}
            {canManage && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="bg-card border-border hover:bg-accent hover:text-accent-foreground text-foreground/80 h-auto py-4 flex flex-col gap-2"
                  onClick={openMessages}
                >
                  <MessageSquare className="w-5 h-5 text-blue-500" />
                  <span className="text-xs font-medium">Mensajes</span>
                </Button>
                <Button
                  variant="outline"
                  className="bg-card border-border hover:bg-accent hover:text-accent-foreground text-foreground/80 h-auto py-4 flex flex-col gap-2"
                  onClick={openEmailComposer}
                >
                  <Mail className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-medium">Email</span>
                </Button>
              </div>
            )}

            {/* Pending expenses summary */}
            {["admin", "management", "logistics"].includes(userRole) && (
              <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Gastos pendientes</h3>
                    <p className="text-xs text-muted-foreground/70">Aprobaciones antes de continuar con los pagos</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {pendingExpensesSummary?.count ?? 0}
                  </Badge>
                </div>
                <div className="p-4 space-y-3 text-sm text-muted-foreground">
                  {isLoadingPendingExpenses ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Calculando pendientes…
                    </div>
                  ) : pendingExpensesSummary && pendingExpensesSummary.count > 0 ? (
                    <>
                      <div className="flex items-center justify-between text-base font-semibold text-foreground">
                        <span>Total por aprobar</span>
                        <span>{formatCurrency(pendingExpensesSummary.total)}</span>
                      </div>
                      {pendingExpensesSummary.jobs.length > 0 && (
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {pendingExpensesSummary.jobs.map(({ jobId, amount }) => (
                            <div key={jobId} className="flex items-center justify-between">
                              <span>Job {jobId.substring(0, 8)}…</span>
                              <span>{formatCurrency(amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground">No hay gastos pendientes de aprobación.</div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate('/gastos')}
                  >
                    Ir a Gastos
                  </Button>
                </div>
              </div>
            )}

            {/* Today's Schedule Widget */}
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Agenda de Hoy</h3>
                <span className="text-xs text-muted-foreground">{format(new Date(), 'd MMM')}</span>
              </div>
              <div className="p-2">
                <Suspense fallback={lazyFallback}>
                  <TodaySchedule
                    jobs={selectedDateJobs}
                    onEditClick={handleEditClick}
                    onDeleteClick={handleDeleteClick}
                    onJobClick={handleJobClick}
                    userRole={userRole}
                    selectedDate={date}
                    detailsOnlyMode
                    hideTasks
                    viewMode="sidebar"
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </div>

        {/* Dialogs */}
        {selectedJob && isEditDialogOpen ? (
          <Suspense fallback={lazyFallback}>
            <EditJobDialog
              open={isEditDialogOpen}
              onOpenChange={setIsEditDialogOpen}
              job={selectedJob}
            />
          </Suspense>
        ) : null}

        {messagesOpen ? (
          <Suspense fallback={lazyFallback}>
            <MessagesDialog
              open={messagesOpen}
              onOpenChange={setMessagesOpen}
            />
          </Suspense>
        ) : null}

        {emailComposerOpen ? (
          <Suspense fallback={lazyFallback}>
            <EmailComposerDialog
              open={emailComposerOpen}
              onOpenChange={setEmailComposerOpen}
            />
          </Suspense>
        ) : null}
      </div>
    </div>
  );
};

export default Dashboard;
