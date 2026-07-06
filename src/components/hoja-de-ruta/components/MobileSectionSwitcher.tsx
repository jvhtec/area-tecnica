import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ModernProgressTracker } from "./ModernProgressTracker";
import type { LucideIcon } from "lucide-react";

type TabOption = { id: string; label: string; icon: LucideIcon; color: string };

type MobileSectionSwitcherProps = {
  tabConfig: TabOption[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  progress: number;
  embedded: boolean;
};

// Replaces an 11-item horizontally-scrolling pill strip (no scroll affordance, never
// comfortably fit) with a single dropdown showing the active section.
export const MobileSectionSwitcher = ({
  tabConfig,
  activeTab,
  onTabChange,
  progress,
  embedded,
}: MobileSectionSwitcherProps) => {
  const current = tabConfig.find((tab) => tab.id === activeTab) ?? tabConfig[0];
  const CurrentIcon = current.icon;

  return (
    <div
      className={cn(
        "md:hidden -mx-4 px-4 mb-3 sticky z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/40 py-2 space-y-2",
        // When embedded, the page header lives outside the scroll region (flex `shrink-0`),
        // so this only needs to clear the scroll container's own top, not the header's height.
        embedded ? "top-0" : "top-[68px]"
      )}
    >
      <Select value={activeTab} onValueChange={onTabChange}>
        <SelectTrigger className="w-full h-11" aria-label="Seleccionar sección">
          <SelectValue>
            <span className="flex items-center gap-2">
              <CurrentIcon className={`w-4 h-4 ${current.color}`} />
              {current.label}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {tabConfig.map((tab) => {
            const Icon = tab.icon;
            return (
              <SelectItem key={tab.id} value={tab.id}>
                <span className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${tab.color}`} />
                  {tab.label}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <ModernProgressTracker progress={progress} />
    </div>
  );
};

export default MobileSectionSwitcher;
