
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Equipment, PresetItem } from '@/types/equipment';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Plus, Minus, Save, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { pushEquipmentToPullsheet, EquipmentItem, getJobPullsheetsWithFlexApi, JobPullsheet } from '@/services/flexPullsheets';
import { extractFlexElementId, isFlexUrl } from '@/utils/flexUrlParser';


interface JobPresetManagerProps {
  jobId: string;
}

export const JobPresetManager = ({ jobId }: JobPresetManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localItems, setLocalItems] = useState<Record<string, number>>({});

  // Push to Flex state
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [pullsheetUrl, setPullsheetUrl] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(false);
  const [elementId, setElementId] = useState<string | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ succeeded: number; failed: Array<{ name: string; error: string }> } | null>(null);
  const [inputMode, setInputMode] = useState<'select' | 'url'>('select');
  const [availablePullsheets, setAvailablePullsheets] = useState<JobPullsheet[]>([]);
  const [selectedPullsheetId, setSelectedPullsheetId] = useState<string | null>(null);
  const [isLoadingPullsheets, setIsLoadingPullsheets] = useState(false);

  // Fetch job preset and items
  const { data: preset } = useQuery({
    queryKey: ['job-preset', jobId],
    queryFn: async () => {
      const { data: presetData, error: presetError } = await supabase
        .from('job_equipment_presets')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (presetError) throw presetError;

      if (presetData) {
        const { data: items, error: itemsError } = await supabase
          .from('job_preset_items')
          .select(`
            *,
            equipment:equipment (*)
          `)
          .eq('preset_id', presetData.id);

        if (itemsError) throw itemsError;

        return {
          ...presetData,
          items: items || []
        };
      }

      return null;
    }
  });

  // Fetch available equipment
  const { data: equipmentList = [] } = useQuery<Equipment[]>({
    queryKey: ['equipment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('category')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Initialize local items from preset
  useState(() => {
    if (preset?.items) {
      const initialItems: Record<string, number> = {};
      preset.items.forEach((item: PresetItem) => {
        initialItems[item.equipment_id] = item.quantity;
      });
      setLocalItems(initialItems);
    }
  });

  // Save preset mutation
  const savePresetMutation = useMutation({
    mutationFn: async () => {
      // Create preset if it doesn't exist
      let presetId = preset?.id;
      if (!presetId) {
        const { data: newPreset, error: presetError } = await supabase
          .from('job_equipment_presets')
          .insert({ job_id: jobId })
          .select()
          .single();

        if (presetError) throw presetError;
        presetId = newPreset.id;
      }

      // Update preset items
      const items = Object.entries(localItems).map(([equipmentId, quantity]) => ({
        preset_id: presetId,
        equipment_id: equipmentId,
        quantity,
        notes: '', // Add empty notes field
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      // Delete existing items
      const { error: deleteError } = await supabase
        .from('job_preset_items')
        .delete()
        .eq('preset_id', presetId);

      if (deleteError) throw deleteError;

      // Insert new items
      const { error: insertError } = await supabase
        .from('job_preset_items')
        .insert(items);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-preset'] });
      toast({
        title: "Success",
        description: "Preset saved successfully"
      });
    },
    onError: (error) => {
      console.error('Error saving preset:', error);
      toast({
        title: "Error",
        description: "Failed to save preset",
        variant: "destructive"
      });
    }
  });

  // Load available pullsheets when push dialog opens
  useEffect(() => {
    if (!showPushDialog) {
      setAvailablePullsheets([]);
      setSelectedPullsheetId(null);
      return;
    }

    let isMounted = true;

    const loadPullsheets = async () => {
      setIsLoadingPullsheets(true);
      try {
        const pullsheets = await getJobPullsheetsWithFlexApi(jobId);

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

    return () => {
      isMounted = false;
    };
  }, [showPushDialog, jobId, toast]);

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

    const valid = isFlexUrl(pullsheetUrl);
    setIsValidUrl(valid);

    if (valid) {
      try {
        const id = extractFlexElementId(pullsheetUrl);
        setElementId(id);
      } catch {
        setElementId(null);
      }
    } else {
      setElementId(null);
    }
  }, [pullsheetUrl, inputMode]);

  const handlePushToFlex = async () => {
    if (!elementId || !preset?.items?.length) return;

    setIsPushing(true);
    setPushResult(null);

    try {
      // Convert preset items to EquipmentItem format
      const equipmentItems: EquipmentItem[] = preset.items
        .filter(item => item.equipment?.resource_id && item.quantity > 0)
        .map(item => ({
          resourceId: item.equipment.resource_id!,
          quantity: item.quantity,
          name: item.equipment.name,
          category: item.equipment.category,
        }));

      if (equipmentItems.length === 0) {
        toast({
          title: 'Error',
          description: 'No valid equipment items to push',
          variant: 'destructive',
        });
        return;
      }

      const result = await pushEquipmentToPullsheet(elementId, equipmentItems);
      setPushResult(result);

      if (result.failed.length === 0) {
        toast({
          title: 'Success',
          description: `Successfully pushed ${result.succeeded} items to Flex pullsheet`,
        });
        setTimeout(() => setShowPushDialog(false), 2000);
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

  const handleQuantityChange = (equipmentId: string, newQuantity: number) => {
    setLocalItems(prev => ({
      ...prev,
      [equipmentId]: Math.max(0, newQuantity)
    }));
  };

  // Group equipment by category
  const groupedEquipment = equipmentList.reduce((grouped: Record<string, Equipment[]>, item) => {
    const category = item.category || 'uncategorized';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
    return grouped;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Equipment Preset</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button
            onClick={() => savePresetMutation.mutate()}
            className="flex-1"
            disabled={savePresetMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Preset
          </Button>
          <Button
            onClick={() => setShowPushDialog(true)}
            className="flex-1"
            variant="secondary"
            disabled={!preset || preset.items.length === 0}
          >
            <Upload className="mr-2 h-4 w-4" />
            Push to Flex
          </Button>
        </div>

        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-8">
            {Object.entries(groupedEquipment).map(([category, items]) => (
              <div key={category} className="space-y-4">
                <h3 className="text-lg font-semibold capitalize">{category}</h3>
                <div className="space-y-4">
                  {items.map(equipment => (
                    <div key={equipment.id} className="flex items-center space-x-4">
                      <div className="flex-1">
                        <Label>{equipment.name}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleQuantityChange(equipment.id, (localItems[equipment.id] || 0) - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          value={localItems[equipment.id] || 0}
                          onChange={(e) => handleQuantityChange(equipment.id, parseInt(e.target.value) || 0)}
                          className="w-24"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleQuantityChange(equipment.id, (localItems[equipment.id] || 0) + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>

      <Dialog open={showPushDialog} onOpenChange={setShowPushDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Push Preset to Flex Pullsheet</DialogTitle>
            <DialogDescription>
              Select an existing pullsheet or enter a Flex pullsheet URL to add equipment items
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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

            {pushResult && (
              <Alert variant={pushResult.failed.length === 0 ? "default" : "destructive"}>
                <div className="space-y-2">
                  {pushResult.succeeded > 0 && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{pushResult.succeeded} items pushed successfully</span>
                    </div>
                  )}
                  {pushResult.failed.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-destructive" />
                        <span className="text-sm font-medium">{pushResult.failed.length} items failed:</span>
                      </div>
                      <ul className="list-disc list-inside text-sm pl-6 space-y-1">
                        {pushResult.failed.map((failure, idx) => (
                          <li key={idx}>
                            {failure.name}: {failure.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPushDialog(false)} disabled={isPushing}>
              Close
            </Button>
            <Button
              onClick={handlePushToFlex}
              disabled={
                isPushing ||
                !elementId ||
                !preset ||
                preset.items.length === 0 ||
                (inputMode === 'select' ? !selectedPullsheetId : !isValidUrl)
              }
            >
              {isPushing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Push to Flex
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
