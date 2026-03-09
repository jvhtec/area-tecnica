import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import {
  Activity,
  ChevronDown,
  Clock,
  Headphones,
  Loader2,
  Package,
  Radio,
  Search,
  Wifi,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { createQueryKey } from "@/lib/optimized-react-query";
import {
  normalizeRfIemArtistInput,
  hasRfIemContent,
  groupArtistsByFestivalDay,
  getProviderSummary,
  formatModelWithCounts,
  getUniqueFormattedBands,
  formatMetricBreakdownByProvider,
  formatTimeRange,
  getRfSystemChannels,
  hasProviderTextToken,
  splitTokenizedSegments,
  stripProviderTextTokens,
  type ArtistRfIemData,
} from "@/utils/rfIemTablePdfExport";
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


const computeTotalRfChannels = (artist: ArtistRfIemData): number => {
  return artist.wirelessSystems.reduce((sum, sys) => sum + getRfSystemChannels(sys), 0);
};

const computeTotalIemChannels = (artist: ArtistRfIemData): number => {
  return artist.iemSystems.reduce((sum, sys) => sum + (sys.quantity_hh || sys.quantity || 0), 0);
};

const computeTotalHH = (artist: ArtistRfIemData): number => {
  return artist.wirelessSystems.reduce((sum, sys) => sum + (sys.quantity_hh || 0), 0);
};

const computeTotalBP = (artist: ArtistRfIemData): number => {
  return artist.wirelessSystems.reduce((sum, sys) => sum + (sys.quantity_bp || 0), 0);
};

const getProviderColor = (provider: string): string => {
  const p = provider.toLowerCase();
  if (p === "festival") return "#3B82F6";
  if (p === "banda" || p === "band") return "#F59E0B";
  if (p === "mixto" || p === "mixed") return "#22C55E";
  return "#6B7280";
};

// ---------------------------------------------------------------------------
// TokenizedText — renders mixed-provider values with colored segments
// ---------------------------------------------------------------------------

function TokenizedText({ value, isDark }: { value: string; isDark: boolean }) {
  const clean = stripProviderTextTokens(value);
  if (!hasProviderTextToken(value)) {
    return <>{clean || "—"}</>;
  }
  const lines = value.split("\n");
  return (
    <>
      {lines.map((line, li) => {
        const segments = splitTokenizedSegments(line);
        return (
          <span key={li}>
            {li > 0 && <br />}
            {segments.map((seg, si) => (
              <span
                key={si}
                className={
                  seg.provider === "festival"
                    ? isDark ? "text-blue-400" : "text-blue-600"
                    : seg.provider === "band"
                      ? isDark ? "text-amber-400" : "text-amber-600"
                      : seg.provider === "mixed"
                        ? isDark ? "text-green-400" : "text-green-600"
                        : ""
                }
              >
                {seg.text}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// InventoryBadge — compact metric box for collapsed card header
// ---------------------------------------------------------------------------

function InventoryBadge({
  label,
  count,
  icon: Icon,
  isDark,
}: {
  label: string;
  count: number;
  icon: React.ElementType;
  isDark: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-lg p-1.5 min-w-[52px] ${
        isDark
          ? "bg-zinc-800/50 border border-zinc-700/50"
          : "bg-slate-100 border border-slate-200"
      }`}
    >
      <Icon size={11} className={isDark ? "text-zinc-500" : "text-slate-400"} />
      <span className={`text-base font-black leading-none mt-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>
        {count}
      </span>
      <span
        className={`text-[7px] font-bold uppercase tracking-tighter mt-0.5 ${
          isDark ? "text-zinc-500" : "text-slate-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpecRow — key/value row inside expanded spec sheet
// ---------------------------------------------------------------------------

function SpecRow({
  label,
  value,
  isDark,
}: {
  label: string;
  value: string | number;
  isDark: boolean;
}) {
  const strVal = String(value);
  const isEmpty = !strVal || strVal === "0" || strVal === "—";
  return (
    <div className={`flex justify-between items-start gap-4 pb-2 border-b ${isDark ? "border-zinc-800" : "border-slate-200"}`}>
      <span className={`text-xs font-medium shrink-0 ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
        {label}
      </span>
      <span className={`text-xs font-bold text-right ${isDark ? "text-white" : "text-slate-900"}`}>
        {isEmpty ? "—" : hasProviderTextToken(strVal) ? <TokenizedText value={strVal} isDark={isDark} /> : strVal}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FrequencyBox — monospace styled frequency band display
// ---------------------------------------------------------------------------

function FrequencyBox({
  label,
  value,
  accentBg,
  accentText,
  accentBorder,
  isDark,
}: {
  label: string;
  value: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  isDark: boolean;
}) {
  const strVal = String(value);
  const isEmpty = !strVal || strVal === "—" || strVal === "-" || strVal.trim() === "";
  return (
    <div className="flex flex-col gap-1">
      <span className={`text-[10px] font-bold uppercase ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
        {label}
      </span>
      <span className={`text-xs font-mono p-2 rounded border whitespace-pre-line ${accentBg} ${accentText} ${accentBorder}`}>
        {isEmpty ? "—" : hasProviderTextToken(strVal) ? <TokenizedText value={strVal} isDark={isDark} /> : strVal}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArtistRfCard — tactical expandable card per artist
// ---------------------------------------------------------------------------

function ArtistRfCard({
  artist,
  stageName,
  isDark,
}: {
  artist: ArtistRfIemData;
  stageName: string;
  isDark: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  // Compute all metrics using existing helpers
  const rfProvider = getProviderSummary(artist.wirelessSystems);
  const iemProvider = getProviderSummary(artist.iemSystems);
  const rfModels = formatModelWithCounts(artist.wirelessSystems);
  const rfBands = getUniqueFormattedBands(artist.wirelessSystems);
  const rfChannels = formatMetricBreakdownByProvider(artist.wirelessSystems, getRfSystemChannels);
  const rfHH = formatMetricBreakdownByProvider(artist.wirelessSystems, (s) => s.quantity_hh || 0);
  const rfBP = formatMetricBreakdownByProvider(artist.wirelessSystems, (s) => s.quantity_bp || 0);
  const iemModels = formatModelWithCounts(artist.iemSystems);
  const iemBands = getUniqueFormattedBands(artist.iemSystems);
  const iemChannels = formatMetricBreakdownByProvider(artist.iemSystems, (s) => s.quantity_hh || s.quantity || 0);
  const iemBP = formatMetricBreakdownByProvider(artist.iemSystems, (s) => s.quantity_bp || 0);

  // Direct calculation for totals (no regex parsing)
  const totalRf = computeTotalRfChannels(artist);
  const totalIem = computeTotalIemChannels(artist);
  const totalHH = computeTotalHH(artist);
  const totalBP = computeTotalBP(artist);

  // Pick a dominant provider to determine left bar color
  const dominantProvider = rfProvider || iemProvider || "Festival";
  const barColor = getProviderColor(dominantProvider);

  return (
    <div className={`mb-3 transition-all duration-300 ${expanded ? (isDark ? "ring-2 ring-yellow-400/20" : "ring-2 ring-blue-400/20") : ""}`}>
      <div
        className={`overflow-hidden rounded-2xl shadow-xl relative cursor-pointer transition-transform active:scale-[0.98] ${
          isDark
            ? "bg-zinc-900 border border-zinc-800"
            : "bg-white border border-slate-200"
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Left color bar */}
        <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ backgroundColor: barColor }} />

        {/* Card header — always visible */}
        <div className="p-4 pl-5">
          {/* Top row: stage chip + provider chip */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[10px] font-black px-1.5 py-0.5 rounded tracking-widest ${
                isDark ? "bg-zinc-800 text-zinc-400" : "bg-slate-100 text-slate-500"
              }`}
            >
              {stageName.toUpperCase()}
            </span>
            {dominantProvider && (
              <span
                className="text-[10px] font-black px-1.5 py-0.5 rounded tracking-widest"
                style={{
                  backgroundColor: `${barColor}22`,
                  color: barColor,
                }}
              >
                {dominantProvider.toUpperCase()}
              </span>
            )}
          </div>

          {/* Artist name + show time */}
          <div className="flex justify-between items-end mb-3">
            <h2 className={`text-xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              {artist.name}
            </h2>
            <div className="text-right shrink-0 ml-3">
              <p className={`text-[10px] font-bold uppercase ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                Actuación
              </p>
              <p className={`text-lg font-black tracking-tighter ${isDark ? "text-white" : "text-slate-900"}`}>
                {artist.showStart || "—"}
              </p>
            </div>
          </div>

          {/* Inventory badges row */}
          <div className="flex gap-1.5">
            <InventoryBadge label="RF CH" count={totalRf} icon={Radio} isDark={isDark} />
            <InventoryBadge label="IEM CH" count={totalIem} icon={Headphones} isDark={isDark} />
            <InventoryBadge label="HH" count={totalHH} icon={Wifi} isDark={isDark} />
            <InventoryBadge label="BP" count={totalBP} icon={Package} isDark={isDark} />
          </div>
        </div>

        {/* Expandable spec sheet */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            expanded ? "max-h-[800px]" : "max-h-0"
          }`}
        >
          <div
            className={`p-4 pl-5 space-y-4 ${
              isDark
                ? "border-t border-zinc-800 bg-zinc-950"
                : "border-t border-slate-200 bg-slate-50"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Soundcheck strip */}
            <div
              className={`flex items-center justify-between p-3 rounded-xl border ${
                isDark
                  ? "bg-zinc-900/50 border-zinc-800"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock size={14} className={isDark ? "text-yellow-500" : "text-amber-500"} />
                <span className={`text-xs font-bold ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
                  Soundcheck
                </span>
              </div>
              <span className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                {formatTimeRange(artist.soundcheckStart, artist.soundcheckEnd)}
              </span>
            </div>

            {/* Show time strip */}
            <div
              className={`flex items-center justify-between p-3 rounded-xl border ${
                isDark
                  ? "bg-zinc-900/50 border-zinc-800"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock size={14} className={isDark ? "text-blue-500" : "text-blue-500"} />
                <span className={`text-xs font-bold ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
                  Actuación
                </span>
              </div>
              <span className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                {formatTimeRange(artist.showStart, artist.showEnd)}
              </span>
            </div>

            {/* RF Section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Activity size={14} className="text-blue-500" />
                <span
                  className={`text-[10px] font-black uppercase tracking-widest ${
                    isDark ? "text-zinc-500" : "text-slate-400"
                  }`}
                >
                  RF · {rfProvider || "—"}
                </span>
              </div>
              <div className="space-y-2">
                <SpecRow label="Hardware" value={rfModels} isDark={isDark} />
                <SpecRow
                  label="Equipos"
                  value={`${rfHH} HH / ${rfBP} BP`}
                  isDark={isDark}
                />
                <FrequencyBox
                  label="Espectro de frecuencia"
                  value={rfBands}
                  accentBg={isDark ? "bg-blue-500/10" : "bg-blue-50"}
                  accentText={isDark ? "text-blue-400" : "text-blue-700"}
                  accentBorder={isDark ? "border-blue-500/20" : "border-blue-200"}
                  isDark={isDark}
                />
              </div>
            </div>

            {/* IEM Section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Activity size={14} className="text-purple-500" />
                <span
                  className={`text-[10px] font-black uppercase tracking-widest ${
                    isDark ? "text-zinc-500" : "text-slate-400"
                  }`}
                >
                  IEM · {iemProvider || "—"}
                </span>
              </div>
              <div className="space-y-2">
                <SpecRow label="Sistemas" value={iemModels} isDark={isDark} />
                <SpecRow
                  label="Canales / BP"
                  value={`${iemChannels} CH / ${iemBP} BP`}
                  isDark={isDark}
                />
                <FrequencyBox
                  label="Bandas asignadas"
                  value={iemBands}
                  accentBg={isDark ? "bg-purple-500/10" : "bg-purple-50"}
                  accentText={isDark ? "text-purple-400" : "text-purple-700"}
                  accentBorder={isDark ? "border-purple-500/20" : "border-purple-200"}
                  isDark={isDark}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  // --- Keyboard handler: Escape to close ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
      const { data, error } = await supabase
        .from("festival_artists")
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
      const { data, error } = await supabase
        .from("festival_stages")
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
    () => rawArtists.map((a) => normalizeRfIemArtistInput(a)).filter(hasRfIemContent),
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
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${theme.modalOverlay} px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200`}
    >
      <div
        className={`w-full max-w-lg h-[92vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ${
          isDark
            ? "bg-black border-zinc-800"
            : "bg-slate-50 border-slate-200"
        }`}
      >
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
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${
              isDark ? "text-zinc-500 hover:text-white" : "text-slate-400 hover:text-slate-900"
            }`}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
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
            TODOS ({normalizedArtists.length})
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
    </div>
  );
}
