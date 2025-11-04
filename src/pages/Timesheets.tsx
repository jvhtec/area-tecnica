import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Download, FileText } from "lucide-react";
import { TimesheetView } from "@/components/timesheet/TimesheetView";
import { downloadTimesheetPDF } from "@/utils/timesheet-pdf";
import { useOptimizedJobs } from "@/hooks/useOptimizedJobs";
import { useTimesheets } from "@/hooks/useTimesheets";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { useSearchParams } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Timesheets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const jobIdFromUrl = searchParams.get('jobId');
  const [selectedJobId, setSelectedJobId] = useState<string>(jobIdFromUrl || "");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const { user, userRole } = useOptimizedAuth();
  const { data: jobs = [], isLoading: jobsLoading } = useOptimizedJobs();
  const { timesheets } = useTimesheets(selectedJobId || "", { userRole });

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
  const canManage = userRole === 'admin' || userRole === 'management';
  const canDownloadPDF = userRole === 'admin' || userRole === 'management';

  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
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
    <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
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
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border rounded-md"
              />
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

      {selectedJobId && !timesheetsDisabled && (
        <TimesheetView
          jobId={selectedJobId}
          jobTitle={selectedJob?.title}
          canManage={canManage}
        />
      )}
    </div>
  );
}
