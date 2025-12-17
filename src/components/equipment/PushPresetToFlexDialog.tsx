import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Upload } from 'lucide-react';
import { extractFlexElementId } from '@/utils/flexUrlParser';
import { pushEquipmentToPullsheet, EquipmentItem } from '@/services/flexPullsheets';
import { supabase } from '@/lib/supabase';
import { PresetItem, Equipment } from '@/types/equipment';

interface PushPresetToFlexDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetItems: PresetItem[];
  equipment: Equipment[];
}

export function PushPresetToFlexDialog({
  open,
  onOpenChange,
  presetItems,
  equipment,
}: PushPresetToFlexDialogProps) {
  const { toast } = useToast();
  const [pullsheetUrl, setPullsheetUrl] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(false);
  const [elementId, setElementId] = useState<string | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ succeeded: number; failed: Array<{ name: string; error: string }> } | null>(null);
  const [equipmentToPush, setEquipmentToPush] = useState<EquipmentItem[]>([]);
  const [missing, setMissing] = useState<string[]>([]);

  // Extract element ID from URL
  useEffect(() => {
    if (!pullsheetUrl) {
      setIsValidUrl(false);
      setElementId(null);
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
  }, [pullsheetUrl]);

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

      if (eq.resource_id) {
        found.push({
          resourceId: eq.resource_id,
          quantity: item.quantity,
          name: eq.name,
          category: eq.category,
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

  const handleClose = () => {
    if (!isPushing) {
      setPullsheetUrl('');
      setPushResult(null);
      onOpenChange(false);
    }
  };

  const canPush = isValidUrl && equipmentToPush.length > 0 && !isPushing;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Push Equipment Preset to Flex Pullsheet</DialogTitle>
          <DialogDescription>
            Enter the Flex pullsheet URL to add equipment items as line items
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* URL Input */}
          <div className="space-y-2">
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
          </div>

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
