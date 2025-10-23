import { useState } from "react";
import { Clock, Download, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";

interface TimesheetsHeaderJobOption {
  id: string;
  title: string;
}

interface TimesheetsHeaderProps {
  title?: string;
  subtitle?: string;
  jobs: TimesheetsHeaderJobOption[];
  selectedJobId: string;
  onSelectJob: (jobId: string) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  canDownloadPDF: boolean;
  onDownloadPDF: () => void;
  timesheetsDisabled?: boolean;
}

export function TimesheetsHeader({
  title = "Gestión de partes de horas",
  subtitle = "Gestiona partes de horas de los técnicos para los trabajos",
  jobs,
  selectedJobId,
  onSelectJob,
  selectedDate,
  onSelectDate,
  canDownloadPDF,
  onDownloadPDF,
  timesheetsDisabled = false,
}: TimesheetsHeaderProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const selectedJob = jobs.find((job) => job.id === selectedJobId);
  const showExportControls = Boolean(selectedJobId && canDownloadPDF && !timesheetsDisabled);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Clock className="h-8 w-8" />
            {title}
          </h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <div className="min-w-[240px]">
            <Select value={selectedJobId} onValueChange={onSelectJob}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un trabajo" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showExportControls && (
            <>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => onSelectDate(event.target.value)}
                className="px-3 py-2 border rounded-md"
              />
              <Button onClick={onDownloadPDF} variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Descargar PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="md:hidden">
        <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="truncate text-left">
                {selectedJob ? selectedJob.title : "Selecciona un trabajo"}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  isFiltersOpen ? "rotate-180" : ""
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Trabajo</Label>
              <Select value={selectedJobId} onValueChange={onSelectJob}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un trabajo" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showExportControls && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Fecha</Label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => onSelectDate(event.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <Button onClick={onDownloadPDF} variant="secondary" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Descargar PDF
                </Button>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

export default TimesheetsHeader;
