/**
 * ShortcutableButton
 *
 * A wrapper component that makes any button shortcut-configurable.
 * Automatically registers the button action with the global shortcut system.
 *
 * Usage:
 * ```tsx
 * <ShortcutableButton
 *   shortcutId="refresh-data"
 *   shortcutLabel="Refresh Data"
 *   shortcutCategory="global"
 *   defaultKeybind="Ctrl+R"
 *   onClick={handleRefresh}
 * >
 *   <RefreshCw className="h-4 w-4" />
 *   Refresh
 * </ShortcutableButton>
 * ```
 */

import React, { useEffect } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { useShortcutStore, ShortcutCategory } from '@/stores/useShortcutStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface ShortcutableButtonProps extends ButtonProps {
  // Shortcut configuration
  shortcutId: string;
  shortcutLabel: string;
  shortcutCategory?: ShortcutCategory;
  shortcutDescription?: string;
  defaultKeybind?: string;
  requiresSelection?: boolean;

  // Show keybind hint in tooltip
  showKeybindHint?: boolean;

  // Children (button content)
  children: React.ReactNode;
}

export function ShortcutableButton({
  shortcutId,
  shortcutLabel,
  shortcutCategory = 'global',
  shortcutDescription,
  defaultKeybind,
  requiresSelection = false,
  showKeybindHint = true,
  children,
  onClick,
  ...buttonProps
}: ShortcutableButtonProps) {
  const { registerShortcut, unregisterShortcut, getShortcut } = useShortcutStore();

  // Register shortcut on mount
  useEffect(() => {
    if (!onClick) return;

    registerShortcut({
      id: shortcutId,
      category: shortcutCategory,
      label: shortcutLabel,
      description: shortcutDescription || `Ejecutar: ${shortcutLabel}`,
      defaultKeybind,
      requiresSelection,
      action: async () => {
        // Simulate a click event
        const syntheticEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }) as any;

        onClick(syntheticEvent);
      },
    });

    // Cleanup: unregister on unmount
    return () => {
      unregisterShortcut(shortcutId);
    };
  }, [
    shortcutId,
    shortcutCategory,
    shortcutLabel,
    shortcutDescription,
    defaultKeybind,
    requiresSelection,
    onClick,
    registerShortcut,
    unregisterShortcut,
  ]);

  // Get the current keybind for this shortcut
  const shortcut = getShortcut(shortcutId);
  const activeKeybind = shortcut?.customKeybind || shortcut?.defaultKeybind;

  const buttonContent = (
    <Button onClick={onClick} {...buttonProps}>
      {children}
    </Button>
  );

  // Show tooltip with keybind if available
  if (showKeybindHint && activeKeybind) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
          <TooltipContent>
            <div className="flex flex-col gap-1">
              <span className="font-medium">{shortcutLabel}</span>
              <span className="text-xs text-muted-foreground">
                Atajo: <kbd className="px-1 py-0.5 bg-muted rounded">{activeKeybind}</kbd>
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return buttonContent;
}
