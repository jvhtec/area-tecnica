import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { ChevronDown, Loader2, SlidersHorizontal, Users, X } from "lucide-react";
import { dataLayerClient } from "@/services/dataLayerClient";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MobileArtistList } from "@/components/festival/mobile/MobileArtistList";
import type { MobileArtistRiderFile } from "@/components/festival/mobile/MobileArtistCard";
import { FestivalOfflineControls } from "@/components/festival/FestivalOfflineControls";
import { Theme } from "./types";
import { createQueryKey } from "@/lib/optimized-react-query";
import { getFestivalSnapshot, isBrowserOnline } from "@/lib/offline";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { canEditJobs } from "@/utils/permissions";
import type { Tables } from "@/integrations/supabase/types";

type TechnicianArtistReadOnlyModalProps = {
  theme: Theme;
  isDark: boolean;
  job: {
    id: string;
    title?: string;
  };
  onClose: () => void;
};

type ReadOnlyArtist = {
  id: string;
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
  soundcheck: boolean;
  soundcheck_start?: string | null;
  soundcheck_end?: string | null;
  line_check?: boolean | null;
  line_check_start?: string | null;
  line_check_end?: string | null;
  load_in_time?: string | null;
  foh_console: string | null;
  foh_console_provided_by?: "festival" | "band" | "mixed" | null;
  foh_drive?: string | null;
  foh_drive_position?: string | null;
  mon_console: string | null;
  mon_console_provided_by?: "festival" | "band" | "mixed" | null;
  mon_position?: string | null;
  monitors_from_foh?: boolean | null;
  foh_waves_models?: any[] | null;
  foh_outboard?: string | null;
  mon_waves_models?: any[] | null;
  mon_outboard?: string | null;
  wireless_systems: any[];
  wireless_provided_by?: "festival" | "band" | "mixed" | null;
  iem_systems: any[];
  iem_provided_by?: "festival" | "band" | "mixed" | null;
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
  notes?: string | null;
  rider_missing?: boolean | null;
  foh_tech?: boolean | null;
  mon_tech?: boolean | null;
  isaftermidnight?: boolean | null;
  mic_kit?: "festival" | "band" | "mixed" | null;
  wired_mics?: Array<{ model: string; quantity: number; exclusive_use?: boolean; notes?: string }> | null;
  infra_cat6?: boolean | null;
  infra_cat6_quantity?: number | null;
  infra_hma?: boolean | null;
  infra_hma_quantity?: number | null;
  infra_coax?: boolean | null;
  infra_coax_quantity?: number | null;
  infra_opticalcon_duo?: boolean | null;
  infra_opticalcon_duo_quantity?: number | null;
  infra_analog?: number | null;
  other_infrastructure?: string | null;
  infrastructure_provided_by?: "festival" | "band" | "mixed" | null;
  artist_submitted?: boolean | null;
  stage_plot_file_path?: string | null;
  stage_plot_file_name?: string | null;
  stage_plot_file_type?: string | null;
  stage_plot_uploaded_at?: string | null;
};

type FestivalStage = {
  number: number;
  name: string;
};
type FestivalArtistRow = Tables<"festival_artists">;
type ReadOnlyWiredMic = NonNullable<ReadOnlyArtist["wired_mics"]>[number];

const NOOP = () => {};

const TIMEZONE = "Europe/Madrid";

const formatGroupDate = (date: string) => {
  try {
    const zonedDate = toZonedTime(parseISO(date), TIMEZONE);
    return format(zonedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  } catch {
    return date;
  }
};

const formatChipDate = (date: string) => {
  try {
    const zonedDate = toZonedTime(parseISO(date), TIMEZONE);
    return format(zonedDate, "EEE d MMM", { locale: es });
  } catch {
    return date;
  }
};

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const asMicKit = (value: string | null): ReadOnlyArtist["mic_kit"] =>
  value === "festival" || value === "band" || value === "mixed" ? value : null;

const mapRawToReadOnlyArtist = (artist: FestivalArtistRow): ReadOnlyArtist => ({
  ...artist,
  date: artist.date || "",
  show_start: artist.show_start || "",
  show_end: artist.show_end || "",
  soundcheck: Boolean(artist.soundcheck),
  foh_console: artist.foh_console || null,
  mon_console: artist.mon_console || null,
  foh_waves_models: asArray(artist.foh_waves_models),
  mon_waves_models: asArray(artist.mon_waves_models),
  wireless_systems: asArray(artist.wireless_systems),
  iem_systems: asArray(artist.iem_systems),
  monitors_enabled: Boolean(artist.monitors_enabled),
  monitors_quantity: artist.monitors_quantity || 0,
  extras_sf: Boolean(artist.extras_sf),
  extras_df: Boolean(artist.extras_df),
  extras_djbooth: Boolean(artist.extras_djbooth),
  mic_kit: asMicKit(artist.mic_kit),
  wired_mics: asArray<ReadOnlyWiredMic>(artist.wired_mics),
});

const sortReadOnlyArtists = (rows: ReadOnlyArtist[]): ReadOnlyArtist[] =>
  [...rows].sort((left, right) => {
    const leftDate = String(left.date || "");
    const rightDate = String(right.date || "");
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    return String(left.show_start || "").localeCompare(String(right.show_start || ""));
  });

const fetchOfflineReadOnlyArtists = async (jobId: string): Promise<ReadOnlyArtist[] | null> => {
  const snapshot = await getFestivalSnapshot(jobId);
  if (!snapshot) return null;
  return sortReadOnlyArtists(
    snapshot.data.artists.map((row) => mapRawToReadOnlyArtist(row as unknown as FestivalArtistRow)),
  );
};

export function TechnicianArtistReadOnlyModal({
  theme,
  isDark,
  job,
  onClose,
}: TechnicianArtistReadOnlyModalProps) {
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [stagePlotUrls, setStagePlotUrls] = useState<Record<string, string>>({});
  const [riderFilesByArtistId, setRiderFilesByArtistId] = useState<Record<string, MobileArtistRiderFile[]>>({});
  const { userRole } = useOptimizedAuth();

  const { data: artists = [], isLoading: artistsLoading } = useQuery({
    queryKey: createQueryKey.technician.technicianReadonlyArtists(job?.id),
    networkMode: "always", // the queryFn serves the offline snapshot when disconnected
    queryFn: async () => {
      if (!isBrowserOnline()) {
        const offlineArtists = await fetchOfflineReadOnlyArtists(job.id);
        if (offlineArtists) return offlineArtists;
        throw new Error("Sin conexión y sin copia offline de este festival");
      }

      try {
        const { data, error } = await dataLayerClient.from("festival_artists")
          .select("*")
          .eq("job_id", job?.id)
          .order("date", { ascending: true });

        if (error) throw error;
        return sortReadOnlyArtists((data || []).map(mapRawToReadOnlyArtist));
      } catch (fetchError) {
        // Network dropped mid-request: fall back to the offline copy if available
        const offlineArtists = await fetchOfflineReadOnlyArtists(job.id);
        if (offlineArtists) return offlineArtists;
        throw fetchError;
      }
    },
    enabled: !!job?.id,
  });

  const { data: festivalStages = [] } = useQuery({
    queryKey: createQueryKey.technician.technicianReadonlyFestivalStages(job?.id),
    networkMode: "always",
    queryFn: async () => {
      const readOfflineStages = async (): Promise<FestivalStage[] | null> => {
        const snapshot = await getFestivalSnapshot(job.id);
        if (!snapshot) return null;
        return snapshot.data.stages
          .filter((stage) => typeof stage.number === "number")
          .map((stage) => ({
            number: stage.number as number,
            name: (stage.name as string) ?? `Escenario ${stage.number as number}`,
          }));
      };

      if (!isBrowserOnline()) {
        return (await readOfflineStages()) ?? [];
      }

      const { data, error } = await dataLayerClient.from("festival_stages")
        .select("number, name")
        .eq("job_id", job?.id);
      if (error) {
        console.warn("TechnicianArtistReadOnlyModal: failed loading stage names", error);
        return (await readOfflineStages()) ?? [];
      }
      return (data || []) as FestivalStage[];
    },
    enabled: !!job?.id,
  });

  const stageNames = useMemo(() => {
    const names: Record<number, string> = {};
    festivalStages.forEach((stage) => {
      names[stage.number] = stage.name;
    });
    return names;
  }, [festivalStages]);

  useEffect(() => {
    let cancelled = false;

    const loadStagePlotUrls = async () => {
      const artistsWithPlot = artists.filter((artist) => Boolean(artist.stage_plot_file_path));

      // Signed URLs require a connection; binary files are not part of the
      // offline snapshot.
      if (artistsWithPlot.length === 0 || !isBrowserOnline()) {
        if (!cancelled) setStagePlotUrls({});
        return;
      }

      const nextUrls: Record<string, string> = {};
      await Promise.all(
        artistsWithPlot.map(async (artist) => {
          if (!artist.stage_plot_file_path) return;
          const { data, error } = await dataLayerClient.storage
            .from("festival_artist_files")
            .createSignedUrl(artist.stage_plot_file_path, 60 * 60);

          if (!error && data?.signedUrl) {
            nextUrls[artist.id] = data.signedUrl;
          }
        })
      );

      if (!cancelled) {
        setStagePlotUrls(nextUrls);
      }
    };

    void loadStagePlotUrls();

    return () => {
      cancelled = true;
    };
  }, [artists]);


  useEffect(() => {
    let cancelled = false;

    type RiderFileRow = {
      id: string;
      file_name: string;
      file_path: string;
      uploaded_at: string;
      artist_id: string | null;
    };

    const groupRiderFiles = (files: RiderFileRow[]) => {
      const grouped: Record<string, MobileArtistRiderFile[]> = {};
      files.forEach((file) => {
        if (!file.artist_id) return;
        if (!grouped[file.artist_id]) grouped[file.artist_id] = [];
        grouped[file.artist_id].push({
          id: file.id,
          file_name: file.file_name,
          file_path: file.file_path,
          uploaded_at: file.uploaded_at,
        });
      });
      return grouped;
    };

    const loadOfflineRiderFiles = async (): Promise<Record<string, MobileArtistRiderFile[]> | null> => {
      const snapshot = await getFestivalSnapshot(job.id);
      if (!snapshot) return null;
      const files = [...snapshot.data.artistFiles].sort((a, b) =>
        String(b.uploaded_at ?? "").localeCompare(String(a.uploaded_at ?? "")),
      );
      return groupRiderFiles(files as unknown as RiderFileRow[]);
    };

    const loadRiderFiles = async () => {
      const artistIds = artists.map((artist) => artist.id).filter(Boolean);
      if (artistIds.length === 0) {
        if (!cancelled) setRiderFilesByArtistId({});
        return;
      }

      if (!isBrowserOnline()) {
        const offlineFiles = await loadOfflineRiderFiles();
        if (!cancelled) setRiderFilesByArtistId(offlineFiles ?? {});
        return;
      }

      let query = dataLayerClient.from("festival_artist_files")
        .select("id, file_name, file_path, uploaded_at, artist_id")
        .order("uploaded_at", { ascending: false });

      if (artistIds.length === 1) {
        query = query.eq("artist_id", artistIds[0]);
      } else {
        const orExpr = artistIds.map((id) => `artist_id.eq.${id}`).join(",");
        query = query.or(orExpr);
      }

      const { data, error } = await query;
      if (error) {
        console.warn("TechnicianArtistReadOnlyModal: failed loading rider files", error);
        const offlineFiles = await loadOfflineRiderFiles();
        if (!cancelled) setRiderFilesByArtistId(offlineFiles ?? {});
        return;
      }

      if (!cancelled) setRiderFilesByArtistId(groupRiderFiles(data || []));
    };

    void loadRiderFiles();

    return () => {
      cancelled = true;
    };
  }, [artists, job.id]);

  const handleDownloadRiderFile = async (file: { file_path: string; file_name: string }) => {
    try {
      const { data, error } = await dataLayerClient.storage.from("festival_artist_files").download(file.file_path);
      if (error || !data) {
        toast.error("Error al descargar el archivo", { description: error?.message || "No se pudo obtener el archivo" });
        return;
      }
      const url = window.URL.createObjectURL(data);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = file.file_name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Error al descargar el archivo", { description: String(err) });
    }
  };

  const stageOptions = useMemo(() => {
    const uniqueStages = Array.from(new Set(artists.map((artist) => artist.stage)))
      .filter((stage): stage is number => typeof stage === "number")
      .sort((a, b) => a - b);

    return uniqueStages.map((stageNumber) => ({
      value: String(stageNumber),
      label: stageNames[stageNumber] || `Escenario ${stageNumber}`,
      count: artists.filter((artist) => artist.stage === stageNumber).length,
    }));
  }, [artists, stageNames]);

  const stageFilteredArtists = useMemo(() => {
    if (selectedStage === "all") return artists;
    return artists.filter((artist) => String(artist.stage) === selectedStage);
  }, [artists, selectedStage]);

  const dayOptions = useMemo(() => {
    const uniqueDates = Array.from(new Set(stageFilteredArtists.map((artist) => artist.date)))
      .filter((date): date is string => Boolean(date))
      .sort((a, b) => a.localeCompare(b));

    return uniqueDates.map((date) => ({
      value: date,
      label: formatChipDate(date),
      count: stageFilteredArtists.filter((artist) => artist.date === date).length,
    }));
  }, [stageFilteredArtists]);

  useEffect(() => {
    if (selectedDay === "all") return;
    if (!dayOptions.some((option) => option.value === selectedDay)) {
      setSelectedDay("all");
    }
  }, [dayOptions, selectedDay]);

  const filteredArtists = useMemo(() => {
    if (selectedDay === "all") return stageFilteredArtists;
    return stageFilteredArtists.filter((artist) => artist.date === selectedDay);
  }, [selectedDay, stageFilteredArtists]);

  const selectedStageLabel = useMemo(() => {
    if (selectedStage === "all") return "Todos los escenarios";
    return stageOptions.find((stage) => stage.value === selectedStage)?.label || "Escenario";
  }, [selectedStage, stageOptions]);

  const selectedDayLabel = useMemo(() => {
    if (selectedDay === "all") return "Todos los días";
    return dayOptions.find((day) => day.value === selectedDay)?.label || "Día";
  }, [selectedDay, dayOptions]);

  const artistsByDate = useMemo(() => {
    const byDate = new Map<string, ReadOnlyArtist[]>();
    filteredArtists.forEach((artist) => {
      if (!byDate.has(artist.date)) byDate.set(artist.date, []);
      byDate.get(artist.date)!.push(artist);
    });

    return Array.from(byDate.entries())
      .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
      .map(([date, dateArtists]) => ({
        date,
        artists: [...dateArtists].sort((left, right) =>
          (left.show_start || "").localeCompare(right.show_start || "")
        ),
      }));
  }, [filteredArtists]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${theme.modalOverlay} pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200`}
    >
      <div
        className={`w-full max-w-md md:max-w-lg lg:max-w-xl h-[85vh] supports-[height:1dvh]:h-[85dvh] max-h-full ${isDark ? "bg-[#0f1219]" : "bg-white"} rounded-2xl border ${theme.divider} shadow-2xl flex flex-col overflow-hidden overflow-x-hidden animate-in zoom-in-95 duration-200`}
      >
        <div className={`p-4 border-b ${theme.divider} flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2 min-w-0">
            <Users size={18} className={theme.textMuted} />
            <h2 className={`text-lg font-bold ${theme.textMain} truncate`}>
              Artistas · {job?.title || "Trabajo"}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <FestivalOfflineControls jobId={job?.id} canEdit={canEditJobs(userRole)} />
            <button
              onClick={onClose}
              className={`p-2 ${theme.textMuted} hover:${theme.textMain} rounded-full transition-colors`}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className={`px-4 py-3 border-b ${theme.divider} shrink-0`}>
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full rounded-lg border px-3 py-2.5 flex items-center justify-between gap-2 text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <SlidersHorizontal size={14} className={theme.textMuted} />
                  <div className="min-w-0">
                    <div className={`text-[11px] font-bold uppercase ${theme.textMuted}`}>Filtros</div>
                    <div className={`text-xs ${theme.textMain} truncate`}>
                      {selectedStageLabel} · {selectedDayLabel}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline">{filteredArtists.length} artistas</Badge>
                  <ChevronDown
                    size={16}
                    className={`${theme.textMuted} transition-transform ${filtersOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-3 space-y-3">
              <div>
                <div className={`text-xs font-bold uppercase ${theme.textMuted} mb-2`}>Escenarios</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedStage === "all" ? "default" : "outline"}
                    onClick={() => setSelectedStage("all")}
                    className="max-w-full"
                  >
                    Todos ({artists.length})
                  </Button>
                  {stageOptions.map((stage) => (
                    <Button
                      key={stage.value}
                      type="button"
                      size="sm"
                      variant={selectedStage === stage.value ? "default" : "outline"}
                      onClick={() => setSelectedStage(stage.value)}
                      className="max-w-full"
                    >
                      {stage.label} ({stage.count})
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <div className={`text-xs font-bold uppercase ${theme.textMuted} mb-2`}>Días</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedDay === "all" ? "default" : "outline"}
                    onClick={() => setSelectedDay("all")}
                    className="max-w-full"
                  >
                    Todos ({stageFilteredArtists.length})
                  </Button>
                  {dayOptions.map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      size="sm"
                      variant={selectedDay === day.value ? "default" : "outline"}
                      onClick={() => setSelectedDay(day.value)}
                      className="max-w-full"
                    >
                      {day.label} ({day.count})
                    </Button>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <ScrollArea className="flex-1 overflow-x-hidden">
          <div className="p-4 overflow-x-hidden">
          {artistsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : artistsByDate.length === 0 ? (
            <div className={`h-32 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
              <span className="text-xs">
                {artists.length === 0
                  ? "No hay artistas asociados a este trabajo"
                  : "No hay artistas para el escenario seleccionado"}
              </span>
            </div>
          ) : (
            <div className="space-y-6">
              {artistsByDate.map((group) => (
                <section key={group.date} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-bold ${theme.textMain}`}>
                      {formatGroupDate(group.date)}
                    </h3>
                    <Badge variant="outline">{group.artists.length}</Badge>
                  </div>
                  <MobileArtistList
                    artists={group.artists as any}
                    stageNames={stageNames}
                    stagePlotUrls={stagePlotUrls}
                    gearComparisons={{}}
                    jobId={job.id}
                    selectedDate={group.date}
                    onEditArtist={NOOP}
                    onDeleteArtist={NOOP}
                    onGenerateLink={NOOP}
                    onManageFiles={NOOP}
                    onPrintArtist={NOOP}
                    onOpenStagePlotCapture={NOOP}
                    onDeleteStagePlot={NOOP}
                    onArtistsChanged={NOOP}
                    printingArtistId={null}
                    deletingArtistId={null}
                    uploadingStagePlotArtistId={null}
                    deletingStagePlotArtistId={null}
                    onCreateFlexExtras={NOOP}
                    isCreatingExtrasFor={() => false}
                    mode="readonly"
                    riderFilesByArtistId={riderFilesByArtistId}
                    onDownloadRiderFile={handleDownloadRiderFile}
                    canDelete={false}
                    canCreateExtras={false}
                  />
                </section>
              ))}
            </div>
          )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
