import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, Loader2, Radio, SlidersHorizontal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

const HEADER_COLUMNS = [
  "Artista",
  "Esc.",
  "Horario",
  "RF Prov.",
  "Modelos RF",
  "Bandas RF",
  "Can RF",
  "HH",
  "BP",
  "IEM Prov.",
  "Modelos IEM",
  "Bandas IEM",
  "Can IEM",
  "BP IEM",
];

function getProviderBgClass(provider: string, isDark: boolean): string {
  const p = provider.toLowerCase();
  if (p === "festival") return isDark ? "bg-blue-900/30" : "bg-blue-50";
  if (p === "banda" || p === "band") return isDark ? "bg-orange-900/30" : "bg-orange-50";
  if (p === "mixto" || p === "mixed") return isDark ? "bg-gray-800/40" : "bg-gray-100";
  return "";
}

function getStageBgClass(stageNumber: number, isDark: boolean): string {
  const palette = isDark
    ? ["bg-blue-900/20", "bg-green-900/20", "bg-orange-900/20", "bg-purple-900/20", "bg-cyan-900/20"]
    : ["bg-blue-50", "bg-green-50", "bg-orange-50", "bg-purple-50", "bg-cyan-50"];
  if (stageNumber <= 0) return isDark ? "bg-gray-800/20" : "bg-gray-50";
  return palette[(stageNumber - 1) % palette.length];
}

function TokenizedText({ value, isDark }: { value: string; isDark: boolean }) {
  if (!hasProviderTextToken(value)) {
    return <span>{stripProviderTextTokens(value)}</span>;
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
                    ? isDark ? "text-blue-300" : "text-blue-700"
                    : seg.provider === "band"
                      ? isDark ? "text-orange-300" : "text-orange-700"
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

function buildRowData(artist: ArtistRfIemData) {
  const rfProvider = getProviderSummary(artist.wirelessSystems);
  const iemProvider = getProviderSummary(artist.iemSystems);
  const rfModels = formatModelWithCounts(artist.wirelessSystems);
  const rfBands = getUniqueFormattedBands(artist.wirelessSystems);
  const rfChannels = formatMetricBreakdownByProvider(artist.wirelessSystems, getRfSystemChannels);
  const rfHH = formatMetricBreakdownByProvider(artist.wirelessSystems, (sys) => sys.quantity_hh || 0);
  const rfBP = formatMetricBreakdownByProvider(artist.wirelessSystems, (sys) => sys.quantity_bp || 0);
  const iemModels = formatModelWithCounts(artist.iemSystems);
  const iemBands = getUniqueFormattedBands(artist.iemSystems);
  const iemChannels = formatMetricBreakdownByProvider(artist.iemSystems, (sys) => sys.quantity_hh || sys.quantity || 0);
  const iemBP = formatMetricBreakdownByProvider(artist.iemSystems, (sys) => sys.quantity_bp || 0);
  const schedule = `Show: ${formatTimeRange(artist.showStart, artist.showEnd)}\nSC: ${formatTimeRange(artist.soundcheckStart, artist.soundcheckEnd)}`;

  return {
    cells: [
      artist.name,
      `Esc. ${artist.stage}`,
      schedule,
      rfProvider,
      rfModels,
      rfBands,
      String(rfChannels),
      String(rfHH),
      String(rfBP),
      iemProvider,
      iemModels,
      iemBands,
      String(iemChannels),
      String(iemBP),
    ],
    rfProvider,
    iemProvider,
    stage: artist.stage,
  };
}

export function TechnicianRfTableModal({
  theme,
  isDark,
  job,
  onClose,
}: TechnicianRfTableModalProps) {
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

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
    festivalStages.forEach((s) => { names[s.number] = s.name; });
    return names;
  }, [festivalStages]);

  const normalizedArtists = useMemo(() => {
    return rawArtists
      .map((a: any) => normalizeRfIemArtistInput(a))
      .filter(hasRfIemContent);
  }, [rawArtists]);

  // Stage filter
  const stageFilteredArtists = useMemo(() => {
    if (selectedStage === "all") return normalizedArtists;
    return normalizedArtists.filter((a) => String(a.stage) === selectedStage);
  }, [normalizedArtists, selectedStage]);

  // Day groups
  const dayGroups = useMemo(() => groupArtistsByFestivalDay(stageFilteredArtists), [stageFilteredArtists]);

  // Filter by selected day
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

  const totalFilteredArtists = filteredDayGroups.reduce((sum, g) => sum + g.artists.length, 0);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${theme.modalOverlay} px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200`}
    >
      <div
        className={`w-full max-w-4xl h-[90vh] ${isDark ? "bg-[#0f1219]" : "bg-white"} rounded-2xl border ${theme.divider} shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200`}
      >
        {/* Header */}
        <div className={`p-4 border-b ${theme.divider} flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2 min-w-0">
            <Radio size={18} className={theme.textMuted} />
            <h2 className={`text-lg font-bold ${theme.textMain} truncate`}>
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

        {/* Filters */}
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
                      {selectedStage === "all" ? "Todos los escenarios" : stageOptions.find((s) => s.value === selectedStage)?.label || "Escenario"}{" "}
                      · {selectedDay === "all" ? "Todos los días" : dayOptions.find((d) => d.value === selectedDay)?.label || "Día"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline">{totalFilteredArtists} artistas</Badge>
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
                  <Button type="button" size="sm" variant={selectedStage === "all" ? "default" : "outline"} onClick={() => setSelectedStage("all")}>
                    Todos ({normalizedArtists.length})
                  </Button>
                  {stageOptions.map((s) => (
                    <Button key={s.value} type="button" size="sm" variant={selectedStage === s.value ? "default" : "outline"} onClick={() => setSelectedStage(s.value)}>
                      {s.label} ({s.count})
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <div className={`text-xs font-bold uppercase ${theme.textMuted} mb-2`}>Días</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant={selectedDay === "all" ? "default" : "outline"} onClick={() => setSelectedDay("all")}>
                    Todos ({stageFilteredArtists.length})
                  </Button>
                  {dayOptions.map((d) => (
                    <Button key={d.value} type="button" size="sm" variant={selectedDay === d.value ? "default" : "outline"} onClick={() => setSelectedDay(d.value)}>
                      {d.label} ({d.count})
                    </Button>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Table Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : filteredDayGroups.length === 0 ? (
              <div className={`h-32 border border-dashed ${theme.divider} rounded-xl flex flex-col items-center justify-center ${theme.textMuted}`}>
                <span className="text-xs">
                  {normalizedArtists.length === 0
                    ? "No hay datos RF/IEM para este trabajo"
                    : "No hay datos RF/IEM para el filtro seleccionado"}
                </span>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredDayGroups.map((group) => (
                  <section key={group.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-sm font-bold ${theme.textMain}`}>{group.label}</h3>
                      <Badge variant="outline">{group.artists.length}</Badge>
                    </div>
                    <div className="overflow-x-auto rounded-lg border ${theme.divider}">
                      <table className="min-w-[950px] w-full text-[11px]">
                        <thead>
                          <tr className={isDark ? "bg-red-900/60" : "bg-red-800"}>
                            {HEADER_COLUMNS.map((col, ci) => (
                              <th
                                key={ci}
                                className={`px-1.5 py-2 text-left text-white font-bold whitespace-nowrap ${ci === 0 ? "sticky left-0 z-10 " + (isDark ? "bg-red-900/90" : "bg-red-800") : ""}`}
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.artists.map((artist, ri) => {
                            const row = buildRowData(artist);
                            const stageBg = getStageBgClass(row.stage, isDark);
                            const rfBg = getProviderBgClass(row.rfProvider, isDark);
                            const iemBg = getProviderBgClass(row.iemProvider, isDark);

                            return (
                              <tr key={ri} className={`border-t ${isDark ? "border-gray-700/50" : "border-gray-200"}`}>
                                {row.cells.map((cell, ci) => {
                                  let bgClass = "";
                                  if (ci <= 2) bgClass = stageBg;
                                  else if (ci <= 8) bgClass = rfBg;
                                  else bgClass = iemBg;

                                  const isSticky = ci === 0;

                                  return (
                                    <td
                                      key={ci}
                                      className={`px-1.5 py-1.5 align-top whitespace-pre-line ${bgClass} ${theme.textMain} ${isSticky ? "sticky left-0 z-10 font-semibold" : ""}`}
                                    >
                                      <TokenizedText value={String(cell)} isDark={isDark} />
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
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
