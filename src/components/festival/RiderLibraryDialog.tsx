import { useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays, FileText, FolderInput, Library, Loader2, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { ArtistMetadataHoverCard } from "@/components/festival/ArtistMetadataHoverCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { importArtistRiderToJob, getRiderImportErrorMessage } from "@/features/festival-management/commands";
import { fetchRiderLibrary } from "@/features/festival-management/queries";
import type { FestivalStageOption, RiderLibraryEntry } from "@/features/festival-management/types";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/react-query";

type RiderLibraryDialogProps = {
  canImport: boolean;
  initialDate?: string | null;
  jobDates: Date[];
  jobId: string;
  maxStages: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  stageOptions: FestivalStageOption[];
};

type ImportMutationInput = {
  entry: RiderLibraryEntry;
  targetDate: string;
  targetStage: number;
};

const ALL_SOURCE_JOBS_VALUE = "all";
const FESTIVAL_TIMEZONE = "Europe/Madrid";

const JOB_TYPE_LABELS: Record<string, string> = {
  ciclo: "Ciclo",
  dryhire: "Dry hire",
  evento: "Evento",
  festival: "Festival",
  single: "Trabajo único",
  tour: "Gira",
  tourdate: "Fecha de gira",
};

const formatDateValue = (date: Date) => formatInTimeZone(date, FESTIVAL_TIMEZONE, "yyyy-MM-dd");

const formatDisplayDate = (value?: string | null) => {
  if (!value) return "Sin fecha";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Sin fecha" : formatInTimeZone(parsed, FESTIVAL_TIMEZONE, "dd/MM/yyyy");
};

const formatUploadDate = (value?: string | null) => {
  if (!value) return "Sin fecha de subida";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin fecha de subida";

  return formatInTimeZone(parsed, FESTIVAL_TIMEZONE, "dd/MM/yy, HH:mm");
};

const formatFileSize = (value?: number | null) => {
  if (!value) return null;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const normalizeJobType = (value?: string | null) => {
  if (!value) return "Sin tipo";
  if (JOB_TYPE_LABELS[value]) return JOB_TYPE_LABELS[value];
  return value.replace(/_/g, " ");
};

const getSourceJobKey = (entry: RiderLibraryEntry) => entry.sourceJobId || `unlinked:${entry.sourceJobTitle}`;

export const RiderLibraryDialog = ({
  canImport,
  initialDate,
  jobDates,
  jobId,
  maxStages,
  onOpenChange,
  open,
  stageOptions,
}: RiderLibraryDialogProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [libraryMode, setLibraryMode] = useState<"browse" | "search">("browse");
  const [sourceJobFilter, setSourceJobFilter] = useState(ALL_SOURCE_JOBS_VALUE);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [stageByArtist, setStageByArtist] = useState<Record<string, string>>({});

  const dateOptions = useMemo(
    () => Array.from(new Set(jobDates.map(formatDateValue).filter(Boolean))),
    [jobDates],
  );
  const resolvedStageOptions = useMemo(() => {
    if (stageOptions.length > 0) return stageOptions;
    return Array.from({ length: Math.max(maxStages, 1) }, (_, index) => ({
      name: `Escenario ${index + 1}`,
      number: index + 1,
    }));
  }, [maxStages, stageOptions]);

  useEffect(() => {
    if (!open) return;

    setSearchTerm("");
    setSourceJobFilter(ALL_SOURCE_JOBS_VALUE);
    setLibraryMode("browse");
    setStageByArtist({});

    if (dateOptions.length === 1) {
      setSelectedDate(dateOptions[0]);
      return;
    }

    setSelectedDate(initialDate && dateOptions.includes(initialDate) ? initialDate : "");
  }, [dateOptions, initialDate, open]);

  const riderLibraryQuery = useQuery({
    queryKey: queryKeys.scope("rider-library", jobId),
    queryFn: () => fetchRiderLibrary(jobId),
    enabled: open && Boolean(jobId),
  });

  const importMutation = useMutation({
    mutationFn: async ({ entry, targetDate, targetStage }: ImportMutationInput) => {
      const result = await importArtistRiderToJob({
        sourceArtistId: entry.artistId,
        targetDate,
        targetJobId: jobId,
        targetStage,
      });
      return { entry, result, targetDate, targetStage };
    },
    onSuccess: async ({ entry, result, targetDate, targetStage }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("rider-library", jobId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("festival-artists", jobId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("festival-documents", jobId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("festival-job-details", jobId) }),
      ]);

      toast({
        title: "Rider importado",
        description: `${entry.artistName} importado a ${formatDisplayDate(targetDate)}, Escenario ${targetStage}. ${result.imported_file_count} archivo(s) referenciados.`,
        action: {
          label: "Abrir tabla",
          onClick: () => navigate(`/festival-management/${jobId}/artists?date=${targetDate}&stage=${targetStage}`),
        },
      });
    },
    onError: (error) => {
      toast({
        title: "No se pudo importar",
        description: getRiderImportErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const entries = useMemo(() => riderLibraryQuery.data ?? [], [riderLibraryQuery.data]);
  const sourceJobOptions = useMemo(() => {
    const options = new Map<
      string,
      {
        count: number;
        files: number;
        latestUploadedAt: string | null;
        sourceJobTitle: string;
        sourceJobType: string;
      }
    >();

    entries.forEach((entry) => {
      const key = getSourceJobKey(entry);
      const existing = options.get(key);
      const latestCandidate = entry.latestUploadedAt ? new Date(entry.latestUploadedAt).getTime() : 0;
      const latestExisting = existing?.latestUploadedAt ? new Date(existing.latestUploadedAt).getTime() : 0;

      if (!existing) {
        options.set(key, {
          count: 1,
          files: entry.files.length,
          latestUploadedAt: entry.latestUploadedAt,
          sourceJobTitle: entry.sourceJobTitle,
          sourceJobType: normalizeJobType(entry.sourceJobType),
        });
        return;
      }

      existing.count += 1;
      existing.files += entry.files.length;
      if (latestCandidate > latestExisting) {
        existing.latestUploadedAt = entry.latestUploadedAt;
      }
    });

    return Array.from(options.entries())
      .map(([value, option]) => ({ value, ...option }))
      .sort((a, b) => {
        const latestA = a.latestUploadedAt ? new Date(a.latestUploadedAt).getTime() : 0;
        const latestB = b.latestUploadedAt ? new Date(b.latestUploadedAt).getTime() : 0;
        return latestB - latestA || a.sourceJobTitle.localeCompare(b.sourceJobTitle);
      });
  }, [entries]);
  const totalFileCount = entries.reduce((total, entry) => total + entry.files.length, 0);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredEntries =
    libraryMode === "browse"
      ? entries.filter((entry) => sourceJobFilter === ALL_SOURCE_JOBS_VALUE || getSourceJobKey(entry) === sourceJobFilter)
      : normalizedSearch
        ? entries.filter((entry) => {
        const haystack = [
          entry.artistName,
          entry.sourceJobTitle,
          entry.sourceDate,
          entry.sourceStage ? `escenario ${entry.sourceStage} stage ${entry.sourceStage}` : "",
          ...entry.files.map((file) => file.file_name),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearch);
        })
        : entries;

  const defaultStageValueFor = (entry: RiderLibraryEntry) => {
    const sourceStage = entry.sourceStage ? String(entry.sourceStage) : "";
    if (sourceStage && resolvedStageOptions.some((option) => String(option.number) === sourceStage)) {
      return sourceStage;
    }

    return String(resolvedStageOptions[0]?.number ?? 1);
  };

  const getTargetStage = (entry: RiderLibraryEntry) => Number(stageByArtist[entry.artistId] || defaultStageValueFor(entry));

  const handleImport = (entry: RiderLibraryEntry) => {
    const targetStage = getTargetStage(entry);
    if (!selectedDate || !Number.isFinite(targetStage)) return;

    importMutation.mutate({
      entry,
      targetDate: selectedDate,
      targetStage,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Library className="h-5 w-5" />
            Biblioteca de Riders
          </DialogTitle>
          <DialogDescription>
            Importa riders existentes como copia técnica para este trabajo. Los riders importados se marcarán como desactualizados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 border-b px-5 py-4 md:grid-cols-[1fr_220px]">
          <div className="min-w-0">
            <Tabs value={libraryMode} onValueChange={(value) => setLibraryMode(value as "browse" | "search")}>
              <TabsList className="grid w-full grid-cols-2 sm:w-[260px]">
                <TabsTrigger value="browse" className="gap-2">
                  <Library className="h-4 w-4" />
                  Explorar
                </TabsTrigger>
                <TabsTrigger value="search" className="gap-2">
                  <Search className="h-4 w-4" />
                  Buscar
                </TabsTrigger>
              </TabsList>

              <TabsContent value="browse" className="mt-3 space-y-3">
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="rider-library-source-job">Trabajo origen</Label>
                    <Select value={sourceJobFilter} onValueChange={setSourceJobFilter}>
                      <SelectTrigger id="rider-library-source-job">
                        <SelectValue placeholder="Seleccionar trabajo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_SOURCE_JOBS_VALUE}>Todos los trabajos ({entries.length})</SelectItem>
                        {sourceJobOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.sourceJobTitle} ({option.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{entries.length} artistas</Badge>
                    <Badge variant="outline">{totalFileCount} archivos</Badge>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="search" className="mt-3 space-y-2">
                <Label htmlFor="rider-library-search">Buscar</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="rider-library-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Artista, trabajo o archivo"
                    className="pl-9"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rider-library-date">Fecha destino</Label>
            {dateOptions.length <= 1 ? (
              <div className="flex h-10 items-center rounded-md border px-3 text-sm">
                <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                {formatDisplayDate(dateOptions[0])}
              </div>
            ) : (
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger id="rider-library-date">
                  <SelectValue placeholder="Seleccionar fecha" />
                </SelectTrigger>
                <SelectContent>
                  {dateOptions.map((date) => (
                    <SelectItem key={date} value={date}>
                      {formatDisplayDate(date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 px-5 py-4">
            {riderLibraryQuery.isLoading ? (
              <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando biblioteca…
              </div>
            ) : riderLibraryQuery.isError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                No se pudo cargar la biblioteca de riders.
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                {entries.length === 0 ? "No hay riders disponibles en la biblioteca." : "No hay riders disponibles para los filtros actuales."}
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const selectedStage = String(getTargetStage(entry));
                const isStageValid = resolvedStageOptions.some((option) => String(option.number) === selectedStage);
                const isImporting = importMutation.isPending && importMutation.variables?.entry.artistId === entry.artistId;
                const importDisabled =
                  !canImport || !selectedDate || !isStageValid || entry.alreadyImported || importMutation.isPending;

                return (
                  <div key={entry.artistId} className="rounded-md border bg-background p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <ArtistMetadataHoverCard artistName={entry.artistName} canManage={canImport}>
                            <h3 className="w-fit max-w-full truncate text-base font-semibold">{entry.artistName}</h3>
                          </ArtistMetadataHoverCard>
                          {entry.alreadyImported ? (
                            <Badge variant="secondary">Ya referenciado</Badge>
                          ) : (
                            <Badge variant="outline">Último: {formatUploadDate(entry.latestUploadedAt)}</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{entry.sourceJobTitle}</span>
                          <span>{normalizeJobType(entry.sourceJobType)}</span>
                          <span>{formatDisplayDate(entry.sourceDate)}</span>
                          <span>Escenario {entry.sourceStage ?? "sin asignar"}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="w-full sm:w-36">
                          <Label className="mb-1 block text-xs">Escenario destino</Label>
                          {resolvedStageOptions.length <= 1 ? (
                            <div className="flex h-9 items-center rounded-md border px-3 text-sm">
                              {resolvedStageOptions[0]?.name ?? "Escenario 1"}
                            </div>
                          ) : (
                            <Select
                              value={selectedStage}
                              onValueChange={(value) =>
                                setStageByArtist((current) => ({ ...current, [entry.artistId]: value }))
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {resolvedStageOptions.map((option) => (
                                  <SelectItem key={option.number} value={String(option.number)}>
                                    {option.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <Button
                          onClick={() => handleImport(entry)}
                          disabled={importDisabled}
                          className="gap-2 sm:min-w-32"
                          size="sm"
                        >
                          {isImporting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FolderInput className="h-4 w-4" />
                          )}
                          Importar
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {entry.files.map((file) => {
                        const fileSize = formatFileSize(file.file_size);
                        const isDuplicate = entry.duplicateFilePaths.includes(file.file_path);
                        return (
                          <div
                            key={file.id}
                            className="flex flex-col gap-1 rounded-md bg-muted/40 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                              <span className="truncate font-medium">{file.file_name}</span>
                              {isDuplicate && <Badge variant="outline">Duplicado</Badge>}
                            </span>
                            <span className="flex-shrink-0 text-muted-foreground">
                              {formatUploadDate(file.uploaded_at)}
                              {fileSize ? ` · ${fileSize}` : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
