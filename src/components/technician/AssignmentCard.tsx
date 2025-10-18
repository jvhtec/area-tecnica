import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { formatInJobTimezone } from "@/utils/timezoneUtils";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import { RefreshCw, Clock, Eye, Download, FileText, ChevronDown, ChevronRight, Info, Dice5 } from "lucide-react";
import { TechnicianIncidentReportDialog } from "@/components/incident-reports/TechnicianIncidentReportDialog";
import { JobDetailsDialog } from "@/components/jobs/JobDetailsDialog";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { labelForCode } from '@/utils/roles';
import { createSignedUrl } from '@/utils/jobDocuments';
import { supabase } from '@/lib/supabase';
import { OBLIQUE_STRATEGIES } from "./obliqueStrategies";

type Assignment = any;

interface AssignmentCardProps {
  assignment: Assignment;
  techName?: string;
}

export const AssignmentCard = ({ assignment, techName = '' }: AssignmentCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [expandedDocuments, setExpandedDocuments] = useState<boolean>(false);
  const [documentLoading, setDocumentLoading] = useState<Set<string>>(new Set());
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [currentStrategyIndex, setCurrentStrategyIndex] = useState<number | null>(null);
  const [lastStrategyIndex, setLastStrategyIndex] = useState<number | null>(null);
  const [showSpanish, setShowSpanish] = useState(false);

  const assignmentCategory = assignment.category_assignment ?? assignment.category;

  const pickRandomStrategyIndex = () => {
    if (OBLIQUE_STRATEGIES.length === 0) {
      return null;
    }

    if (OBLIQUE_STRATEGIES.length === 1) {
      return 0;
    }

    let index = Math.floor(Math.random() * OBLIQUE_STRATEGIES.length);
    if (lastStrategyIndex !== null) {
      while (index === lastStrategyIndex) {
        index = Math.floor(Math.random() * OBLIQUE_STRATEGIES.length);
      }
    }
    return index;
  };

  const handleStrategyClick = () => {
    const nextIndex = pickRandomStrategyIndex();
    if (nextIndex === null) {
      return;
    }

    setCurrentStrategyIndex(nextIndex);
    setLastStrategyIndex(nextIndex);
    setShowSpanish(false);
    setStrategyOpen(true);
  };

  const currentStrategy =
    currentStrategyIndex !== null ? OBLIQUE_STRATEGIES[currentStrategyIndex] : null;

  const jobData = assignment.jobs || assignment.festival_jobs;
  if (!jobData) return null;

  const jobTimezone = jobData.timezone || 'Europe/Madrid';
  let formattedDate = "Fecha desconocida";
  try {
    if (jobData.start_time) {
      formattedDate = formatInTimeZone(new Date(jobData.start_time), jobTimezone, "PPP", { locale: es });
    } else if (jobData.day && jobData.festival?.start_date) {
      const festivalStart = new Date(jobData.festival.start_date);
      const eventDate = new Date(festivalStart);
      eventDate.setDate(festivalStart.getDate() + (parseInt(jobData.day) - 1));
      formattedDate = format(eventDate, "PPP", { locale: es });
    }
  } catch {}

  const isFestivalJob = !!assignment.festival_jobs;
  const location = isFestivalJob
    ? `${jobData.festival?.name || 'Festival'} - ${jobData.festival_stage?.name || 'Escenario'}`
    : jobData.location?.name || 'Sin ubicación';

  let role = "Técnico";
  if (isFestivalJob) {
    role = assignment.role || "Técnico";
  } else {
    if (assignment.sound_role) role = labelForCode(assignment.sound_role) || assignment.sound_role;
    else if (assignment.lights_role) role = labelForCode(assignment.lights_role) || assignment.lights_role;
    else if (assignment.video_role) role = labelForCode(assignment.video_role) || assignment.video_role;
  }

  const handleTimesheetClick = (jobId: string) => {
    navigate(`/timesheets?jobId=${jobId}`);
  };

  const handleViewDocument = async (doc: any) => {
    const docId = doc.id;
    setDocumentLoading(prev => new Set(prev).add(docId));
    try {
      const url = await createSignedUrl(supabase, doc.file_path, 60);
      window.open(url, '_blank');
    } catch (err: any) {
      toast({ title: 'Error', description: `No se pudo abrir el documento: ${err.message}`, variant: 'destructive' });
    } finally {
      setDocumentLoading(prev => { const s = new Set(prev); s.delete(docId); return s; });
    }
  };

  const handleDownload = async (doc: any) => {
    const docId = doc.id;
    setDocumentLoading(prev => new Set(prev).add(docId));
    try {
      const url = await createSignedUrl(supabase, doc.file_path, 60);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      toast({ title: 'Error', description: `No se pudo descargar el documento: ${err.message}`, variant: 'destructive' });
    } finally {
      setDocumentLoading(prev => { const s = new Set(prev); s.delete(docId); return s; });
    }
  };

  const bgColor = jobData.color ? `bg-[${jobData.color}] bg-opacity-10` : 'bg-card';

  return (
    <div className={`border rounded-lg p-4 ${bgColor} hover:bg-secondary/10 transition-colors`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold">{jobData.title || "Sin título"}</h3>
          <p className="text-sm text-muted-foreground">{location}</p>
          <p className="text-sm text-muted-foreground">{formattedDate}</p>
          {jobData.start_time && jobData.end_time && (
            <p className="text-sm text-muted-foreground">
              {formatInJobTimezone(jobData.start_time, "HH:mm", jobTimezone)} - {formatInJobTimezone(jobData.end_time, "HH:mm", jobTimezone)}
            </p>
          )}
          <div className="mt-2">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {role}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button onClick={() => setDetailsOpen(true)} variant="outline" size="sm" className="gap-2">
            <Info className="h-3 w-3" />
            Detalles
          </Button>

          {assignmentCategory === 'responsable' && (
            <Button
              onClick={handleStrategyClick}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Oblique Strategy"
              aria-label="Oblique Strategy"
            >
              <Dice5 className="h-4 w-4" />
            </Button>
          )}

          {jobData.job_type !== "dryhire" && jobData.job_type !== "tourdate" && (
            <Button onClick={() => handleTimesheetClick(jobData.id)} variant="outline" size="sm" className="gap-2">
              <Clock className="h-3 w-3" />
              Tiempos
            </Button>
          )}

          {jobData.job_type !== "dryhire" && (
            <TechnicianIncidentReportDialog job={jobData} techName={techName} labeled className="w-full" />
          )}

          {jobData.job_documents && jobData.job_documents.length > 0 && (
            <div className="flex flex-col gap-1">
              <Collapsible open={expandedDocuments} onOpenChange={() => setExpandedDocuments(!expandedDocuments)}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground">
                    <FileText className="h-3 w-3" />
                    {jobData.job_documents.length} documento{jobData.job_documents.length !== 1 ? 's' : ''}
                    {expandedDocuments ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 mt-1">
                  {jobData.job_documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between gap-2 p-2 bg-secondary/20 rounded text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{doc.file_name}</p>
                        <p className="text-muted-foreground text-xs">{doc.uploaded_at && format(new Date(doc.uploaded_at), "dd/MM/yyyy")}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button onClick={() => handleViewDocument(doc)} variant="ghost" size="sm" className="h-6 w-6 p-0" title={`Ver ${doc.file_name}`} disabled={documentLoading.has(doc.id)}>
                          {documentLoading.has(doc.id) ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button onClick={() => handleDownload(doc)} variant="ghost" size="sm" className="h-6 w-6 p-0" title={`Descargar ${doc.file_name}`} disabled={documentLoading.has(doc.id)}>
                          {documentLoading.has(doc.id) ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

        </div>
      </div>

      <JobDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} job={{ id: jobData.id }} />
      <Dialog open={strategyOpen} onOpenChange={setStrategyOpen}>
        <DialogContent className="space-y-4">
          <DialogHeader>
            <DialogTitle>Oblique Strategy</DialogTitle>
          </DialogHeader>
          {currentStrategy && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setShowSpanish((prev) => !prev)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setShowSpanish((prev) => !prev);
                }
              }}
              className="cursor-pointer select-none rounded-md bg-secondary/30 p-4 text-center text-base font-medium leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showSpanish ? currentStrategy.spanish : currentStrategy.english}
            </div>
          )}
          <DialogFooter className="text-xs text-muted-foreground">
            Oblique Strategies © 1975, 1978, 1979 Brian Eno/Peter Schmidt.
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
