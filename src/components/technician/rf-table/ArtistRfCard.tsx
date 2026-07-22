import { useState, type ElementType } from "react";
import { Activity, Clock, Headphones, Package, Radio, Wifi } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  formatMetricBreakdownByProvider,
  formatModelWithCounts,
  formatTimeRange,
  getUniqueFormattedBands,
  hasProviderTextToken,
  splitTokenizedSegments,
  stripProviderTextTokens,
  type ArtistRfIemData,
} from "@/utils/rfIemTablePdfExport";
import { summarizeArtistRfInventory } from "./artistRfMetrics";

interface ArtistRfCardProps {
  artist: ArtistRfIemData;
  stageName: string;
  isDark: boolean;
}

function TokenizedText({ value, isDark }: { value: string; isDark: boolean }) {
  const clean = stripProviderTextTokens(value);
  if (!hasProviderTextToken(value)) {
    return <>{clean || "—"}</>;
  }

  return (
    <>
      {value.split("\n").map((line, lineIndex) => (
        <span key={lineIndex}>
          {lineIndex > 0 && <br />}
          {splitTokenizedSegments(line).map((segment, segmentIndex) => (
            <span
              key={segmentIndex}
              className={
                segment.provider === "festival"
                  ? isDark ? "text-blue-400" : "text-blue-600"
                  : segment.provider === "band"
                    ? isDark ? "text-amber-400" : "text-amber-600"
                    : segment.provider === "mixed"
                      ? isDark ? "text-green-400" : "text-green-600"
                      : ""
              }
            >
              {segment.text}
            </span>
          ))}
        </span>
      ))}
    </>
  );
}

function InventoryBadge({
  label,
  count,
  icon: Icon,
  isDark,
}: {
  label: string;
  count: number;
  icon: ElementType;
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
        className={`text-xs font-bold uppercase tracking-tighter mt-0.5 ${
          isDark ? "text-zinc-500" : "text-slate-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function SpecRow({
  label,
  value,
  isDark,
}: {
  label: string;
  value: string | number;
  isDark: boolean;
}) {
  const stringValue = String(value);
  const isEmpty = !stringValue || stringValue === "0" || stringValue === "—";

  return (
    <div className={`flex justify-between items-start gap-4 pb-2 border-b ${isDark ? "border-zinc-800" : "border-slate-200"}`}>
      <span className={`text-xs font-medium shrink-0 ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
        {label}
      </span>
      <span className={`text-xs font-bold text-right ${isDark ? "text-white" : "text-slate-900"}`}>
        {isEmpty
          ? "—"
          : hasProviderTextToken(stringValue)
            ? <TokenizedText value={stringValue} isDark={isDark} />
            : stringValue}
      </span>
    </div>
  );
}

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
  const stringValue = String(value);
  const isEmpty = !stringValue || stringValue === "—" || stringValue === "-" || stringValue.trim() === "";

  return (
    <div className="flex flex-col gap-1">
      <span className={`text-xs font-bold uppercase ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
        {label}
      </span>
      <span className={`text-xs font-mono p-2 rounded border whitespace-pre-line ${accentBg} ${accentText} ${accentBorder}`}>
        {isEmpty
          ? "—"
          : hasProviderTextToken(stringValue)
            ? <TokenizedText value={stringValue} isDark={isDark} />
            : stringValue}
      </span>
    </div>
  );
}

export function ArtistRfCard({ artist, stageName, isDark }: ArtistRfCardProps) {
  const [expanded, setExpanded] = useState(false);
  const summary = summarizeArtistRfInventory(artist);
  const rfModels = formatModelWithCounts(artist.wirelessSystems);
  const rfBands = getUniqueFormattedBands(artist.wirelessSystems);
  const rfHh = formatMetricBreakdownByProvider(artist.wirelessSystems, (system) => system.quantity_hh || 0);
  const rfBp = formatMetricBreakdownByProvider(artist.wirelessSystems, (system) => system.quantity_bp || 0);
  const iemModels = formatModelWithCounts(artist.iemSystems);
  const iemBands = getUniqueFormattedBands(artist.iemSystems);
  const iemChannels = formatMetricBreakdownByProvider(artist.iemSystems, (system) => system.quantity_hh || system.quantity || 0);
  const iemBp = formatMetricBreakdownByProvider(artist.iemSystems, (system) => system.quantity_bp || 0);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className={`mb-3 transition-all duration-300 ${expanded ? (isDark ? "ring-2 ring-yellow-400/20" : "ring-2 ring-blue-400/20") : ""}`}>
        <div
          className={`overflow-hidden rounded-2xl shadow-xl relative ${
            isDark
              ? "bg-zinc-900 border border-zinc-800"
              : "bg-white border border-slate-200"
          }`}
        >
          <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ backgroundColor: summary.providerColor }} />

          <CollapsibleTrigger
            className="w-full text-left transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40"
          >
            <div className="p-4 pl-5">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs font-black px-1.5 py-0.5 rounded tracking-widest ${
                    isDark ? "bg-zinc-800 text-zinc-400" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {stageName.toUpperCase()}
                </span>
                <span
                  className="text-xs font-black px-1.5 py-0.5 rounded tracking-widest"
                  style={{
                    backgroundColor: `${summary.providerColor}22`,
                    color: summary.providerColor,
                  }}
                >
                  {summary.dominantProvider.toUpperCase()}
                </span>
              </div>

              <div className="flex justify-between items-end mb-3">
                <h2 className={`text-xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  {artist.name}
                </h2>
                <div className="text-right shrink-0 ml-3">
                  <p className={`text-xs font-bold uppercase ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                    Actuación
                  </p>
                  <p className={`text-lg font-black tracking-tighter ${isDark ? "text-white" : "text-slate-900"}`}>
                    {artist.showStart || "—"}
                  </p>
                </div>
              </div>

              <div className="flex gap-1.5">
                <InventoryBadge label="RF CH" count={summary.totalRf} icon={Radio} isDark={isDark} />
                <InventoryBadge label="IEM CH" count={summary.totalIem} icon={Headphones} isDark={isDark} />
                <InventoryBadge label="HH" count={summary.totalHh} icon={Wifi} isDark={isDark} />
                <InventoryBadge label="BP" count={summary.totalBp} icon={Package} isDark={isDark} />
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent
            forceMount
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
            >
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

              <div
                className={`flex items-center justify-between p-3 rounded-xl border ${
                  isDark
                    ? "bg-zinc-900/50 border-zinc-800"
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-blue-500" />
                  <span className={`text-xs font-bold ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
                    Actuación
                  </span>
                </div>
                <span className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                  {formatTimeRange(artist.showStart, artist.showEnd)}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={14} className="text-blue-500" />
                  <span className={`text-xs font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                    RF · {summary.rfProvider || "—"}
                  </span>
                </div>
                <div className="space-y-2">
                  <SpecRow label="Hardware" value={rfModels} isDark={isDark} />
                  <SpecRow label="Equipos" value={`${rfHh} HH / ${rfBp} BP`} isDark={isDark} />
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

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={14} className="text-purple-500" />
                  <span className={`text-xs font-black uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                    IEM · {summary.iemProvider || "—"}
                  </span>
                </div>
                <div className="space-y-2">
                  <SpecRow label="Sistemas" value={iemModels} isDark={isDark} />
                  <SpecRow label="Canales / BP" value={`${iemChannels} CH / ${iemBp} BP`} isDark={isDark} />
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
          </CollapsibleContent>
        </div>
      </div>
    </Collapsible>
  );
}
