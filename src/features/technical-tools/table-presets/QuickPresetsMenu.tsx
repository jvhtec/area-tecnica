import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bookmark, Download, Save, Trash2 } from "lucide-react";
import type { StageCopyableTable } from "./stageCopy";
import type { QuickPreset } from "./useQuickPresets";

export type QuickPresetsLabels = {
  button: string;
  heading: string;
  empty: string;
  tableCount: (count: number) => string;
  apply: string;
  deleteAction: string;
  saveCurrentHeading: string;
  namePlaceholder: string;
  saveAction: string;
};

/**
 * Popover listing the quick presets for a tool/department: apply one to the
 * current stage, delete one, or save the current table set under a new name.
 */
export const QuickPresetsMenu = <T extends StageCopyableTable>({
  labels,
  presets,
  canSaveCurrent,
  isSaving,
  onApply,
  onDelete,
  onSaveCurrent,
}: {
  labels: QuickPresetsLabels;
  presets: QuickPreset<T>[];
  /** Whether the current stage has tables worth saving. */
  canSaveCurrent: boolean;
  isSaving: boolean;
  onApply: (preset: QuickPreset<T>) => void;
  onDelete: (preset: QuickPreset<T>) => void;
  onSaveCurrent: (name: string) => Promise<boolean>;
}) => {
  const [open, setOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  const handleSave = async () => {
    const name = presetName.trim();
    if (!name) return;
    const saved = await onSaveCurrent(name);
    if (saved) setPresetName("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Bookmark className="h-4 w-4" />
          {labels.button}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold">{labels.heading}</p>
            {presets.length === 0 ? (
              <p className="text-sm text-muted-foreground">{labels.empty}</p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between gap-2 rounded border px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{preset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {labels.tableCount(preset.tables.length)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={labels.apply}
                        title={labels.apply}
                        onClick={() => {
                          onApply(preset);
                          setOpen(false);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label={labels.deleteAction}
                        title={labels.deleteAction}
                        onClick={() => onDelete(preset)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {canSaveCurrent && (
            <div className="border-t pt-3">
              <p className="mb-2 text-sm font-semibold">{labels.saveCurrentHeading}</p>
              <div className="flex gap-2">
                <Input
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                  placeholder={labels.namePlaceholder}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleSave();
                  }}
                />
                <Button
                  size="icon"
                  className="shrink-0"
                  aria-label={labels.saveAction}
                  title={labels.saveAction}
                  disabled={!presetName.trim() || isSaving}
                  onClick={() => void handleSave()}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
