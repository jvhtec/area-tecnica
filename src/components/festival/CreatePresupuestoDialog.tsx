import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { createPresupuestoFromStage, getStagePresupuestoItems } from '@/services/flexPresupuesto';
import { FLEX_API_BASE_URL } from '@/lib/api-config';

interface CreatePresupuestoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

interface Stage {
  id: string;
  number: number;
  name: string;
}

interface ItemPreview {
  category: string;
  count: number;
  totalQuantity: number;
}

export function CreatePresupuestoDialog({
  open,
  onOpenChange,
  jobId,
}: CreatePresupuestoDialogProps) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [department, setDepartment] = useState<'sound' | 'lights'>('sound');
  const [useExtrasFolder, setUseExtrasFolder] = useState(false);
  const [customName, setCustomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingStages, setIsLoadingStages] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [itemsPreview, setItemsPreview] = useState<ItemPreview[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [createdPresupuestoId, setCreatedPresupuestoId] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<{ succeeded: number; failed: Array<{ name: string; error: string }> } | null>(null);

  // Load stages when dialog opens
  useEffect(() => {
    if (!open || !jobId) {
      setStages([]);
      setSelectedStage(null);
      return;
    }

    const loadStages = async () => {
      setIsLoadingStages(true);
      try {
        const { data, error } = await supabase
          .from('festival_stages')
          .select('id, number, name')
          .eq('job_id', jobId)
          .order('number');

        if (error) throw error;

        const stagesData = (data || []) as Stage[];
        setStages(stagesData);

        // Auto-select first stage
        if (stagesData.length > 0) {
          setSelectedStage(stagesData[0].number);
        }
      } catch (error) {
        console.error('Failed to load stages:', error);
        toast({
          title: 'Error',
          description: 'Failed to load stages for this festival',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingStages(false);
      }
    };

    loadStages();
  }, [open, jobId]);

  // Load preview when stage or department changes
  useEffect(() => {
    if (!open || selectedStage === null || !jobId) {
      setItemsPreview([]);
      setTotalItems(0);
      return;
    }

    const loadPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const items = await getStagePresupuestoItems(jobId, selectedStage, department);

        // Group by category for preview
        const categoryMap = new Map<string, { count: number; totalQuantity: number }>();

        for (const item of items) {
          const category = item.category || 'uncategorized';
          const existing = categoryMap.get(category);

          if (existing) {
            existing.count++;
            existing.totalQuantity += item.quantity;
          } else {
            categoryMap.set(category, { count: 1, totalQuantity: item.quantity });
          }
        }

        const preview: ItemPreview[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
          category,
          count: data.count,
          totalQuantity: data.totalQuantity,
        }));

        setItemsPreview(preview);
        setTotalItems(items.length);
      } catch (error) {
        console.error('Failed to load preview:', error);
        setItemsPreview([]);
        setTotalItems(0);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    loadPreview();
  }, [open, selectedStage, department, jobId]);

  const handleCreate = async () => {
    if (selectedStage === null) {
      toast({
        title: 'Error',
        description: 'Please select a stage',
        variant: 'destructive',
      });
      return;
    }

    if (totalItems === 0) {
      toast({
        title: 'Error',
        description: 'No equipment items found for this stage and department. Cannot create empty presupuesto.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    setCreatedPresupuestoId(null);
    setPushResult(null);

    try {
      const result = await createPresupuestoFromStage({
        jobId,
        stageNumber: selectedStage,
        department,
        useExtrasFolder,
        customName: customName.trim() || undefined,
      });

      setCreatedPresupuestoId(result.presupuestoId);
      setPushResult(result.pushResult);

      toast({
        title: 'Success',
        description: `Presupuesto created successfully with ${result.pushResult.succeeded} items`,
      });
    } catch (error) {
      console.error('Failed to create presupuesto:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create presupuesto',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setSelectedStage(null);
    setDepartment('sound');
    setUseExtrasFolder(false);
    setCustomName('');
    setCreatedPresupuestoId(null);
    setPushResult(null);
    setItemsPreview([]);
    setTotalItems(0);
    onOpenChange(false);
  };

  const presupuestoUrl = createdPresupuestoId
    ? `${FLEX_API_BASE_URL.replace('/v2', '')}/element/${createdPresupuestoId}`
    : null;

  const selectedStageName = stages.find(s => s.number === selectedStage)?.name || `Stage ${selectedStage}`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Presupuesto from Stage Gear
          </DialogTitle>
          <DialogDescription>
            Create a presupuesto in the comercial folder with equipment from the selected stage
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Stage Selection */}
          <div className="space-y-2">
            <Label>Stage</Label>
            {isLoadingStages ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading stages...
              </div>
            ) : stages.length === 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No stages found. Please create stages in the gear management page first.
                </AlertDescription>
              </Alert>
            ) : (
              <Select
                value={selectedStage?.toString()}
                onValueChange={(value) => setSelectedStage(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.number.toString()}>
                      Stage {stage.number} - {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Department Selection */}
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={department} onValueChange={(value) => setDepartment(value as 'sound' | 'lights')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sound">Sonido</SelectItem>
                <SelectItem value="lights">Luces</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="extras-folder" className="cursor-pointer">
                Create Extras Folder
              </Label>
              <Switch
                id="extras-folder"
                checked={useExtrasFolder}
                onCheckedChange={setUseExtrasFolder}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {useExtrasFolder
                ? 'Presupuesto will be created inside an "Extras" subfolder'
                : 'Presupuesto will be created directly in the Comercial folder'}
            </p>
          </div>

          {/* Custom Name */}
          <div className="space-y-2">
            <Label htmlFor="custom-name">Custom Name (optional)</Label>
            <Input
              id="custom-name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Leave empty for default naming"
            />
          </div>

          {/* Preview */}
          {selectedStage !== null && (
            <div className="space-y-2 rounded-lg border p-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <Label className="text-base">Equipment Preview</Label>
                {isLoadingPreview && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>

              {totalItems === 0 ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No equipment items found for {selectedStageName} in {department === 'sound' ? 'Sonido' : 'Luces'}.
                    Cannot create empty presupuesto.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {totalItems} item{totalItems !== 1 ? 's' : ''} from gear setup and presets
                  </p>

                  {itemsPreview.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {itemsPreview.map((preview) => (
                        <div key={preview.category} className="flex justify-between text-xs">
                          <span className="font-medium">{preview.category}</span>
                          <span className="text-muted-foreground">
                            {preview.count} type{preview.count !== 1 ? 's' : ''}, {preview.totalQuantity} units
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Result */}
          {createdPresupuestoId && pushResult && (
            <Alert className={pushResult.failed.length > 0 ? 'border-yellow-500' : 'border-green-500'}>
              {pushResult.failed.length === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">
                    Presupuesto created: {pushResult.succeeded} items added successfully
                  </p>
                  {pushResult.failed.length > 0 && (
                    <div className="text-xs">
                      <p className="font-medium text-destructive">{pushResult.failed.length} items failed:</p>
                      <ul className="list-disc list-inside">
                        {pushResult.failed.slice(0, 5).map((item, i) => (
                          <li key={i}>{item.name}: {item.error}</li>
                        ))}
                        {pushResult.failed.length > 5 && (
                          <li>...and {pushResult.failed.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {presupuestoUrl && (
                    <a
                      href={presupuestoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline text-sm"
                    >
                      Open presupuesto in Flex →
                    </a>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            {createdPresupuestoId ? 'Close' : 'Cancel'}
          </Button>
          {!createdPresupuestoId && (
            <Button
              onClick={handleCreate}
              disabled={isCreating || selectedStage === null || totalItems === 0 || isLoadingPreview}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Presupuesto'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
