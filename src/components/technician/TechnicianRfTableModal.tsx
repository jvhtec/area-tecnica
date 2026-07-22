import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import {
  ChevronDown,
  Loader2,
  Radio,
  Search,
  X,
} from "lucide-react";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { createQueryKey } from "@/lib/optimized-react-query";
import {
  normalizeRfIemArtistInput,
  hasRfIemContent,
  groupArtistsByFestivalDay,
  getUniqueFormattedBands,
  type RawArtistLike,
} from "@/utils/rfIemTablePdfExport";
import { ArtistRfCard } from "@/components/technician/rf-table/ArtistRfCard";
import { Theme } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TechnicianRfTableModalProps = {
  theme: Theme;
  isDark: boolean;
  job: { id: string; title?: string };
  onClose: () => void;
};

type FestivalStage = { number: number; name: string };
type FestivalArtistRow = Tables<"festival_artists">;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIMEZONE = "Europe/Madrid";

const formatChipDate = (date: string) => {
  try {
    const zonedDate = toZonedTime(parseISO(date), TIMEZONE);
    return format(zonedDate, "EEE d MMM", { locale: es });
  } catch {
    return date;
  }
};


// ---------------------------------------------------------------------------
// Main Modal
// ---------------------------------------------------------------------------

export function TechnicianRfTableModal({
  theme,
  isDark,
  job,
  onClose,
}: TechnicianRfTableModalProps) {
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // --- Data fetching ---

  const {
    data: rawArtists = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: createQueryKey.technician.rfTableArtists(job?.id),
    queryFn: async () => {
      if (!job?.id) return [];
      const { data, error } = await dataLayerClient.from("festival_artists")
        .select("*")
        .eq("job_id", job?.id)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data || []) as FestivalArtistRow[];
    },
    enabled: !!job?.id,
  });

  const { data: festivalStages = [] } = useQuery({
    queryKey: createQueryKey.technician.rfTableStages(job?.id),
    queryFn: async () => {
      if (!job?.id) return [];
      const { data, error } = await dataLayerClient.from("festival_stages")
        .select("number, name")
        .eq("job_id", job?.id);
      if (error) return [];
      return (data || []) as FestivalStage[];
    },
    enabled: !!job?.id,
  });

  const stageNames = useMemo(() => {
    const names: Record<number, string> = {};
    festivalStages.forEach((s) => { names[s.number] = s.name; });
    return names;
  }, [festivalStages]);

  // --- Normalization & filtering ---

  const normalizedArtists = useMemo(
    () => rawArtists.map((a) => normalizeRfIemArtistInput(a as RawArtistLike)).filter(hasRfIemContent),
    [rawArtists]
  );

  const searchFilteredArtists = useMemo(() => {
    if (!searchQuery.trim()) return normalizedArtists;
    const q = searchQuery.trim().toLowerCase();
    return normalizedArtists.filter((a) => {
      // Search by artist name
      if (a.name.toLowerCase().includes(q)) return true;
      // Search by stage name or number
      const stageLabel = stageNames[a.stage]?.toLowerCase() || `escenario ${a.stage}`;
      if (stageLabel.includes(q)) return true;
      // Search by frequency bands
      const rfBands = getUniqueFormattedBands(a.wirelessSystems).toLowerCase();
      const iemBands = getUniqueFormattedBands(a.iemSystems).toLowerCase();
      if (rfBands.includes(q) || iemBands.includes(q)) return true;
      return false;
    });
  }, [normalizedArtists, searchQuery, stageNames]);

  const stageFilteredArtists = useMemo(() => {
    if (selectedStage === "all") return searchFilteredArtists;
    return searchFilteredArtists.filter((a) => String(a.stage) === selectedStage);
  }, [searchFilteredArtists, selectedStage]);

  const dayGroups = useMemo(() => groupArtistsByFestivalDay(stageFilteredArtists), [stageFilteredArtists]);

  const filteredDayGroups = useMemo(() => {
    if (selectedDay === "all") return dayGroups;
    return dayGroups.filter((g) => g.key === selectedDay);
  }, [dayGroups, selectedDay]);

  const stageOptions = useMemo(() => {
    const stages = Array.from(new Set(normalizedArtists.map((a) => a.stage)))
      .filter((s): s is number => typeof s === "number")
      .sort((a, b) => a - b);
    return stages.map((num) => ({
      value: String(num),
      label: stageNames[num] || `Escenario ${num}`,
      count: normalizedArtists.filter((a) => a.stage === num).length,
    }));
  }, [normalizedArtists, stageNames]);

  const dayOptions = useMemo(
    () => dayGroups.map((g) => ({ value: g.key, label: formatChipDate(g.key), count: g.artists.length })),
    [dayGroups]
  );

  useEffect(() => {
    if (selectedDay !== "all" && !dayOptions.some((o) => o.value === selectedDay)) {
      setSelectedDay("all");
    }
  }, [dayOptions, selectedDay]);

  const totalFilteredArtists = filteredDayGroups.reduce((sum, g) => sum + g.artists.length, 0);

  // --- Render ---

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={`w-[calc(100vw-1rem)] max-w-lg h-[92vh] rounded-2xl border shadow-2xl p-0 gap-0 overflow-hidden [&>button]:hidden ${
          isDark
            ? "bg-black border-zinc-800"
            : "bg-slate-50 border-slate-200"
        } ${theme.modalOverlay.includes("backdrop-blur") ? "backdrop-blur-sm" : ""}`}
      >
        <DialogTitle className="sr-only">
          {job?.title?.toUpperCase() || "RF / IEM"} · Resumen RF / IEM
        </DialogTitle>
        <div className="flex h-full flex-col">
        {/* Header */}
        <div
          className={`p-4 pb-3 flex justify-between items-center shrink-0 border-b ${
            isDark ? "border-zinc-800 bg-black/80" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isDark ? "bg-yellow-500" : "bg-blue-600"}`}>
              <Radio size={16} className={isDark ? "text-black" : "text-white"} />
            </div>
            <div className="min-w-0">
              <h1 className={`text-sm font-black tracking-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                {job?.title?.toUpperCase() || "RF / IEM"}
              </h1>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                  Resumen RF / IEM
                </span>
              </div>
            </div>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              className={`p-2 rounded-full transition-colors ${
                isDark ? "text-zinc-500 hover:text-white" : "text-slate-400 hover:text-slate-900"
              }`}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </DialogClose>
        </div>

        {/* Search */}
        <div className={`px-4 py-3 shrink-0 ${isDark ? "bg-black" : "bg-white"}`}>
          <div className="relative">
            <Search
              size={15}
              className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? "text-zinc-500" : "text-slate-400"}`}
            />
            <input
              type="text"
              placeholder="Buscar por artista, escenario o frecuencia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 text-xs rounded-xl outline-none transition-all ${
                isDark
                  ? "bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500/50"
                  : "bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              }`}
            />
          </div>
        </div>

        {/* Stage filter strip */}
        <div
          className={`flex px-4 gap-1.5 overflow-x-auto shrink-0 pb-2 ${
            isDark ? "bg-zinc-950 border-b border-zinc-900" : "bg-slate-50 border-b border-slate-100"
          }`}
          style={{ scrollbarWidth: "none" }}
        >
          <button
            onClick={() => setSelectedStage("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
              selectedStage === "all"
                ? isDark
                  ? "bg-zinc-800 text-white"
                  : "bg-slate-900 text-white"
                : isDark
                  ? "bg-zinc-900 text-zinc-500"
                  : "bg-white text-slate-500 border border-slate-200"
            }`}
          >
            Todos ({normalizedArtists.length})
          </button>
          {stageOptions.map((s) => (
            <button
              key={s.value}
              onClick={() => setSelectedStage(s.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                selectedStage === s.value
                  ? isDark
                    ? "bg-zinc-800 text-white"
                    : "bg-slate-900 text-white"
                  : isDark
                    ? "bg-zinc-900 text-zinc-500"
                    : "bg-white text-slate-500 border border-slate-200"
              }`}
            >
              {s.label.toUpperCase()} ({s.count})
            </button>
          ))}
        </div>

        {/* Day filter (collapsible, only shown when multiple days) */}
        {dayOptions.length > 1 && (
          <div className={`px-4 py-2 border-b shrink-0 ${isDark ? "border-zinc-900" : "border-slate-100"}`}>
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={`w-full rounded-lg border px-3 py-2 flex items-center justify-between gap-2 text-left ${
                    isDark ? "border-zinc-800" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[10px] font-bold uppercase ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                      Día:
                    </span>
                    <span className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {selectedDay === "all"
                        ? "Todos"
                        : dayOptions.find((d) => d.value === selectedDay)?.label || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline">{totalFilteredArtists}</Badge>
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${filtersOpen ? "rotate-180" : ""} ${isDark ? "text-zinc-500" : "text-slate-400"}`}
                    />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedDay === "all" ? "default" : "outline"}
                    onClick={() => setSelectedDay("all")}
                    className="text-xs"
                  >
                    Todos ({stageFilteredArtists.length})
                  </Button>
                  {dayOptions.map((d) => (
                    <Button
                      key={d.value}
                      type="button"
                      size="sm"
                      variant={selectedDay === d.value ? "default" : "outline"}
                      onClick={() => setSelectedDay(d.value)}
                      className="text-xs"
                    >
                      {d.label} ({d.count})
                    </Button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Card list */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : isError ? (
              <div
                className={`h-32 border border-dashed rounded-xl flex flex-col items-center justify-center ${
                  isDark ? "border-red-800 text-red-400" : "border-red-200 text-red-500"
                }`}
              >
                <Radio size={28} className="mb-2 opacity-40" />
                <span className="text-xs font-medium">Error al cargar datos RF/IEM</span>
                {error && <span className="text-[10px] mt-1 opacity-70">{String(error)}</span>}
              </div>
            ) : filteredDayGroups.length === 0 ? (
              <div
                className={`h-32 border border-dashed rounded-xl flex flex-col items-center justify-center ${
                  isDark ? "border-zinc-800 text-zinc-600" : "border-slate-200 text-slate-400"
                }`}
              >
                <Radio size={28} className="mb-2 opacity-40" />
                <span className="text-xs">
                  {normalizedArtists.length === 0
                    ? "No hay datos RF/IEM para este trabajo"
                    : "No hay artistas para el filtro seleccionado"}
                </span>
              </div>
            ) : (
              <div className="space-y-5">
                {filteredDayGroups.map((group) => (
                  <section key={group.key}>
                    {/* Day group divider */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`h-px flex-1 ${isDark ? "bg-zinc-800" : "bg-slate-200"}`} />
                      <span
                        className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                          isDark ? "text-zinc-600" : "text-slate-400"
                        }`}
                      >
                        {group.label}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {group.artists.length}
                      </Badge>
                      <div className={`h-px flex-1 ${isDark ? "bg-zinc-800" : "bg-slate-200"}`} />
                    </div>

                    {/* Artist cards */}
                    {group.artists.map((artist) => (
                      <ArtistRfCard
                        key={`${artist.id ?? artist.name}-${artist.stage}-${artist.showStart || "no-time"}`}
                        artist={artist}
                        stageName={stageNames[artist.stage] || `Escenario ${artist.stage}`}
                        isDark={isDark}
                      />
                    ))}
                  </section>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
