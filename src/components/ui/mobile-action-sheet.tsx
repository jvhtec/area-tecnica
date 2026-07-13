import type { LucideIcon } from "lucide-react";
import * as React from "react";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";

export interface MobileActionSheetAction {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
}

export interface MobileActionSheetGroup {
  id: string;
  label?: string;
  actions: MobileActionSheetAction[];
}

export interface MobileActionSheetProps {
  title: string;
  description?: string;
  groups: MobileActionSheetGroup[];
  trigger: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  contentClassName?: string;
  children?: React.ReactNode;
}

export const MobileActionSheet = ({
  title,
  description,
  groups,
  trigger,
  open,
  onOpenChange,
  contentClassName,
  children,
}: MobileActionSheetProps) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : internalOpen;

  const setOpen = React.useCallback((nextOpen: boolean) => {
    if (!isControlled) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }, [isControlled, onOpenChange]);

  const handleSelect = React.useCallback(async (
    action: MobileActionSheetAction,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    await action.onSelect(event);
    setOpen(false);
  }, [setOpen]);

  return (
    <ResponsiveDialog open={resolvedOpen} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>{trigger}</ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        className={cn("overflow-hidden pb-safe-bottom-3", contentClassName)}
      >
        <ResponsiveDialogHeader className="shrink-0 pr-12 text-left">
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          {description && (
            <ResponsiveDialogDescription>{description}</ResponsiveDialogDescription>
          )}
        </ResponsiveDialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">
          {groups.filter((group) => group.actions.length > 0).map((group) => (
            <section key={group.id} aria-label={group.label} className="space-y-1">
              {group.label && (
                <h3 className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h3>
              )}
              <div className="overflow-hidden rounded-xl border bg-card">
                {group.actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      disabled={action.disabled}
                      onClick={(event) => void handleSelect(action, event)}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent disabled:pointer-events-none disabled:opacity-50",
                        action.destructive && "text-destructive hover:bg-destructive/10",
                      )}
                    >
                      {Icon && <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />}
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{action.label}</span>
                        {action.description && (
                          <span className="block text-xs text-muted-foreground">
                            {action.description}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {children}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};
