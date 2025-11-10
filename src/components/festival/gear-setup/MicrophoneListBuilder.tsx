import React, { useState, useMemo } from 'react';
import { Search, Trash2, Plus, Minus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface WiredMic {
  model: string;
  quantity: number;
  exclusive_use?: boolean;
  notes?: string;
}

interface MicrophoneListBuilderProps {
  value: WiredMic[];
  onChange: (mics: WiredMic[]) => void;
  availableMics: string[];
  readOnly?: boolean;
  className?: string;
  showExclusiveUse?: boolean;
  showNotes?: boolean;
}

export const MicrophoneListBuilder: React.FC<MicrophoneListBuilderProps> = ({
  value = [],
  onChange,
  availableMics = [],
  readOnly = false,
  className = '',
  showExclusiveUse = true,
  showNotes = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [editingModel, setEditingModel] = useState<string | null>(null);

  // Filter available mics based on search
  const filteredMics = useMemo(() => {
    if (!searchQuery.trim()) return availableMics;
    const query = searchQuery.toLowerCase();
    return availableMics.filter(mic =>
      mic.toLowerCase().includes(query)
    );
  }, [availableMics, searchQuery]);

  // Get count for each model
  const getCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    value.forEach(mic => {
      counts[mic.model] = (counts[mic.model] || 0) + mic.quantity;
    });
    return counts;
  }, [value]);

  // Get total count
  const totalCount = useMemo(() => {
    return value.reduce((sum, mic) => sum + mic.quantity, 0);
  }, [value]);

  // Get summary (aggregated view)
  const summary = useMemo(() => {
    const summaryMap: Record<string, { quantity: number; exclusive: boolean }> = {};
    value.forEach(mic => {
      if (summaryMap[mic.model]) {
        summaryMap[mic.model].quantity += mic.quantity;
        summaryMap[mic.model].exclusive = summaryMap[mic.model].exclusive || !!mic.exclusive_use;
      } else {
        summaryMap[mic.model] = {
          quantity: mic.quantity,
          exclusive: !!mic.exclusive_use,
        };
      }
    });
    return Object.entries(summaryMap)
      .map(([model, data]) => ({ model, ...data }))
      .sort((a, b) => a.model.localeCompare(b.model));
  }, [value]);

  // Add a microphone (increment quantity or add new)
  const addMicrophone = (model: string) => {
    if (readOnly) return;

    const existingIndex = value.findIndex(mic => mic.model === model);
    if (existingIndex >= 0) {
      const updated = [...value];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + 1,
      };
      onChange(updated);
    } else {
      onChange([...value, { model, quantity: 1 }]);
    }
  };

  // Remove one unit of a microphone
  const removeMicrophone = (model: string) => {
    if (readOnly) return;

    const existingIndex = value.findIndex(mic => mic.model === model);
    if (existingIndex >= 0) {
      const updated = [...value];
      if (updated[existingIndex].quantity > 1) {
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity - 1,
        };
      } else {
        updated.splice(existingIndex, 1);
      }
      onChange(updated);
    }
  };

  // Remove all units of a model
  const removeAllOfModel = (model: string) => {
    if (readOnly) return;
    onChange(value.filter(mic => mic.model !== model));
  };

  // Update microphone details (exclusive use, notes)
  const updateMicDetails = (model: string, updates: Partial<WiredMic>) => {
    if (readOnly) return;

    const updated = value.map(mic =>
      mic.model === model
        ? { ...mic, ...updates }
        : mic
    );
    onChange(updated);
  };

  // Clear all
  const clearAll = () => {
    if (readOnly) return;
    onChange([]);
    setShowClearDialog(false);
  };

  // Expand quantities into individual entry cards for display
  const expandedEntries = useMemo(() => {
    const entries: Array<{ model: string; index: number; total: number }> = [];
    value.forEach(mic => {
      for (let i = 0; i < mic.quantity; i++) {
        entries.push({ model: mic.model, index: i, total: mic.quantity });
      }
    });
    return entries;
  }, [value]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search Bar */}
      <div className="relative">
        <Label htmlFor="mic-search" className="sr-only">
          Search microphones
        </Label>
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
        <Input
          id="mic-search"
          type="text"
          placeholder="Search microphones..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          disabled={readOnly}
          aria-label="Search available microphones"
          aria-describedby="mic-search-description"
        />
        <span id="mic-search-description" className="sr-only">
          Type to filter the list of available microphones. Current total: {totalCount} microphones.
        </span>
      </div>

      {/* Tally Grid */}
      <div role="region" aria-label="Available microphones">
        <div className="flex justify-between items-center mb-3">
          <Label className="text-sm font-semibold" id="tally-grid-label">
            Available Microphones
          </Label>
          <span className="text-sm text-gray-500 dark:text-gray-400" aria-live="polite" aria-atomic="true">
            Click to add • Total: {totalCount}
          </span>
        </div>
        <div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2"
          role="group"
          aria-labelledby="tally-grid-label"
        >
          {filteredMics.map(mic => {
            const count = getCounts[mic] || 0;
            return (
              <Button
                key={mic}
                type="button"
                variant={count > 0 ? 'default' : 'outline'}
                className="relative h-auto py-3 px-4 text-left justify-start"
                onClick={() => addMicrophone(mic)}
                disabled={readOnly}
                aria-label={`Add ${mic}${count > 0 ? `, currently ${count} in list` : ''}`}
                aria-pressed={count > 0}
              >
                <span className="text-sm truncate flex-1">{mic}</span>
                {count > 0 && (
                  <span
                    className="ml-2 bg-white dark:bg-gray-800 text-primary dark:text-primary-foreground font-bold px-2 py-0.5 rounded-full text-xs"
                    aria-label={`${count} units`}
                  >
                    {count}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
        {filteredMics.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400" role="status">
            No microphones found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Entry List */}
      {expandedEntries.length > 0 && (
        <div role="region" aria-label="Microphone entries">
          <div className="flex justify-between items-center mb-3">
            <Label className="text-sm font-semibold" id="entries-label">
              Entries ({expandedEntries.length})
            </Label>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowClearDialog(true)}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                aria-label={`Clear all ${expandedEntries.length} microphone entries`}
              >
                <Trash2 className="h-4 w-4 mr-1" aria-hidden="true" />
                Clear All
              </Button>
            )}
          </div>
          <div
            className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-3 bg-gray-50 dark:bg-gray-900"
            role="list"
            aria-labelledby="entries-label"
          >
            {expandedEntries.map((entry, idx) => (
              <div
                key={`${entry.model}-${idx}`}
                className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded border"
                role="listitem"
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm font-medium">{entry.model}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400" aria-label={`Entry ${entry.index + 1} of ${entry.total}`}>
                    ({entry.index + 1} of {entry.total})
                  </span>
                </div>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMicrophone(entry.model)}
                    className="h-8 w-8 p-0"
                    aria-label={`Remove one ${entry.model} microphone`}
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Panel */}
      {summary.length > 0 && (
        <div role="region" aria-label="Microphone summary">
          <Label className="text-sm font-semibold mb-3 block" id="summary-label">
            Summary
          </Label>
          <div className="space-y-2 border rounded-lg p-4 bg-blue-50 dark:bg-blue-950" role="list" aria-labelledby="summary-label">
            {summary.map(item => {
              const micData = value.find(m => m.model === item.model);
              return (
                <div key={item.model} className="space-y-3" role="listitem">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.model}</span>
                        {item.exclusive && (
                          <span
                            className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded"
                            role="status"
                            aria-label="Exclusive use required"
                          >
                            Exclusive
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-lg font-bold text-blue-600 dark:text-blue-400"
                        aria-label={`${item.quantity} units of ${item.model}`}
                      >
                        ×{item.quantity}
                      </span>
                      {!readOnly && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingModel(item.model)}
                            className="h-8 px-2"
                            aria-label={`Edit notes for ${item.model}`}
                          >
                            Notes
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAllOfModel(item.model)}
                            className="h-8 w-8 p-0 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                            aria-label={`Remove all ${item.quantity} ${item.model} microphones`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Inline controls for exclusive use */}
                  {!readOnly && showExclusiveUse && (
                    <div className="flex items-center space-x-2 pl-1">
                      <Checkbox
                        id={`exclusive-inline-${item.model}`}
                        checked={micData?.exclusive_use || false}
                        onCheckedChange={(checked) =>
                          updateMicDetails(item.model, { exclusive_use: !!checked })
                        }
                      />
                      <Label
                        htmlFor={`exclusive-inline-${item.model}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        Exclusive use (cannot be shared with other artists)
                      </Label>
                    </div>
                  )}

                  {/* Show notes if exists */}
                  {micData?.notes && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 pl-4 border-l-2 border-gray-300 dark:border-gray-600">
                      {micData.notes}
                    </div>
                  )}

                  {/* Notes Dialog */}
                  {editingModel === item.model && showNotes && (
                    <Dialog open={true} onOpenChange={() => setEditingModel(null)}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Notes for {item.model}</DialogTitle>
                          <DialogDescription>
                            Add any additional notes or special requirements for this microphone
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <Textarea
                            id={`notes-${item.model}`}
                            placeholder="Add any notes about this microphone..."
                            value={micData?.notes || ''}
                            onChange={(e) =>
                              updateMicDetails(item.model, { notes: e.target.value })
                            }
                            rows={5}
                            autoFocus
                          />
                        </div>
                        <DialogFooter>
                          <Button onClick={() => setEditingModel(null)}>Done</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              );
            })}
            <div className="pt-2 border-t mt-3">
              <div className="flex justify-between items-center font-bold">
                <span>Total Microphones</span>
                <span className="text-xl text-blue-600 dark:text-blue-400" aria-label={`Total: ${totalCount} microphones`}>
                  {totalCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {value.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg" role="status">
          <Plus className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-600 mb-3" aria-hidden="true" />
          <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">No microphones added yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Click on a microphone button above to add it to your list
          </p>
        </div>
      )}

      {/* Clear All Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              Clear All Microphones?
            </DialogTitle>
            <DialogDescription>
              This will remove all {totalCount} microphone{totalCount !== 1 ? 's' : ''} from your list.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={clearAll}>
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
