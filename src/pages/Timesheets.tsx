import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Download, FileText } from "lucide-react";
import { TimesheetView } from "@/components/timesheet/TimesheetView";
import { downloadTimesheetPDF } from "@/utils/timesheet-pdf";
import { useOptimizedJobs } from "@/hooks/useOptimizedJobs";
import { useTimesheets } from "@/hooks/useTimesheets";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { useSearchParams } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Timesheets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const jobIdFromUrl = searchParams.get('jobId');
  const [selectedJobId, setSelectedJobId] = useState<string>(jobIdFromUrl || "");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const { user, userRole } = useAuth();
  const { data: jobs = [], isLoading: jobsLoading } = useOptimizedJobs();
  const { timesheets } = useTimesheets(selectedJobId || "", { userRole });

  const canManage = userRole === 'admin' || userRole === 'management';
  const canDownloadPDF = userRole === 'admin' || userRole === 'management';

  // Initialize department filter with user's department if available
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterTechnician, setFilterTechnician] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");

  useEffect(() => {
    if (user?.department && canManage) {
      // Normalize department casing if needed, or assume exact match
      const userDept = user.department;
      // We'll set it, validity will be checked by the Select options later or it just shows 'all' if not found
      // Actually, we should probably wait until departments are computed? 
      // But user.department is usually stable. Let me set it.
      // Wait, if I set it here, "all" select item might be tricky?
      // No, "all" is always an option.
      setFilterDepartment(userDept);
    }
  }, [user?.department, canManage]);

  useEffect(() => {
    if (jobIdFromUrl) {
      setSelectedJobId(jobIdFromUrl);
    }
  }, [jobIdFromUrl]);

  const relevantJobs = useMemo(() => {
    // Mirror sidebar filtering: exclude dry hire and tourdate; require any work dates if defined
    const filtered = jobs
      .filter(job => {
        const type = String(job.job_type || '').toLowerCase();
        const isDryHire = type === 'dryhire' || type === 'dry_hire';
        const isTourDate = type === 'tourdate';
        if (isDryHire || isTourDate) return false;
        if (Array.isArray(job.job_date_types) && job.job_date_types.length > 0) {
          return job.job_date_types.some((dt: any) => dt?.type !== 'off' && dt?.type !== 'travel');
        }
        return true;
      })
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    return filtered;
  }, [jobs]);

  const selectedJob = jobs.find(job => job.id === selectedJobId);
  const timesheetsDisabled = selectedJob && (selectedJob.job_type === 'dryhire' || selectedJob.job_type === 'tourdate');


  // Derived lists for filters
  const departments = useMemo(() => {
    if (!timesheets) return [];
    return Array.from(new Set(timesheets.map(t => t.technician?.department).filter(Boolean))).sort();
  }, [timesheets]);

  const technicians = useMemo(() => {
    if (!timesheets) return [];
    const techMap = new Map();
    timesheets.forEach(t => {
      if (t.technician) {
        techMap.set(t.technician.id, t.technician);
      }
    });
    return Array.from(techMap.values()).sort((a, b) =>
      (a.first_name || '').localeCompare(b.first_name || '')
    );
  }, [timesheets]);

  const availableDates = useMemo(() => {
    if (!timesheets) return [];
    const dates = new Set(timesheets.map(t => {
      // Handle potentially missing date fields or formatted timestamps
      // Assuming t.date is YYYY-MM-DD or t.start_time has date
      // The timesheet object usually has 'date' field or we check start_time
      // Looking at TimesheetView usage: timesheetsByDate puts them in YYYY-MM-DD buckets.
      // We can do similar or just extract from date field.
      // Let's use start_time as fallback
      if (t.date) return t.date;
      if (t.start_time) return t.start_time.split('T')[0];
      return null;
    }).filter(Boolean));
    return Array.from(dates).sort().reverse(); // Newest first
  }, [timesheets]);

  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
    // Reset filters when changing job
    // Reset filters when changing job
    // Keep department if it matches user? Or reset to user default?
    // Let's reset to "all" to avoid confusion, or user dept? 
    // Requirement: "default to their department" usually means on load. 
    // If they change job, maybe they want to see everything? 
    // I'll stick to resetting related filters but maybe re-apply user dept if intuitive? 
    // Let's reset to user department if available, else all.
    setFilterDepartment(user?.department && canManage ? user.department : "all");
    setFilterTechnician("all");
    setFilterDate("");

    // Preserve other params if any
    const next = new URLSearchParams(searchParams);
    if (jobId) next.set('jobId', jobId); else next.delete('jobId');
    setSearchParams(next, { replace: false });
  };

  const handleDownloadPDF = async () => {
    if (!selectedJob) return;

    // Use all timesheets for the job, not filtered by date
    if (timesheets.length === 0) {
      alert('No se encontraron partes de horas para este trabajo');
      return;
    }

    try {
      await downloadTimesheetPDF({
        job: selectedJob,
        timesheets: timesheets, // Use all timesheets
        date: "all-dates" // Indicate this covers all dates
      });
    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('No se pudo generar el PDF');
    }
  };

  if (jobsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground animate-spin mb-4" />
          <p className="text-muted-foreground">Cargando trabajos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Clock className="h-8 w-8" />
            Gestión de partes de horas
          </h1>
          <p className="text-muted-foreground">
            Gestiona partes de horas de los técnicos para los trabajos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-[240px]">
            <Select value={selectedJobId} onValueChange={handleJobSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un trabajo" />
              </SelectTrigger>
              <SelectContent>
                {relevantJobs.map(job => (
                  <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedJobId && canDownloadPDF && !timesheetsDisabled && (
            <>
              <Button
                onClick={handleDownloadPDF}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Descargar PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {!selectedJobId && !jobsLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Selecciona un trabajo para ver los partes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-sm">
              <Select value={selectedJobId} onValueChange={handleJobSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un trabajo" />
                </SelectTrigger>
                <SelectContent>
                  {relevantJobs.map(job => (
                    <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalles del trabajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-medium mb-2">{selectedJob.title}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Inicio</p>
                  <p>{format(new Date(selectedJob.start_time), 'PPP', { locale: es })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fin</p>
                  <p>{format(new Date(selectedJob.end_time), 'PPP', { locale: es })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipo</p>
                  <p className="capitalize">{selectedJob.job_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <p className="capitalize">{selectedJob.status || 'Activo'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {timesheetsDisabled && selectedJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Partes deshabilitados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                No se utilizan partes de horas para trabajos de tipo
                <span className="font-medium"> {selectedJob.job_type}</span>.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters Section - Only allow management to filter */}
      {selectedJobId && !timesheetsDisabled && canManage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Departamento</label>
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los departamentos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los departamentos</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Técnico</label>
                <Select value={filterTechnician} onValueChange={setFilterTechnician}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los técnicos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los técnicos</SelectItem>
                    {technicians.map(tech => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.first_name} {tech.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha</label>
                <label className="text-sm font-medium">Fecha</label>
                <Select value={filterDate} onValueChange={setFilterDate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las fechas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las fechas</SelectItem>
                    {availableDates.map(date => (
                      <SelectItem key={date as string} value={date as string}>
                        {format(new Date(date as string), "d 'de' MMMM", { locale: es })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedJobId && !timesheetsDisabled && (
        <TimesheetView
          jobId={selectedJobId}
          jobTitle={selectedJob?.title}
          canManage={canManage}
          filterDepartment={filterDepartment}
          filterTechnicianId={filterTechnician}
          filterDate={filterDate}
        />
      )}
    </div>
  );
}
