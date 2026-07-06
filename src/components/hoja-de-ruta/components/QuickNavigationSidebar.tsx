import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Globe } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type TabOption = { id: string; label: string; icon: LucideIcon; color: string };

type QuickNavigationSidebarProps = {
  tabConfig: TabOption[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  embedded: boolean;
};

// Desktop-only section nav (hidden on mobile, replaced by MobileSectionSwitcher).
export const QuickNavigationSidebar = ({
  tabConfig,
  activeTab,
  onTabChange,
  embedded,
}: QuickNavigationSidebarProps) => (
  <div className="hidden md:block md:col-span-3">
    <div className={cn("sticky space-y-4", embedded ? "top-0" : "top-24")}>
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Navegación Rápida
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tabConfig.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                size="sm"
                onClick={() => onTabChange(tab.id)}
                className={`w-full justify-start ${activeTab === tab.id ? "bg-primary text-primary-foreground" : ""}`}
              >
                <Icon className={`w-4 h-4 mr-2 ${tab.color}`} />
                {tab.label}
              </Button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  </div>
);

export default QuickNavigationSidebar;
