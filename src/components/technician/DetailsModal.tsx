import { Calendar as CalendarIcon, X } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";

import { DETAILS_MODAL_TABS } from "@/components/technician/details-modal/constants";
import {
  DocumentsTab,
  InfoTab,
  LocationTab,
  PersonnelTab,
  RestaurantsTab,
  TransportTab,
  WeatherTab,
} from "@/components/technician/details-modal/DetailsModalTabs";
import type { DetailsModalProps } from "@/components/technician/details-modal/types";
import { useDetailsModalData } from "@/components/technician/details-modal/useDetailsModalData";

export const DetailsModal = (props: DetailsModalProps) => {
  const vm = useDetailsModalData(props);
  const { activeTab, isDark, job, onClose, setActiveTab, theme } = vm;

  const renderActiveTab = () => {
    switch (activeTab) {
      case "Info":
        return <InfoTab vm={vm} />;
      case "Ubicación":
        return <LocationTab vm={vm} />;
      case "Transp.":
        return <TransportTab vm={vm} />;
      case "Personal":
        return <PersonnelTab vm={vm} />;
      case "Docs":
        return <DocumentsTab vm={vm} />;
      case "Restau.":
        return <RestaurantsTab vm={vm} />;
      case "Clima":
        return <WeatherTab vm={vm} />;
      default:
        return <InfoTab vm={vm} />;
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${theme.modalOverlay} px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200`}>
      <div className={`w-full max-w-md md:max-w-lg lg:max-w-xl h-[85vh] ${isDark ? "bg-[#0f1219]" : "bg-white"} rounded-2xl border ${theme.divider} shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200`}>
        <div className={`p-4 border-b ${theme.divider} flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2">
            <CalendarIcon size={18} className={theme.textMuted} />
            <h2 className={`text-lg font-bold ${theme.textMain}`}>{job?.title || "Sin título"}</h2>
          </div>
          <button onClick={onClose} className={`p-2 ${theme.textMuted} hover:${theme.textMain} rounded-full transition-colors`}>
            <X size={20} />
          </button>
        </div>

        <div className={`flex border-b ${theme.divider} ${isDark ? "bg-[#0a0c10]" : "bg-slate-50"} overflow-x-auto shrink-0`}>
          {DETAILS_MODAL_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors
                ${activeTab === tab.id
                  ? `${isDark ? "bg-[#151820]" : "bg-white"} ${theme.textMain} border-b-2 border-blue-500`
                  : `${theme.textMuted} hover:${theme.textMain}`}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1 p-5">
          {renderActiveTab()}
        </ScrollArea>
      </div>
    </div>
  );
};
