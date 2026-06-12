
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, Search, Filter, Plus, Check } from "lucide-react";
import { dataLayerClient } from "@/services/dataLayerClient";
import { Department } from "@/types/department";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";
import { MonthNavigation } from "@/components/project-management/MonthNavigation";
import { DepartmentTabs } from "@/components/project-management/DepartmentTabs";
import { StatusFilter } from "@/components/project-management/StatusFilter";
import { JobTypeFilter } from "@/components/project-management/JobTypeFilter";
import { Input } from "@/components/ui/input";
import { useOptimizedJobs } from "@/hooks/useOptimizedJobs";
import { useTabVisibility } from "@/hooks/useTabVisibility";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { autoCompleteJobs } from "@/utils/jobStatusUtils";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useCreateJobDialogStore } from "@/stores/useCreateJobDialogStore";
import { canEditJobs } from "@/utils/permissions";


import { queryKeys } from "@/lib/react-query";
const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const buildSearchTokens = (query: string) => normalizeSearchText(query).split(/\s+/).filter(Boolean);

const TYPE_LABELS: Record<string, string> = {
  single: "Sencillo",
  festival: "Festival",
  ciclo: "Ciclo",
  tour: "Gira",
  tourdate: "Fecha de gira",
  dryhire: "Dry Hire",
  evento: "Evento",
};

const STATUS_LABELS: Record<string, string> = {
  Tentativa: "Tentativa",
  Confirmado: "Confirmado",
  Completado: "Completado",
  Cancelado: "Cancelado",
};

const getTypeLabel = (type: string) => TYPE_LABELS[type?.toLowerCase()] || type;
const getStatusLabel = (status: string) => STATUS_LABELS[status] || status;

const ProjectManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { openDialog } = useCreateJobDialogStore();
  const { userDepartment, isLoading: authLoading } = useOptimizedAuth();
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<Department>((userDepartment as Department) ?? "sound");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedJobStatuses, setSelectedJobStatuses] = useState<string[]>(["Confirmado", "Tentativa"]);
  const [allJobTypes, setAllJobTypes] = useState<string[]>([]);
  const [allJobStatuses, setAllJobStatuses] = useState<string[]>([]);
  const [highlightToday, setHighlightToday] = useState(false);
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const { forceSubscribe } = useSubscriptionContext();

  // URL parameter for opening hoja de ruta modal
  const openHojaDeRutaJobId = searchParams.get('openHojaDeRuta');

  // Memoized callback to clear URL parameter after modal is opened
  const handleHojaDeRutaOpened = useCallback(() => {
    // Create new URLSearchParams to avoid mutating the existing one
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('openHojaDeRuta');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  const startDate = startOfMonth(currentDate);
  const endDate = endOfMonth(currentDate);

  useEffect(() => {
    if (!authLoading) {
      setSelectedDepartment((userDepartment as Department) ?? "sound");
    }
  }, [authLoading, userDepartment]);

  // Use custom hook to keep the "jobs" tab active/visible.
  useTabVisibility(["optimized-jobs"]);
  
  // Force subscription to required tables
  useEffect(() => {
    forceSubscribe([
      { table: 'jobs', queryKey: queryKeys.scope('optimized-jobs'), priority: 'high' },
      { table: 'job_assignments', queryKey: queryKeys.scope('optimized-jobs'), priority: 'medium' },
      { table: 'job_departments', queryKey: queryKeys.scope('optimized-jobs'), priority: 'medium' }
    ]);
  }, [forceSubscribe]);

  // Debounce search input to avoid thrashing queries and re-renders
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // When searching, override month pagination by removing date bounds
  const isSearching = debouncedQuery.trim().length > 0;

  // Use optimized jobs hook with built-in filtering and caching
  const { data: optimizedJobs = [], isLoading: jobsLoading, error: jobsError } = useOptimizedJobs(
    selectedDepartment,
    isSearching ? undefined : startDate,
    isSearching ? undefined : endDate,
    true, // include dryhire jobs in project management
    { refetchOnMount: "always" }
  );

  // Check user permissions early
  const canCreateItems = canEditJobs(userRole);

  // Auto-complete past jobs when data loads
  useEffect(() => {
    const handleAutoComplete = async () => {
      // Skip auto-complete while searching (prevents heavy scans over large search scopes)
      if (!optimizedJobs?.length || !canCreateItems || isSearching) return;
      
      setIsAutoCompleting(true);
      try {
        const { updatedJobs, updatedCount } = await autoCompleteJobs(optimizedJobs);
        
        if (updatedCount > 0) {
          toast({
            title: "Jobs Auto-Completed",
            description: `${updatedCount} past job(s) automatically marked as completed`,
          });
        }
      } catch (error) {
        console.error('Auto-complete error:', error);
      } finally {
        setIsAutoCompleting(false);
      }
    };

    handleAutoComplete();
  }, [optimizedJobs, canCreateItems, isSearching, toast]);

  // Filter jobs by selected job type and statuses with database-level optimization
  const tokens = buildSearchTokens(debouncedQuery);
  const jobs = (optimizedJobs || []).filter((job: any) => {
    const matchesType = isSearching
      ? true // search overrides type filter
      : (selectedJobTypes.length === 0 ||
        selectedJobTypes.map(t => t.toLowerCase()).includes(String(job.job_type || '').toLowerCase()));
    const matchesStatus = selectedJobStatuses.length === 0 || selectedJobStatuses.includes(job.status);
    const searchableValues = [job.title, job.client, job.location?.name, job.location?.formatted_address]
      .filter(Boolean)
      .map((value: string) => normalizeSearchText(value));
    const matchesSearch =
      tokens.length === 0 ||
      tokens.every((token) => searchableValues.some((value) => value.includes(token)));
    return matchesType && matchesStatus && matchesSearch;
  });

  // Highlight today's jobs when page loads
  useEffect(() => {
    if (!loading && jobs.length > 0) {
      const todayJobs = jobs.filter((job: any) => {
        const jobStart = new Date(job.start_time);
        const jobEnd = new Date(job.end_time);
        const today = new Date();
        return today >= jobStart && today <= jobEnd;
      });

      if (todayJobs.length > 0) {
        setHighlightToday(true);
        // Remove highlight after 3 seconds
        setTimeout(() => setHighlightToday(false), 3000);
      }
    }
  }, [loading, jobs]);

  // Check user access and fetch profile role.
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { session } } = await dataLayerClient.auth.getSession();
        if (!session) {
          console.log("ProjectManagement: No session found, redirecting to auth");
          navigate("/auth");
          return;
        }
        const { data: profile, error: profileError } = await dataLayerClient.from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profileError) {
          console.error("ProjectManagement: Error fetching profile:", profileError);
          throw profileError;
        }
        // Allow technicians to view but not modify festival jobs
        if (!profile || !["admin", "logistics", "management", "technician"].includes(profile.role)) {
          console.log("ProjectManagement: Unauthorized access attempt");
          navigate("/dashboard");
          return;
        }
        setUserRole(profile.role);
        setLoading(false);
      } catch (error) {
        console.error("ProjectManagement: Error in access check:", error);
        navigate("/dashboard");
      }
    };

    checkAccess();
  }, [navigate]);

  // Load user preferences for job status selection
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const { data: { session } } = await dataLayerClient.auth.getSession();
        if (!session?.user?.id) return;
        
        const { data: profile, error } = await dataLayerClient.from("profiles")
          .select("selected_job_statuses")
          .eq("id", session.user.id)
          .single();
          
        if (error) {
          console.error("Error loading user preferences:", error);
          return;
        }
        
        if (profile?.selected_job_statuses) {
          setSelectedJobStatuses(profile.selected_job_statuses);
        }
      } catch (error) {
        console.error("Error in loadUserPreferences:", error);
      }
    };
    
    loadUserPreferences();
  }, []);

  // Save user preferences when status selection changes
  const saveUserPreferences = async (statuses: string[]) => {
    try {
      const { data: { session } } = await dataLayerClient.auth.getSession();
      if (!session?.user?.id) return;
      
      const { error } = await dataLayerClient.from("profiles")
        .update({ selected_job_statuses: statuses })
        .eq("id", session.user.id);
        
      if (error) {
        console.error("Error saving user preferences:", error);
      }
    } catch (error) {
      console.error("Error in saveUserPreferences:", error);
    }
  };

  // Extract job types and statuses from optimized jobs data to avoid extra query
  useEffect(() => {
    if (optimizedJobs?.length > 0) {
      const types = Array.from(
        new Set(optimizedJobs
          .map((job: any) => job.job_type)
          .filter(Boolean))
      );
      const statuses = Array.from(
        new Set(optimizedJobs
          .map((job: any) => job.status)
          .filter(Boolean))
      );
      setAllJobTypes(types);
      setAllJobStatuses(statuses);
    }
  }, [optimizedJobs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Check if user has permissions to create new items
  // (Already declared above for use in useEffect)

  const handleAutoCompleteAll = async () => {
    if (!canCreateItems) return;
    
    setIsAutoCompleting(true);
    try {
      const { updatedJobs, updatedCount } = await autoCompleteJobs(optimizedJobs);
      
      if (updatedCount > 0) {
        toast({
          title: "Jobs Auto-Completed",
          description: `${updatedCount} past job(s) marked as completed`,
        });
      } else {
        toast({
          title: "No Updates Needed",
          description: "All past jobs are already completed or cancelled",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to auto-complete jobs",
        variant: "destructive"
      });
    } finally {
      setIsAutoCompleting(false);
    }
  };

  const handleJobStatusSelection = (status: string) => {
    const newStatuses = selectedJobStatuses.includes(status)
      ? selectedJobStatuses.filter(s => s !== status)
      : [...selectedJobStatuses, status];
      
    setSelectedJobStatuses(newStatuses);
    saveUserPreferences(newStatuses);
  };

  const toggleJobType = (type: string) => {
    setSelectedJobTypes(prev => (
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    ));
  };

  const allJobTypesSelected = allJobTypes.length > 0 && selectedJobTypes.length === allJobTypes.length;
  const allJobStatusesSelected = allJobStatuses.length > 0 && selectedJobStatuses.length === allJobStatuses.length;

  const toggleAllJobTypes = () => {
    if (allJobTypesSelected) {
      selectedJobTypes.forEach(type => toggleJobType(type));
      return;
    }

    allJobTypes.forEach(type => {
      if (!selectedJobTypes.includes(type)) toggleJobType(type);
    });
  };

  const toggleAllJobStatuses = () => {
    const nextStatuses = allJobStatusesSelected ? [] : allJobStatuses;
    setSelectedJobStatuses(nextStatuses);
    saveUserPreferences(nextStatuses);
  };

  const MobileFilterOption = ({
    checked,
    label,
    onClick,
  }: {
    checked: boolean;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      className="flex min-h-10 w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
        )}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );

  const MobileFilterContent = () => (
    <div className="w-full space-y-4">
      <Accordion type="multiple" defaultValue={["types", "status"]} className="w-full space-y-3">
        <AccordionItem value="types" className="rounded-md border px-3">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Tipos
              {selectedJobTypes.length > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {selectedJobTypes.length}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pb-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleAllJobTypes}
              className="w-full justify-start"
            >
              {allJobTypesSelected ? "Limpiar todo" : "Seleccionar todo"}
            </Button>
            <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
              {allJobTypes.length > 0 ? (
                allJobTypes.map((type) => (
                  <MobileFilterOption
                    key={type}
                    checked={selectedJobTypes.includes(type)}
                    label={getTypeLabel(type)}
                    onClick={() => toggleJobType(type)}
                  />
                ))
              ) : (
                <div className="px-2 py-3 text-sm text-muted-foreground">No hay tipos disponibles</div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="status" className="rounded-md border px-3">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Estado
              {selectedJobStatuses.length > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {selectedJobStatuses.length}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pb-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleAllJobStatuses}
              className="w-full justify-start"
            >
              {allJobStatusesSelected ? "Limpiar todo" : "Seleccionar todo"}
            </Button>
            <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
              {allJobStatuses.length > 0 ? (
                allJobStatuses.map((status) => (
                  <MobileFilterOption
                    key={status}
                    checked={selectedJobStatuses.includes(status)}
                    label={getStatusLabel(status)}
                    onClick={() => handleJobStatusSelection(status)}
                  />
                ))
              ) : (
                <div className="px-2 py-3 text-sm text-muted-foreground">No hay estados disponibles</div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {canCreateItems && (
        <Button 
          onClick={handleAutoCompleteAll}
          disabled={isAutoCompleting || jobsLoading}
          variant="outline"
          size="sm"
          className="w-full"
        >
          {isAutoCompleting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Autocompletar trabajos pasados
        </Button>
      )}
    </div>
  );

  const FilterContent = () => (
    <div className={cn("flex flex-col gap-4", isMobile ? "w-full" : "")}>
      {isMobile ? (
        <MobileFilterContent />
      ) : (
        <>
          <div className="flex items-center gap-4">
            <JobTypeFilter
              allJobTypes={allJobTypes}
              selectedJobTypes={selectedJobTypes}
              onTypeToggle={toggleJobType}
            />
            <StatusFilter
              allJobStatuses={allJobStatuses}
              selectedJobStatuses={selectedJobStatuses}
              onStatusSelection={handleJobStatusSelection}
            />
          </div>
          {canCreateItems && (
            <Button 
              onClick={handleAutoCompleteAll}
              disabled={isAutoCompleting || jobsLoading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              {isAutoCompleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Auto-Complete Past Jobs
            </Button>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className={cn("w-full max-w-full mx-auto space-y-4", isMobile ? "px-3 py-4" : "px-6 py-6")}>
        <Card>
          <CardHeader className={cn("flex flex-col space-y-4", isMobile ? "p-4 pb-3" : "p-6 pb-4")}>
          <div className="flex items-center justify-between">
            <CardTitle className={cn(isMobile ? "text-lg" : "text-xl")}>Project Management</CardTitle>
            {isMobile && (
              <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filtros
                    {(selectedJobTypes.length > 0 || selectedJobStatuses.length > 0) && (
                      <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs px-2 py-0.5">
                        {selectedJobTypes.length + selectedJobStatuses.length}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="bottom"
                  className="h-auto max-h-[85dvh] overflow-y-auto px-4 pt-5"
                  style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
                >
                  <SheetHeader className="mb-4">
                    <SheetTitle>Filtros</SheetTitle>
                    <SheetDescription className="sr-only">
                      Selecciona tipos y estados para filtrar la lista de proyectos.
                    </SheetDescription>
                  </SheetHeader>
                  <FilterContent />
                </SheetContent>
              </Sheet>
            )}
          </div>
          
          <div className={cn("flex gap-2", isMobile ? "flex-col" : "flex-row flex-wrap items-center")}>
            {!isMobile && <FilterContent />}
            <div className={cn("relative", isMobile ? "w-full" : "flex-1 min-w-[220px] max-w-[280px]")}>
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className={cn("pl-8 h-9", isMobile && "w-full")}
              />
              {(jobsLoading) && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn(isMobile ? "p-4 pt-2" : "p-6 pt-2")}>
          <MonthNavigation
            currentDate={currentDate}
            onPreviousMonth={() => setCurrentDate(prev => addMonths(prev, -1))}
            onNextMonth={() => setCurrentDate(prev => addMonths(prev, 1))}
          />
          <DepartmentTabs
            selectedDepartment={selectedDepartment}
            onDepartmentChange={(value) => setSelectedDepartment(value as Department)}
            jobs={jobs}
            jobsLoading={jobsLoading}
            onDeleteDocument={undefined}
            userRole={userRole}
            highlightToday={highlightToday}
            openHojaDeRutaJobId={openHojaDeRutaJobId}
            onHojaDeRutaOpened={handleHojaDeRutaOpened}
          />
        </CardContent>
      </Card>
    </div>

    {/* Floating Action Button for Create Job */}
    {canCreateItems && (
      <button
        onClick={() => openDialog({
          department: selectedDepartment,
          date: currentDate
        })}
        className="fixed bottom-20 right-6 md:bottom-8 md:right-8
                   w-12 h-12 md:w-14 md:h-14
                   bg-blue-600 hover:bg-blue-500
                   text-white rounded-full shadow-lg
                   flex items-center justify-center
                   transition-all hover:scale-110
                   z-50"
        aria-label="Create new job"
      >
        <Plus className="h-6 w-6" />
      </button>
    )}
    </div>
  );
};

export default ProjectManagement;
