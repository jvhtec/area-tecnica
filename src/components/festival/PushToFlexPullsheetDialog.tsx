import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Upload } from 'lucide-react';
import { GearSetupFormData } from '@/types/festival-gear';
import { extractFlexElementId } from '@/utils/flexUrlParser';
import { pushEquipmentToPullsheet, EquipmentItem, getJobPullsheetsWithFlexApi, JobPullsheet } from '@/services/flexPullsheets';
import { supabase } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

interface PushToFlexPullsheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gearSetup: GearSetupFormData;
  jobId: string;
}

interface EquipmentLookupResult {
  found: EquipmentItem[];
  missing: string[];
}

type PaPresetOption = {
  id: string;
  name: string;
  job_id: string | null;
};

type PresetEquipmentRow = {
  id: string;
  name: string;
  category: string | null;
  resource_id: string | null;
};

type PresetItemRow = {
  quantity: number | null;
  equipment: PresetEquipmentRow | PresetEquipmentRow[] | null;
};

const PA_PRESET_CATEGORIES = new Set(['speakers', 'amplificacion']);

export function PushToFlexPullsheetDialog({
  open,
  onOpenChange,
  gearSetup,
  jobId,
}: PushToFlexPullsheetDialogProps) {
  const [pullsheetUrl, setPullsheetUrl] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(false);
  const [elementId, setElementId] = useState<string | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ succeeded: number; failed: Array<{ name: string; error: string }> } | null>(null);
  const [inputMode, setInputMode] = useState<'select' | 'url'>('select');
  const [availablePullsheets, setAvailablePullsheets] = useState<JobPullsheet[]>([]);
  const [selectedPullsheetId, setSelectedPullsheetId] = useState<string | null>(null);
  const [isLoadingPullsheets, setIsLoadingPullsheets] = useState(false);

  const [includePaPreset, setIncludePaPreset] = useState(false);
  const [paPresets, setPaPresets] = useState<PaPresetOption[]>([]);
  const [selectedPaPresetId, setSelectedPaPresetId] = useState<string | null>(null);
  const [isLoadingPaPresets, setIsLoadingPaPresets] = useState(false);

  // Load available pullsheets when dialog opens
  useEffect(() => {
    if (!open || !jobId) {
      setAvailablePullsheets([]);
      setSelectedPullsheetId(null);
      return;
    }

    let isMounted = true;

    const loadPullsheets = async () => {
      setIsLoadingPullsheets(true);
      try {
        const pullsheets = await getJobPullsheetsWithFlexApi(jobId);

        // Only update state if component is still mounted and context hasn't changed
        if (!isMounted) return;

        setAvailablePullsheets(pullsheets);

        // Auto-select if only one pullsheet available
        if (pullsheets.length === 1) {
          setSelectedPullsheetId(pullsheets[0].element_id);
          setElementId(pullsheets[0].element_id);
        }

        // Set default mode based on available pullsheets
        if (pullsheets.length > 0) {
          setInputMode('select');
        } else {
          setInputMode('url');
        }
      } catch (error) {
        if (!isMounted) return;

        console.error('Failed to load pullsheets:', error);
        toast({
          title: 'Error',
          description: 'Failed to load pullsheets for this job',
          variant: 'destructive',
        });
      } finally {
        if (isMounted) {
          setIsLoadingPullsheets(false);
        }
      }
    };

    loadPullsheets();

    // Cleanup function to prevent stale state updates
    return () => {
      isMounted = false;
    };
  }, [open, jobId]);

  useEffect(() => {
    if (!open || !jobId) {
      setIncludePaPreset(false);
      setPaPresets([]);
      setSelectedPaPresetId(null);
      setIsLoadingPaPresets(false);
      return;
    }

    let isMounted = true;

    const loadPaPresets = async () => {
      setIsLoadingPaPresets(true);
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('id, name, job_id')
          .eq('department', 'sound')
          .or(`job_id.eq.${jobId},job_id.is.null`)
          .order('job_id', { ascending: false })
          .order('name');

        if (error) throw error;
        if (!isMounted) return;
        setPaPresets((data || []) as PaPresetOption[]);
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to load PA presets:', error);
        toast({
          title: 'Error',
          description: 'Failed to load PA presets',
          variant: 'destructive',
        });
      } finally {
        if (isMounted) {
          setIsLoadingPaPresets(false);
        }
      }
    };

    loadPaPresets();

    return () => {
      isMounted = false;
    };
  }, [open, jobId]);

  // Handle pullsheet selection
  useEffect(() => {
    if (inputMode === 'select' && selectedPullsheetId) {
      setElementId(selectedPullsheetId);
    }
  }, [inputMode, selectedPullsheetId]);

  // Extract element ID from URL
  useEffect(() => {
    if (inputMode !== 'url' || !pullsheetUrl) {
      if (inputMode === 'url') {
        setIsValidUrl(false);
        setElementId(null);
      }
      return;
    }

    const extracted = extractFlexElementId(pullsheetUrl);
    if (extracted) {
      setElementId(extracted);
      setIsValidUrl(true);
    } else {
      setElementId(null);
      setIsValidUrl(false);
    }
  }, [pullsheetUrl, inputMode]);

  // Collect all equipment model names from gear setup
  const allModelNames = useMemo(() => {
    const models: string[] = [];

    // Add console models
    gearSetup.foh_consoles.forEach(c => {
      if (c.model && c.quantity > 0) models.push(c.model);
    });
    gearSetup.mon_consoles.forEach(c => {
      if (c.model && c.quantity > 0) models.push(c.model);
    });

    // Add wireless models
    gearSetup.wireless_systems.forEach(w => {
      if (w.model) {
        const qty = (w.quantity_hh || 0) + (w.quantity_bp || 0) + (w.quantity || 0);
        if (qty > 0) models.push(w.model);
      }
    });

    // Add IEM models
    gearSetup.iem_systems.forEach(i => {
      if (i.model) {
        const qty = (i.quantity_hh || 0) + (i.quantity_bp || 0) + (i.quantity || 0);
        if (qty > 0) models.push(i.model);
      }
    });

    // Add wired mic models
    gearSetup.wired_mics.forEach(m => {
      if (m.model && m.quantity > 0) models.push(m.model);
    });

    return Array.from(new Set(models)); // Remove duplicates
  }, [gearSetup]);

  // Look up equipment in database
  const [equipmentLookup, setEquipmentLookup] = useState<EquipmentLookupResult | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  useEffect(() => {
    if (!open || allModelNames.length === 0) {
      setEquipmentLookup(null);
      return;
    }

    const lookupEquipment = async () => {
      setIsLookingUp(true);
      try {
        const { data, error } = await supabase
          .from('equipment')
          .select('name, resource_id, department, id')
          .in('name', allModelNames)
          .not('resource_id', 'is', null);

        if (error) throw error;

        const foundMap = new Map(data.map(eq => [eq.name, eq.resource_id!]));
        const found: EquipmentItem[] = [];
        const missing: string[] = [];

        // Build equipment list with quantities
        interface EquipmentItemWithModel {
          model: string;
          quantity?: number;
          quantity_hh?: number;
          quantity_bp?: number;
        }

        const processItems = (
          items: EquipmentItemWithModel[],
          getQuantity: (item: EquipmentItemWithModel) => number,
          category: string
        ) => {
          items.forEach(item => {
            if (!item.model) return;
            const qty = getQuantity(item);
            if (qty <= 0) return;

            const resourceId = foundMap.get(item.model);
            if (resourceId) {
              // Check if we already have this model in the list
              const existing = found.find(e => e.resourceId === resourceId);
              if (existing) {
                existing.quantity += qty;
              } else {
                found.push({ resourceId, quantity: qty, name: item.model, category });
              }
            } else if (!missing.includes(item.model)) {
              missing.push(item.model);
            }
          });
        };

        processItems(gearSetup.foh_consoles, c => c.quantity, 'foh_console');
        processItems(gearSetup.mon_consoles, c => c.quantity, 'mon_console');
        processItems(gearSetup.wireless_systems, w => (w.quantity_hh || 0) + (w.quantity_bp || 0) + (w.quantity || 0), 'wireless');
        processItems(gearSetup.iem_systems, i => (i.quantity_hh || 0) + (i.quantity_bp || 0) + (i.quantity || 0), 'iem');
        processItems(gearSetup.wired_mics, m => m.quantity, 'wired_mics');

        setEquipmentLookup({ found, missing });
      } catch (error) {
        console.error('Failed to lookup equipment:', error);
        toast({
          title: 'Error',
          description: 'Failed to lookup equipment in database',
          variant: 'destructive',
        });
      } finally {
        setIsLookingUp(false);
      }
    };

    lookupEquipment();
  }, [open, allModelNames, gearSetup]);

  const [paPresetLookup, setPaPresetLookup] = useState<EquipmentLookupResult | null>(null);
  const [isLookingUpPaPreset, setIsLookingUpPaPreset] = useState(false);

  useEffect(() => {
    if (!open || !includePaPreset || !selectedPaPresetId) {
      setPaPresetLookup(null);
      setIsLookingUpPaPreset(false);
      return;
    }

    let isMounted = true;

    const lookupPaPreset = async () => {
      setIsLookingUpPaPreset(true);
      try {
        const { data, error } = await supabase
          .from('preset_items')
          .select('quantity, equipment:equipment(id, name, category, resource_id)')
          .eq('preset_id', selectedPaPresetId);

        if (error) throw error;
        if (!isMounted) return;

        const foundByResource = new Map<string, EquipmentItem>();
        const missing: string[] = [];

        (data || []).forEach((row: PresetItemRow) => {
          const equipmentRow = Array.isArray(row.equipment) ? row.equipment[0] : row.equipment;
          if (!equipmentRow) return;

          if (!equipmentRow.category || !PA_PRESET_CATEGORIES.has(equipmentRow.category)) return;

          const qty = Number(row.quantity) || 0;
          if (qty <= 0) return;

          if (!equipmentRow.resource_id) {
            missing.push(equipmentRow.name);
            return;
          }

          const existing = foundByResource.get(equipmentRow.resource_id);
          if (existing) {
            existing.quantity += qty;
            return;
          }

          foundByResource.set(equipmentRow.resource_id, {
            resourceId: equipmentRow.resource_id,
            quantity: qty,
            name: equipmentRow.name,
            category: equipmentRow.category,
          });
        });

        setPaPresetLookup({
          found: Array.from(foundByResource.values()),
          missing,
        });
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to lookup PA preset equipment:', error);
        toast({
          title: 'Error',
          description: 'Failed to lookup preset equipment in database',
          variant: 'destructive',
        });
      } finally {
        if (isMounted) {
          setIsLookingUpPaPreset(false);
        }
      }
    };

    lookupPaPreset();

    return () => {
      isMounted = false;
    };
  }, [open, includePaPreset, selectedPaPresetId]);

  const equipmentToPush = useMemo(() => {
    const items = [
      ...(equipmentLookup?.found || []),
      ...(includePaPreset ? paPresetLookup?.found || [] : []),
    ];

    const merged = new Map<string, EquipmentItem>();
    for (const item of items) {
      const existing = merged.get(item.resourceId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        merged.set(item.resourceId, { ...item });
      }
    }

    return Array.from(merged.values());
  }, [equipmentLookup, includePaPreset, paPresetLookup]);

  const handlePush = async () => {
    if (!elementId || equipmentToPush.length === 0) {
      return;
    }

    setIsPushing(true);
    setPushResult(null);

    try {
      const result = await pushEquipmentToPullsheet(elementId, equipmentToPush);
      setPushResult(result);

      if (result.failed.length === 0) {
        toast({
          title: 'Success',
          description: `Successfully pushed ${result.succeeded} items to Flex pullsheet`,
        });
        // Close dialog after 2 seconds on full success
        setTimeout(() => onOpenChange(false), 2000);
      } else if (result.succeeded > 0) {
        toast({
          title: 'Partial Success',
          description: `Pushed ${result.succeeded} items, ${result.failed.length} failed`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Failed',
          description: 'Failed to push any items to Flex',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to push equipment:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to push equipment to Flex',
        variant: 'destructive',
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handleClose = () => {
    if (!isPushing) {
      setPullsheetUrl('');
      setPushResult(null);
      setSelectedPullsheetId(null);
      setElementId(null);
      setIncludePaPreset(false);
      setSelectedPaPresetId(null);
      setPaPresetLookup(null);
      onOpenChange(false);
    }
  };

  const canPush =
    elementId &&
    equipmentToPush.length > 0 &&
    !isPushing &&
    (inputMode === 'select' ? !!selectedPullsheetId : isValidUrl);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Push Equipment to Flex Pullsheet</DialogTitle>
          <DialogDescription>
            Select an existing pullsheet or enter a Flex pullsheet URL to add equipment items
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Optional PA preset */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="include-pa-preset">Include PA preset</Label>
                <p className="text-xs text-muted-foreground">
                  Adds speakers + amplificación items from a preset.
                </p>
              </div>
              <Switch
                id="include-pa-preset"
                checked={includePaPreset}
                onCheckedChange={(checked) => {
                  setIncludePaPreset(checked);
                  setSelectedPaPresetId(null);
                  setPaPresetLookup(null);
                }}
                disabled={isPushing || isLoadingPaPresets}
              />
            </div>

            {includePaPreset && (
              <div className="space-y-2">
                <Label htmlFor="pa-preset-select">PA preset</Label>
                <Select
                  value={selectedPaPresetId || ''}
                  onValueChange={(value) => setSelectedPaPresetId(value)}
                  disabled={isPushing || isLoadingPaPresets || paPresets.length === 0}
                >
                  <SelectTrigger id="pa-preset-select">
                    <SelectValue
                      placeholder={
                        isLoadingPaPresets
                          ? 'Loading presets...'
                          : paPresets.length === 0
                            ? 'No presets found'
                            : 'Select a preset...'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {paPresets.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.job_id === jobId ? ' (job)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Pullsheet Selection */}
          <Tabs value={inputMode} onValueChange={(value) => setInputMode(value as 'select' | 'url')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="select" disabled={availablePullsheets.length === 0 && !isLoadingPullsheets}>
                Select Pullsheet {availablePullsheets.length > 0 && `(${availablePullsheets.length})`}
              </TabsTrigger>
              <TabsTrigger value="url">Enter URL</TabsTrigger>
            </TabsList>

            <TabsContent value="select" className="space-y-2">
              {isLoadingPullsheets ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading pullsheets...
                </div>
              ) : availablePullsheets.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No pullsheets found for this job. Create pullsheets first or use the URL input option.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Label htmlFor="pullsheet-select">Available Pullsheets</Label>
                  <Select value={selectedPullsheetId || ''} onValueChange={setSelectedPullsheetId}>
                    <SelectTrigger id="pullsheet-select">
                      <SelectValue placeholder="Select a pullsheet..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePullsheets.map((ps) => (
                        <SelectItem key={ps.id} value={ps.element_id}>
                          {ps.display_name || (ps.department ? `${ps.department.charAt(0).toUpperCase() + ps.department.slice(1)} Pullsheet` : 'Pullsheet')}
                          {' '}
                          <span className="text-xs text-muted-foreground">
                            {ps.source === 'flex_api' && '(from Flex) '}
                            ({ps.source === 'flex_api' && ps.created_at === '2000-01-01T00:00:00.000Z' ? 'Unknown' : new Date(ps.created_at).toLocaleDateString()})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPullsheetId && (
                    <p className="text-sm text-muted-foreground">Element ID: {selectedPullsheetId}</p>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="url" className="space-y-2">
              <Label htmlFor="pullsheet-url">Pullsheet URL</Label>
              <div className="flex gap-2">
                <Input
                  id="pullsheet-url"
                  placeholder="Paste Flex pullsheet URL here..."
                  value={pullsheetUrl}
                  onChange={(e) => setPullsheetUrl(e.target.value)}
                  disabled={isPushing}
                  className={isValidUrl ? 'border-green-500' : ''}
                />
                {isValidUrl && <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-2" />}
              </div>
              {pullsheetUrl && !isValidUrl && (
                <p className="text-sm text-destructive">Invalid Flex URL format</p>
              )}
              {isValidUrl && elementId && (
                <p className="text-sm text-muted-foreground">Element ID: {elementId}</p>
              )}
            </TabsContent>
          </Tabs>

          {/* Equipment Preview */}
          {(isLookingUp || isLookingUpPaPreset) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Looking up equipment...
            </div>
          )}

          {!isLookingUp && !isLookingUpPaPreset && (
            <div className="space-y-2">
              {equipmentToPush.length > 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Ready to push {equipmentToPush.length} equipment items ({equipmentToPush.reduce((sum, e) => sum + e.quantity, 0)} total units)
                  </AlertDescription>
                </Alert>
              )}

              {(equipmentLookup?.missing?.length || 0) > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {equipmentLookup!.missing.length} items will be skipped (no Flex resource ID):
                    <div className="mt-1 text-xs max-h-20 overflow-y-auto">
                      {equipmentLookup!.missing.join(', ')}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {includePaPreset && selectedPaPresetId && (paPresetLookup?.missing?.length || 0) > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {paPresetLookup!.missing.length} preset items will be skipped (no Flex resource ID):
                    <div className="mt-1 text-xs max-h-20 overflow-y-auto">
                      {paPresetLookup!.missing.join(', ')}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {equipmentToPush.length === 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    No equipment items are linked to Flex resources. Please map equipment models to Flex resources first.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Push Result */}
          {pushResult && (
            <div className="space-y-2">
              {pushResult.succeeded > 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Successfully pushed {pushResult.succeeded} items to Flex pullsheet
                  </AlertDescription>
                </Alert>
              )}

              {pushResult.failed.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    {pushResult.failed.length} items failed:
                    <div className="mt-1 text-xs max-h-20 overflow-y-auto">
                      {pushResult.failed.map((f, i) => (
                        <div key={i}>
                          {f.name}: {f.error}
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPushing}>
            Cancel
          </Button>
          <Button onClick={handlePush} disabled={!canPush}>
            {isPushing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Pushing {equipmentToPush.length} items...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Push Items
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
