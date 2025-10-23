import React from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ToolHelpAccent = "default" | "sound" | "lights" | "video";

export interface ToolHelpOverlayProps {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  trigger?: React.ReactNode;
  accent?: ToolHelpAccent;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  align?: "start" | "center" | "end";
}

const accentIconClass: Record<ToolHelpAccent, string> = {
  default: "hover:bg-muted focus-visible:ring-primary",
  sound: "hover:bg-emerald-50 text-emerald-600 focus-visible:ring-emerald-500",
  lights: "hover:bg-amber-50 text-amber-600 focus-visible:ring-amber-500",
  video: "hover:bg-indigo-50 text-indigo-600 focus-visible:ring-indigo-500",
};

export const ToolHelpOverlay: React.FC<ToolHelpOverlayProps> = ({
  title,
  description,
  children,
  trigger,
  accent = "default",
  icon: Icon = CircleHelp,
  align = "center",
}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full text-muted-foreground transition-colors focus-visible:ring-2",
              accentIconClass[accent]
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="sr-only">Open help</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md" data-align={align}>
        <DialogHeader className="space-y-2">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children && (
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {children}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

ToolHelpOverlay.displayName = "ToolHelpOverlay";

export default ToolHelpOverlay;
