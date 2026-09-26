import { useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Globe } from "lucide-react";
import type { HojaDeRutaTabOption } from "@/components/hoja-de-ruta/types";

type QuickNavigationSidebarProps = {
  tabConfig: HojaDeRutaTabOption[];
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
}: QuickNavigationSidebarProps) => {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusTabAt = (index: number) => {
    const wrapped = (index + tabConfig.length) % tabConfig.length;
    buttonRefs.current[wrapped]?.focus();
    onTabChange(tabConfig[wrapped].id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusTabAt(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusTabAt(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTabAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTabAt(tabConfig.length - 1);
    }
  };

  return (
  <div className="hidden md:block md:col-span-3">
    <div className={cn("sticky space-y-4", embedded ? "top-0" : "top-24")}>
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Navegación Rápida
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2" role="tablist" aria-label="Navegación rápida" aria-orientation="vertical">
          {tabConfig.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                ref={(el) => { buttonRefs.current[index] = el; }}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => onTabChange(tab.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className={`w-full justify-start ${isActive ? "bg-primary text-primary-foreground" : ""}`}
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
};

export default QuickNavigationSidebar;
