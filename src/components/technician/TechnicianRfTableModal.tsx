import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronDown,
  Headphones,
  Loader2,
  MapPin,
  Radio,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

type TechnicianRfTableModalProps = {
  theme: Theme;
  isDark: boolean;
  job: {
    id: string;
    title?: string;
  };
  onClose: () => void;
};

type FestivalStage = {
  number: number;
  name: string;
};

const formatChipDate = (date: string) => {
  try {
    return format(parseISO(date), "EEE d MMM", { locale: es });
  } catch {
    return date;
  }
};

// --- Tokenized text renderer for mixed-provider values ---

function TokenizedText({
  value,
  isDark,
}: {
  value: string;
  isDark: boolean;
}) {
  const clean = stripProviderTextTokens(value);
  if (!hasProviderTextToken(value)) {
    return <span>{clean || "—"}</span>;
  }
  const lines = value.split("\n");
  return (
    <span>
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
                    ? isDark
                      ? "text-blue-300"
                      : "text-blue-700"
                    : seg.provider === "band"
                      ? isDark
                        ? "text-orange-300"
                        : "text-orange-700"
                      : ""
                }
              >
                {seg.text}
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
}

// --- Detail row for card sections ---

function DetailRow({
  label,
  value,
  colorClass,
  isDark,
}: {
  label: string;
  value: string | number;
  colorClass: string;
  isDark: boolean;
}) {
  const strVal = String(value);
  const isEmpty = !strVal || strVal === "0" || strVal === "—";
  return (
    <div className="flex flex-col mb-2.5">
      <span
        className={`text-[10px] font-semibold ${colorClass} uppercase tracking-wide`}
      >
        {label}
      </span>
      <span className={`text-sm font-medium ${isDark ? "text-gray-200" : "text-gray-900"}`}>
        {isEmpty ? (
          "—"
        ) : hasProviderTextToken(strVal) ? (
          <TokenizedText value={strVal} isDark={isDark} />
        ) : (
          strVal
        )}
      </span>
    </div>
  );
}

// --- Artist expandable card ---

function ArtistRfCard({
  artist,
  stageName,
  theme,
  isDark,
}: {
  artist: ArtistRfIemData;
  stageName: string;
  theme: Theme;
  isDark: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const rfProvider = getProviderSummary(artist.wirelessSystems);
  const iemProvider = getProviderSummary(artist.iemSystems);
  const rfModels = formatModelWithCounts(artist.wirelessSystems);
  const rfBands = getUniqueFormattedBands(artist.wirelessSystems);
  const rfChannels = formatMetricBreakdownByProvider(
    artist.wirelessSystems,
    getRfSystemChannels
  );
  const rfHH = formatMetricBreakdownByProvider(
    artist.wirelessSystems,
    (sys) => sys.quantity_hh || 0
  );
  const rfBP = formatMetricBreakdownByProvider(
    artist.wirelessSystems,
    (sys) => sys.quantity_bp || 0
  );
  const iemModels = formatModelWithCounts(artist.iemSystems);
  const iemBands = getUniqueFormattedBands(artist.iemSystems);
  const iemChannels = formatMetricBreakdownByProvider(
    artist.iemSystems,
    (sys) => sys.quantity_hh || sys.quantity || 0
  );
  const iemBP = formatMetricBreakdownByProvider(
    artist.iemSystems,
    (sys) => sys.quantity_bp || 0
  );

  const totalRf = typeof rfChannels === "number" ? rfChannels : parseInt(String(rfChannels).match(/\((\d+)\)/)?.[1] || "0") || 0;
  const totalIem = typeof iemChannels === "number" ? iemChannels : parseInt(String(iemChannels).match(/\((\d+)\)/)?.[1] || "0") || 0;

  // Provider-based card border color
  const providerBorderClass = (() => {
    const mixed = rfProvider === "Mixto" || iemProvider === "Mixto";
    const hasBand = rfProvider === "Banda" || iemProvider === "Banda";
    if (mixed) return isDark ? "border-l-green-500" : "border-l-green-400";
    if (hasBand) return isDark ? "border-l-orange-500" : "border-l-orange-400";
    return isDark ? "border-l-blue-500" : "border-l-blue-400";
  })();

  return (
    <div
      className={`border-l-4 ${providerBorderClass} ${isDark ? "border-b border-gray-700/50" : "border-b border-gray-200"} overflow-hidden transition-all duration-200`}
    >
      {/* Card Header — always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-3.5 flex items-center justify-between gap-2 text-left ${isDark ? "active:bg-white/5" : "active:bg-gray-50/50"}`}
      >
        <div className="flex-1 min-w-0">
          <h3
            className={`text-base font-bold ${theme.textMain} truncate`}
          >
            {artist.name}
          </h3>
          <p
            className={`text-xs ${theme.textMuted} flex items-center gap-1 mt-0.5`}
          >
            <MapPin size={12} />
            {stageName} · Show: {artist.showStart || "—"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${isDark ? "bg-blue-900/40 text-blue-300" : "bg-blue-100 text-blue-800"}`}
          >
            <Radio size={13} /> {totalRf}
          </span>
          <span
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${isDark ? "bg-orange-900/40 text-orange-300" : "bg-orange-100 text-orange-800"}`}
          >
            <Headphones size={13} /> {totalIem}
          </span>
          <ChevronDown
            size={16}
            className={`${theme.textMuted} transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Expanded Details */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div
          className={`px-3.5 pb-4 pt-2 ${isDark ? "border-t border-dashed border-gray-600/50" : "border-t border-dashed border-gray-300"}`}
        >
          <div className="grid grid-cols-1 gap-3">
            {/* RF Section */}
            <div
              className={`p-3 rounded-xl border ${isDark ? "border-blue-800/50 bg-blue-950/30" : "border-blue-200 bg-blue-50/50"}`}
            >
              <h4
                className={`text-sm font-semibold flex items-center gap-1.5 mb-3 pb-2 border-b ${isDark ? "text-blue-300 border-blue-800/50" : "text-blue-900 border-blue-100"}`}
              >
                <Radio size={15} /> Radiofrecuencia (RF)
              </h4>
              <div className="grid grid-cols-2 gap-x-4">
                <DetailRow
                  label="Proveedor"
                  value={rfProvider}
                  colorClass={isDark ? "text-blue-400" : "text-blue-600"}
                  isDark={isDark}
                />
                <DetailRow
                  label="Total Canales"
                  value={String(rfChannels)}
                  colorClass={isDark ? "text-blue-400" : "text-blue-600"}
                  isDark={isDark}
                />
              </div>
              <DetailRow
                label="Modelos"
                value={rfModels}
                colorClass={isDark ? "text-blue-400" : "text-blue-600"}
                isDark={isDark}
              />
              <DetailRow
                label="Bandas"
                value={rfBands}
                colorClass={isDark ? "text-blue-400" : "text-blue-600"}
                isDark={isDark}
              />
              <DetailRow
                label="Equipos (HH / BP)"
                value={`${rfHH} HH / ${rfBP} BP`}
                colorClass={isDark ? "text-blue-400" : "text-blue-600"}
                isDark={isDark}
              />
            </div>

            {/* IEM Section */}
            <div
              className={`p-3 rounded-xl border ${isDark ? "border-orange-800/50 bg-orange-950/30" : "border-orange-200 bg-orange-50/50"}`}
            >
              <h4
                className={`text-sm font-semibold flex items-center gap-1.5 mb-3 pb-2 border-b ${isDark ? "text-orange-300 border-orange-800/50" : "text-orange-900 border-orange-100"}`}
              >
                <Headphones size={15} /> In-Ear Monitors (IEM)
              </h4>
              <div className="grid grid-cols-2 gap-x-4">
                <DetailRow
                  label="Proveedor"
                  value={iemProvider}
                  colorClass={isDark ? "text-orange-400" : "text-orange-600"}
                  isDark={isDark}
                />
                <DetailRow
                  label="Total Canales"
                  value={String(iemChannels)}
                  colorClass={isDark ? "text-orange-400" : "text-orange-600"}
                  isDark={isDark}
                />
              </div>
              <DetailRow
                label="Modelos"
                value={iemModels}
                colorClass={isDark ? "text-orange-400" : "text-orange-600"}
                isDark={isDark}
              />
              <DetailRow
                label="Bandas"
                value={iemBands}
                colorClass={isDark ? "text-orange-400" : "text-orange-600"}
                isDark={isDark}
              />
              <DetailRow
                label="Bodypacks IEM"
                value={String(iemBP)}
                colorClass={isDark ? "text-orange-400" : "text-orange-600"}
                isDark={isDark}
              />
            </div>

            {/* Schedule Section */}
            <div
              className={`grid grid-cols-2 gap-3`}
            >
              <div
                className={`p-2.5 rounded-lg text-center ${isDark ? "bg-gray-800/60" : "bg-gray-100"}`}
              >
                <p
                  className={`text-[10px] uppercase font-bold ${theme.textMuted}`}
                >
                  Soundcheck
                </p>
                <p
                  className={`text-sm font-medium ${theme.textMain} mt-0.5`}
                >
                  {formatTimeRange(artist.soundcheckStart, artist.soundcheckEnd)}
                </p>
              </div>
              <div
                className={`p-2.5 rounded-lg text-center ${isDark ? "bg-gray-800/60" : "bg-gray-100"}`}
              >
                <p
                  className={`text-[10px] uppercase font-bold ${theme.textMuted}`}
                >
                  Show
                </p>
                <p
                  className={`text-sm font-medium ${theme.textMain} mt-0.5`}
                >
                  {formatTimeRange(artist.showStart, artist.showEnd)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Modal ---

export function TechnicianRfTableModal({
  theme,
  isDark,
  job,
  onClose,
}: TechnicianRfTableModalProps) {
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: rawArtists = [], isLoading } = useQuery({
    queryKey: ["technician-rf-table-artists", job?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("festival_artists")
        .select("*")
        .eq("job_id", job.id)
        .order("date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!job?.id,
  });

  const { data: festivalStages = [] } = useQuery({
    queryKey: ["technician-rf-table-stages", job?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("festival_stages")
        .select("number, name")
        .eq("job_id", job.id);
      if (error) return [];
      return (data || []) as FestivalStage[];
    },
    enabled: !!job?.id,
  });

  const stageNames = useMemo(() => {
    const names: Record<number, string> = {};
    festivalStages.forEach((s) => {
      names[s.number] = s.name;
    });
    return names;
  }, [festivalStages]);

  const normalizedArtists = useMemo(() => {
    return rawArtists
      .map((a: any) => normalizeRfIemArtistInput(a))
      .filter(hasRfIemContent);
  }, [rawArtists]);

  // Search filter
  const searchFilteredArtists = useMemo(() => {
    if (!searchQuery.trim()) return normalizedArtists;
    const q = searchQuery.trim().toLowerCase();
    return normalizedArtists.filter((a) =>
      a.name.toLowerCase().includes(q)
    );
  }, [normalizedArtists, searchQuery]);

  // Stage filter
  const stageFilteredArtists = useMemo(() => {
    if (selectedStage === "all") return searchFilteredArtists;
    return searchFilteredArtists.filter(
      (a) => String(a.stage) === selectedStage
    );
  }, [searchFilteredArtists, selectedStage]);

  // Day groups
  const dayGroups = useMemo(
    () => groupArtistsByFestivalDay(stageFilteredArtists),
    [stageFilteredArtists]
  );

  // Filter by selected day
  const filteredDayGroups = useMemo(() => {
    if (selectedDay === "all") return dayGroups;
    return dayGroups.filter((g) => g.key === selectedDay);
  }, [dayGroups, selectedDay]);

  const stageOptions = useMemo(() => {
    const stages = Array.from(
      new Set(normalizedArtists.map((a) => a.stage))
    )
      .filter((s): s is number => typeof s === "number")
      .sort((a, b) => a - b);
    return stages.map((num) => ({
      value: String(num),
      label: stageNames[num] || `Escenario ${num}`,
      count: normalizedArtists.filter((a) => a.stage === num).length,
    }));
  }, [normalizedArtists, stageNames]);

  const dayOptions = useMemo(() => {
    return dayGroups.map((g) => ({
      value: g.key,
      label: formatChipDate(g.key),
      count: g.artists.length,
    }));
  }, [dayGroups]);

  useEffect(() => {
    if (selectedDay === "all") return;
    if (!dayOptions.some((o) => o.value === selectedDay)) {
      setSelectedDay("all");
    }
  }, [dayOptions, selectedDay]);

  const totalFilteredArtists = filteredDayGroups.reduce(
    (sum, g) => sum + g.artists.length,
    0
  );

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${theme.modalOverlay} px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200`}
    >
      <div
        className={`w-full max-w-lg h-[90vh] ${isDark ? "bg-[#0f1219]" : "bg-white"} rounded-2xl border ${theme.divider} shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200`}
      >
        {/* Header */}
        <div
          className={`p-4 border-b ${theme.divider} flex justify-between items-center shrink-0`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Radio size={18} className={theme.textMuted} />
            <h2
              className={`text-lg font-bold ${theme.textMain} truncate`}
            >
              RF / IEM · {job?.title || "Trabajo"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 ${theme.textMuted} hover:${theme.textMain} rounded-full transition-colors`}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className={`px-4 pt-3 shrink-0`}>
          <div className="relative">
            <Search
              size={15}
              className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.textMuted}`}
            />
            <input
              type="text"
              placeholder="Buscar artista..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 text-sm border rounded-full ${isDark ? "bg-gray-800/60 border-gray-700 text-gray-200 placeholder:text-gray-500" : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"} focus:outline-none focus:ring-2 ${isDark ? "focus:ring-blue-800" : "focus:ring-blue-100"}`}
            />
          </div>
        </div>

        {/* Filters */}
        <div className={`px-4 py-3 border-b ${theme.divider} shrink-0`}>
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={`w-full rounded-lg border px-3 py-2.5 flex items-center justify-between gap-2 text-left ${isDark ? "border-gray-700" : ""}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <SlidersHorizontal
                    size={14}
                    className={theme.textMuted}
                  />
                  <div className="min-w-0">
                    <div
                      className={`text-[11px] font-bold uppercase ${theme.textMuted}`}
                    >
                      Filtros
                    </div>
                    <div
                      className={`text-xs ${theme.textMain} truncate`}
                    >
                      {selectedStage === "all"
                        ? "Todos los escenarios"
                        : stageOptions.find(
                            (s) => s.value === selectedStage
                          )?.label || "Escenario"}{" "}
                      ·{" "}
                      {selectedDay === "all"
                        ? "Todos los días"
                        : dayOptions.find(
                            (d) => d.value === selectedDay
                          )?.label || "Día"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline">
                    {totalFilteredArtists}
                  </Badge>
                  <ChevronDown
                    size={16}
                    className={`${theme.textMuted} transition-transform ${filtersOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              <div>
                <div
                  className={`text-xs font-bold uppercase ${theme.textMuted} mb-2`}
                >
                  Escenarios
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      selectedStage === "all" ? "default" : "outline"
                    }
                    onClick={() => setSelectedStage("all")}
                  >
                    Todos ({normalizedArtists.length})
                  </Button>
                  {stageOptions.map((s) => (
                    <Button
                      key={s.value}
                      type="button"
                      size="sm"
                      variant={
                        selectedStage === s.value
                          ? "default"
                          : "outline"
                      }
                      onClick={() => setSelectedStage(s.value)}
                    >
                      {s.label} ({s.count})
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <div
                  className={`text-xs font-bold uppercase ${theme.textMuted} mb-2`}
                >
                  Días
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      selectedDay === "all" ? "default" : "outline"
                    }
                    onClick={() => setSelectedDay("all")}
                  >
                    Todos ({stageFilteredArtists.length})
                  </Button>
                  {dayOptions.map((d) => (
                    <Button
                      key={d.value}
                      type="button"
                      size="sm"
                      variant={
                        selectedDay === d.value
                          ? "default"
                          : "outline"
                      }
                      onClick={() => setSelectedDay(d.value)}
                    >
                      {d.label} ({d.count})
                    </Button>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Card List */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : filteredDayGroups.length === 0 ? (
              <div
                className={`h-32 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}
              >
                <Radio
                  size={28}
                  className={`mb-2 ${isDark ? "text-gray-600" : "text-gray-300"}`}
                />
                <span className="text-xs">
                  {normalizedArtists.length === 0
                    ? "No hay datos RF/IEM para este trabajo"
                    : "No hay artistas para el filtro seleccionado"}
                </span>
              </div>
            ) : (
              <div className="space-y-5">
                {filteredDayGroups.map((group) => (
                  <section key={group.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3
                        className={`text-sm font-bold ${theme.textMain}`}
                      >
                        {group.label}
                      </h3>
                      <Badge variant="outline">
                        {group.artists.length}
                      </Badge>
                    </div>
                    <div
                      className={`rounded-xl border overflow-hidden ${isDark ? "border-gray-700/50" : "border-gray-200"}`}
                    >
                      {group.artists.map((artist, ri) => (
                        <ArtistRfCard
                          key={ri}
                          artist={artist}
                          stageName={
                            stageNames[artist.stage] ||
                            `Escenario ${artist.stage}`
                          }
                          theme={theme}
                          isDark={isDark}
                        />
                      ))}
                    </div>
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
