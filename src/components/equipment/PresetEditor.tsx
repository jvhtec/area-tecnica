import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PresetWithItems, Equipment, PresetItem } from '@/types/equipment';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Save, X, Upload, Search } from 'lucide-react';
import { PushPresetToFlexDialog } from './PushPresetToFlexDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useDepartment } from '@/contexts/DepartmentContext';

interface PresetEditorProps {
  preset?: PresetWithItems;
  isCopy?: boolean;
  onSave: (name: string, items: Omit<PresetItem, 'id' | 'preset_id'>[], tourId?: string | null) => void;
  onCancel: () => void;
  fixedTourId?: string; // If provided, hide Tour selection and force this value
  jobId?: string; // If provided, enables pullsheet selection
  jobCandidates?: Array<{ id: string; title: string; startTime?: string | null }>;
  allowedCategories?: string[]; // When provided, defaults to showing these categories
}

export const PresetEditor = ({ preset, isCopy = false, onSave, onCancel, fixedTourId, jobId, jobCandidates, allowedCategories }: PresetEditorProps) => {
  const { session } = useOptimizedAuth();
  const { department } = useDepartment();
  const [name, setName] = useState(preset?.name || '');
  const [selectedTourId, setSelectedTourId] = useState<string | undefined | null>(fixedTourId ?? preset?.tour_id ?? undefined);
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [showAllEquipment, setShowAllEquipment] = useState(() => !allowedCategories?.length);
  const [searchQuery, setSearchQuery] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    if (!preset?.items) return {};
    return preset.items.reduce((acc, item) => {
      acc[item.equipment_id] = item.quantity;
      return acc;
    }, {} as Record<string, number>);
  });

  const { data: equipmentList } = useQuery({
    queryKey: ['equipment', department],
    queryFn: async () => {
      const { data: equipment, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('department', department)
        .order('name');
      
      if (error) throw error;
      return equipment as Equipment[];
    }
  });

  // Fetch tours when no fixed tour is enforced
  const { data: tours } = useQuery({
    queryKey: ['tours'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tours')
        .select('id, name, status')
        .order('name');
      if (error) throw error;
      return data as Array<{ id: string; name: string; status: string }>;
    },
    enabled: !fixedTourId
  });

  const handleQuantityChange = (equipmentId: string, value: string) => {
    const quantity = parseInt(value) || 0;
    if (quantity >= 0) {
      setQuantities(prev => ({
        ...prev,
        [equipmentId]: quantity
      }));
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const now = new Date().toISOString();
    const items = Object.entries(quantities)
      .filter(([_, quantity]) => quantity > 0)
      .map(([equipment_id, quantity]) => ({
        equipment_id,
        quantity,
        notes: '',
        created_at: now,
        updated_at: now
      }));

    onSave(name, items, (fixedTourId ?? selectedTourId) || null);
  };

  const handlePushToFlex = () => {
    setShowPushDialog(true);
  };

  // Convert current quantities to PresetItem format for the dialog
  const currentPresetItems: PresetItem[] = Object.entries(quantities)
    .filter(([_, quantity]) => quantity > 0)
    .map(([equipment_id, quantity]) => ({
      id: `temp-${equipment_id}`,
      preset_id: preset?.id || 'temp',
      equipment_id,
      quantity,
      notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

  const shouldFilterCategories = Boolean(allowedCategories?.length && !showAllEquipment);

  // Filter by search query and sort: selected items (quantity > 0) first
  const filteredAndSortedEquipment = equipmentList
    ?.filter((equipment) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        equipment.name.toLowerCase().includes(query) ||
        equipment.category?.toLowerCase().includes(query);

      if (!matchesSearch) return false;
      if (!shouldFilterCategories) return true;

      const isAllowedCategory = equipment.category ? allowedCategories!.includes(equipment.category) : false;
      const isSelected = (quantities[equipment.id] || 0) > 0;
      return isAllowedCategory || isSelected;
    })
    .sort((a, b) => {
      const aSelected = (quantities[a.id] || 0) > 0;
      const bSelected = (quantities[b.id] || 0) > 0;
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return a.name.localeCompare(b.name);
    });

  return (
    <Card className="w-full h-[600px] bg-card/80 backdrop-blur-sm flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0">
        <CardTitle>
          {isCopy ? 'Copy Preset' : preset ? 'Edit Preset' : 'Create New Preset'}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex flex-col h-full gap-4">
          <div className="flex-shrink-0">
            <Label htmlFor="preset-name">Preset Name</Label>
            <Input
              id="preset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter preset name..."
              className="mt-1"
            />
          </div>
          {!fixedTourId && (
            <div className="flex-shrink-0">
              <Label>Tour (optional)</Label>
              <Select
                value={selectedTourId ?? 'no-tour'}
                onValueChange={(val) => setSelectedTourId(val === 'no-tour' ? null : val)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="No tour (standalone preset)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-tour">No tour</SelectItem>
                  {tours?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="relative flex-shrink-0">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search equipment..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {allowedCategories?.length ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAllEquipment((prev) => !prev)}
                  className="flex-shrink-0"
                >
                  {showAllEquipment ? 'PA only' : 'All'}
                </Button>
              ) : null}
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0 pr-4">
            <div className="space-y-2">
              {filteredAndSortedEquipment?.map((equipment) => {
                const isSelected = (quantities[equipment.id] || 0) > 0;
                return (
                  <div
                    key={equipment.id}
                    className={`flex items-center space-x-4 p-2 rounded-md ${isSelected ? 'bg-primary/10' : ''}`}
                  >
                    <div className="flex-1">
                      <Label>{equipment.name}</Label>
                      {equipment.category && (
                        <p className="text-sm text-muted-foreground">{equipment.category}</p>
                      )}
                    </div>
                    <Input
                      type="number"
                      min="0"
                      value={quantities[equipment.id] || 0}
                      onChange={(e) => handleQuantityChange(equipment.id, e.target.value)}
                      className="w-24"
                    />
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <div className="flex gap-2 pt-2 flex-shrink-0">
            <Button variant="outline" onClick={onCancel} className="flex-shrink-0">
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handlePushToFlex}
              disabled={currentPresetItems.length === 0}
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              Push to Flex Pullsheet
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()} className="flex-shrink-0">
              <Save className="mr-2 h-4 w-4" />
              Save Preset
            </Button>
          </div>
        </div>
      </CardContent>
      <PushPresetToFlexDialog
        open={showPushDialog}
        onOpenChange={setShowPushDialog}
        presetItems={currentPresetItems}
        equipment={equipmentList || []}
        jobId={jobId}
        jobCandidates={jobCandidates}
      />
    </Card>
  );
};
