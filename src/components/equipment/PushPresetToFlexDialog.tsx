import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Upload } from 'lucide-react';
import { extractFlexElementId } from '@/utils/flexUrlParser';
import { pushEquipmentToPullsheet, EquipmentItem, getJobPullsheetsWithFlexApi, JobPullsheet } from '@/services/flexPullsheets';
import { PresetItem, Equipment, resolveSubsystemForEquipment } from '@/types/equipment';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const UNKNOWN_DATE_SENTINEL = '2000-01-01T00:00:00.000Z';

function getPullsheetDisplayName(pullsheet: JobPullsheet) {
  if (pullsheet.display_name) return pullsheet.display_name;
  if (pullsheet.department) {
    return `${pullsheet.department.charAt(0).toUpperCase() + pullsheet.department.slice(1)} Pullsheet`;
  }
  return 'Pullsheet';
}

function getPullsheetCreatedAtLabel(pullsheet: JobPullsheet) {
  if (pullsheet.source === 'flex_api' && pullsheet.created_at === UNKNOWN_DATE_SENTINEL) {
    return 'Unknown';
  }

  const createdAt = new Date(pullsheet.created_at);
  if (Number.isNaN(createdAt.getTime())) return 'Unknown';
  return createdAt.toLocaleDateString();
}

interface PullsheetUrlInputProps {
  pullsheetUrl: string;
  onPullsheetUrlChange: (url: string) => void;
  isPushing: boolean;
  isValidUrl: boolean;
  elementId: string | null;
}

function PullsheetUrlInput({
  pullsheetUrl,
  onPullsheetUrlChange,
  isPushing,
  isValidUrl,
  elementId,
}: PullsheetUrlInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="pullsheet-url">Pullsheet URL</Label>
      <div className="flex gap-2">
        <Input
          id="pullsheet-url"
          placeholder="Paste Flex pullsheet URL here..."
          value={pullsheetUrl}
          onChange={(e) => onPullsheetUrlChange(e.target.value)}
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
    </div>
  );
}

interface PushPresetToFlexDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetItems: PresetItem[];
  equipment: Equipment[];
  jobId?: string;
  jobCandidates?: Array<{ id: string; title: string; startTime?: string | null }>;
}

export function PushPresetToFlexDialog({
  open,
  onOpenChange,
  presetItems,
  equipment,
  jobId,
  jobCandidates,
}: PushPresetToFlexDialogProps) {
  const hasUserSelectedInputModeRef = useRef(false);
  const [pullsheetUrl, setPullsheetUrl] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(false);
  const [elementId, setElementId] = useState<string | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ succeeded: number; failed: Array<{ name: string; error: string }> } | null>(null);
  const [equipmentToPush, setEquipmentToPush] = useState<EquipmentItem[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState<'select' | 'url'>('select');
  const [availablePullsheets, setAvailablePullsheets] = useState<JobPullsheet[]>([]);
  const [selectedPullsheetId, setSelectedPullsheetId] = useState<string | null>(null);
  const [isLoadingPullsheets, setIsLoadingPullsheets] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const resolvedJobId = jobId ?? selectedJobId;

  useEffect(() => {
    if (open) return;

    hasUserSelectedInputModeRef.current = false;
    setPullsheetUrl('');
    setIsValidUrl(false);
    setElementId(null);
    setPushResult(null);
    setAvailablePullsheets([]);
    setSelectedPullsheetId(null);
    setIsLoadingPullsheets(false);
    setSelectedJobId(null);
    setInputMode(jobId ? 'select' : 'url');
  }, [open, jobId]);

  useEffect(() => {
    if (!open) return;
    if (jobId) return;
    if (!jobCandidates || jobCandidates.length !== 1) return;
    setSelectedJobId(jobCandidates[0].id);
  }, [open, jobId, jobCandidates]);

  // Load available pullsheets when dialog opens (if jobId provided)
  useEffect(() => {
    if (!open) return;

    hasUserSelectedInputModeRef.current = false;

    if (!resolvedJobId) {
      setInputMode('url');
      setAvailablePullsheets([]);
      setSelectedPullsheetId(null);
      setIsLoadingPullsheets(false);
      return;
    }

    let isMounted = true;

    const loadPullsheets = async () => {
      setIsLoadingPullsheets(true);
      try {
        const pullsheets = await getJobPullsheetsWithFlexApi(resolvedJobId);

        if (!isMounted) return;

        setAvailablePullsheets(pullsheets);

        const canAutoSelect = !hasUserSelectedInputModeRef.current;

        // Auto-select if only one pullsheet available
        if (pullsheets.length === 1 && canAutoSelect) {
          setSelectedPullsheetId(pullsheets[0].element_id);
          setElementId(pullsheets[0].element_id);
        }

        // Set default mode based on available pullsheets
        if (canAutoSelect) {
          setInputMode(pullsheets.length > 0 ? 'select' : 'url');
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

    return () => {
      isMounted = false;
    };
  }, [open, resolvedJobId]);

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

  // Build equipment list from preset items
  useEffect(() => {
    if (!open || presetItems.length === 0) {
      setEquipmentToPush([]);
      setMissing([]);
      return;
    }

    const found: EquipmentItem[] = [];
    const missingItems: string[] = [];

    // Create a map of equipment by ID
    const equipmentMap = new Map(equipment.map(eq => [eq.id, eq]));

    presetItems.forEach(item => {
      const eq = equipmentMap.get(item.equipment_id);
      if (!eq) return;

      const subsystem = item.subsystem ?? resolveSubsystemForEquipment(eq);

      if (eq.resource_id) {
        found.push({
          resourceId: eq.resource_id,
          quantity: item.quantity,
          name: eq.name,
          category: eq.category,
          subsystem,
        });
      } else {
        missingItems.push(eq.name);
      }
    });

    setEquipmentToPush(found);
    setMissing(missingItems);
  }, [open, presetItems, equipment]);

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

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    if (!isPushing) {
      onOpenChange(false);
    }
  };

  const canPush = Boolean(
    elementId &&
      equipmentToPush.length > 0 &&
      !isPushing &&
      (inputMode === 'url' ? isValidUrl : Boolean(resolvedJobId && selectedPullsheetId))
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Push Equipment Preset to Flex Pullsheet</DialogTitle>
          <DialogDescription>
            {jobId ? 'Select an existing pullsheet or enter a Flex pullsheet URL to add equipment items' : 'Enter the Flex pullsheet URL to add equipment items as line items'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!jobId && jobCandidates && jobCandidates.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="job-select">Job</Label>
              <Select
                value={selectedJobId || ''}
                onValueChange={(value) => {
                  setSelectedJobId(value);
                  setAvailablePullsheets([]);
                  setSelectedPullsheetId(null);
                  setElementId(null);
                }}
              >
                <SelectTrigger id="job-select">
                  <SelectValue placeholder="Select a job..." />
                </SelectTrigger>
                <SelectContent>
                  {jobCandidates.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Pullsheet Selection (only shown if jobId is provided or a job is selected) */}
          {resolvedJobId ? (
            <Tabs
              value={inputMode}
              onValueChange={(value) => {
                hasUserSelectedInputModeRef.current = true;
                setInputMode(value as 'select' | 'url');
              }}
            >
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
                            {getPullsheetDisplayName(ps)}{' '}
                            <span className="text-xs text-muted-foreground">
                              {ps.source === 'flex_api' && '(from Flex) '}
                              ({getPullsheetCreatedAtLabel(ps)})
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

              <TabsContent value="url">
                <PullsheetUrlInput
                  pullsheetUrl={pullsheetUrl}
                  onPullsheetUrlChange={(url) => setPullsheetUrl(url)}
                  isPushing={isPushing}
                  isValidUrl={isValidUrl}
                  elementId={elementId}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <PullsheetUrlInput
              pullsheetUrl={pullsheetUrl}
              onPullsheetUrlChange={(url) => setPullsheetUrl(url)}
              isPushing={isPushing}
              isValidUrl={isValidUrl}
              elementId={elementId}
            />
          )}

          {/* Equipment Preview */}
          {equipmentToPush.length > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Ready to push {equipmentToPush.length} equipment items ({equipmentToPush.reduce((sum, e) => sum + e.quantity, 0)} total units)
              </AlertDescription>
            </Alert>
          )}

          {missing.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {missing.length} items will be skipped (no Flex resource ID):
                <div className="mt-1 text-xs max-h-20 overflow-y-auto">
                  {missing.join(', ')}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {equipmentToPush.length === 0 && presetItems.length > 0 && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                No equipment items are linked to Flex resources. Please map equipment models to Flex resources first.
              </AlertDescription>
            </Alert>
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
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPushing}>
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
