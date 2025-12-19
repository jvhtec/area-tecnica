import { useState, useEffect, useCallback } from 'react';
import { StockEntry, Equipment, getCategoriesForDepartment, allCategoryLabels, AllCategories } from '@/types/equipment';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Pencil, Search, ChevronDown, ChevronRight, Check, X, Loader2, Link, ClipboardPaste, Download, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// UUID regex for extracting Flex resource IDs
const UUID_REGEX = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/;

interface StockManagerProps {
  stock: StockEntry[];
  onStockUpdate: (stock: StockEntry[]) => void;
  department: string;
}

type EquipmentWithStock = Equipment & {
  quantity: number;
};

type GroupedEquipment = {
  [category: string]: EquipmentWithStock[];
};

export const StockCreationManager = ({ stock, onStockUpdate, department }: StockManagerProps) => {
  const { toast } = useToast();
  const { session } = useOptimizedAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [savingQuantityId, setSavingQuantityId] = useState<string | null>(null);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newQuantity, setNewQuantity] = useState(0);
  const [newManufacturer, setNewManufacturer] = useState('');
  const [newResourceId, setNewResourceId] = useState('');
  const [newImageId, setNewImageId] = useState('');
  const [newFlexUrl, setNewFlexUrl] = useState('');
  const [showFlexSection, setShowFlexSection] = useState(false);
  const [isFetchingFlex, setIsFetchingFlex] = useState(false);

  // Edit form state (inline quick edit)
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');

  // Advanced edit dialog state
  const [advancedEditItem, setAdvancedEditItem] = useState<EquipmentWithStock | null>(null);
  const [advEditName, setAdvEditName] = useState('');
  const [advEditCategory, setAdvEditCategory] = useState('');
  const [advEditManufacturer, setAdvEditManufacturer] = useState('');
  const [advEditResourceId, setAdvEditResourceId] = useState('');
  const [advEditImageId, setAdvEditImageId] = useState('');
  const [advEditFlexUrl, setAdvEditFlexUrl] = useState('');
  const [showAdvFlexSection, setShowAdvFlexSection] = useState(false);
  const [isFetchingAdvFlex, setIsFetchingAdvFlex] = useState(false);

  const categories = getCategoriesForDepartment(department as any);

  // Initialize default category
  useEffect(() => {
    if (categories.length > 0 && !newCategory) {
      setNewCategory(categories[0]);
    }
  }, [categories]);

  // Flex integration helpers
  const extractUuidFromUrl = (url: string): string | null => {
    const match = url.match(UUID_REGEX);
    return match?.[0] || null;
  };

  const handlePasteAndExtract = async (isAdvanced = false) => {
    try {
      const clip = await navigator.clipboard.readText();
      if (isAdvanced) {
        setAdvEditFlexUrl(clip);
      } else {
        setNewFlexUrl(clip);
      }
      const uuid = extractUuidFromUrl(clip);
      if (uuid) {
        if (isAdvanced) {
          setAdvEditResourceId(uuid);
        } else {
          setNewResourceId(uuid);
        }
        toast({ title: 'UUID extraído', description: 'Se ha extraído el ID del recurso de Flex.' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo acceder al portapapeles.', variant: 'destructive' });
    }
  };

  const handleFetchFromFlex = async (isAdvanced = false) => {
    const resourceId = isAdvanced ? advEditResourceId : newResourceId;
    const flexUrl = isAdvanced ? advEditFlexUrl : newFlexUrl;
    const idToFetch = resourceId || extractUuidFromUrl(flexUrl);

    if (!idToFetch) {
      toast({ title: 'Error', description: 'No hay un ID de recurso válido para buscar.', variant: 'destructive' });
      return;
    }

    try {
      if (isAdvanced) {
        setIsFetchingAdvFlex(true);
      } else {
        setIsFetchingFlex(true);
      }

      const { data, error } = await supabase.functions.invoke('fetch-flex-inventory-model', {
        body: { model_id: idToFetch }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const mapped = data?.mapped || {};

      if (isAdvanced) {
        if (mapped.name) setAdvEditName(mapped.name);
        if (mapped.manufacturer) setAdvEditManufacturer(mapped.manufacturer);
        if (data?.model_id) setAdvEditResourceId(data.model_id);
        if (mapped.imageId) setAdvEditImageId(mapped.imageId);
      } else {
        if (mapped.name) setNewName(mapped.name);
        if (mapped.manufacturer) setNewManufacturer(mapped.manufacturer);
        if (data?.model_id) setNewResourceId(data.model_id);
        if (mapped.imageId) setNewImageId(mapped.imageId);
      }

      toast({ title: 'Datos obtenidos', description: 'Los datos del equipo se han rellenado desde Flex.' });
    } catch (e: any) {
      toast({ title: 'Error al obtener datos', description: e?.message || 'Error desconocido', variant: 'destructive' });
    } finally {
      if (isAdvanced) {
        setIsFetchingAdvFlex(false);
      } else {
        setIsFetchingFlex(false);
      }
    }
  };

  const openAdvancedEdit = (item: EquipmentWithStock) => {
    setAdvancedEditItem(item);
    setAdvEditName(item.name);
    setAdvEditCategory(item.category);
    setAdvEditManufacturer(item.manufacturer || '');
    setAdvEditResourceId(item.resource_id || '');
    setAdvEditImageId(item.image_id || '');
    setAdvEditFlexUrl('');
    setShowAdvFlexSection(!!(item.resource_id || item.manufacturer || item.image_id));
  };

  const closeAdvancedEdit = () => {
    setAdvancedEditItem(null);
    setAdvEditName('');
    setAdvEditCategory('');
    setAdvEditManufacturer('');
    setAdvEditResourceId('');
    setAdvEditImageId('');
    setAdvEditFlexUrl('');
    setShowAdvFlexSection(false);
  };

  const resetAddForm = () => {
    setNewName('');
    setNewQuantity(0);
    setNewManufacturer('');
    setNewResourceId('');
    setNewImageId('');
    setNewFlexUrl('');
    setShowFlexSection(false);
    setShowAddForm(false);
  };

  // Fetch equipment list
  const { data: equipmentList = [], refetch: refetchEquipment } = useQuery<Equipment[]>({
    queryKey: ['equipment', department],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .in('category', categories)
        .order('category')
        .order('name');

      if (error) throw error;
      return data;
    }
  });

  // Fetch current stock levels
  const { data: currentStockLevels = [] } = useQuery({
    queryKey: ['current-stock-levels', department],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('current_stock_levels')
        .select('*')
        .in('category', categories);

      if (error) throw error;
      return data;
    }
  });

  // Combine equipment with stock quantities
  const equipmentWithStock: EquipmentWithStock[] = equipmentList.map(equipment => {
    const stockLevel = currentStockLevels.find(s => s.equipment_id === equipment.id);
    return {
      ...equipment,
      quantity: stockLevel?.current_quantity || 0
    };
  });

  // Filter by search
  const filteredEquipment = equipmentWithStock.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by category
  const groupedEquipment: GroupedEquipment = filteredEquipment.reduce((acc, item) => {
    const category = item.category || 'uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as GroupedEquipment);

  // Auto-expand categories with search matches
  useEffect(() => {
    if (searchQuery) {
      setExpandedCategories(new Set(Object.keys(groupedEquipment)));
    }
  }, [searchQuery]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Create equipment mutation
  const createEquipmentMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error('Must be logged in');
      if (!newName.trim()) throw new Error('Name is required');

      // Create equipment
      const { data: equipment, error: eqError } = await supabase
        .from('equipment')
        .insert({
          name: newName.trim(),
          category: newCategory,
          manufacturer: newManufacturer.trim() || null,
          resource_id: newResourceId.trim() || null,
          image_id: newImageId.trim() || null
        })
        .select()
        .single();

      if (eqError) throw eqError;

      // Create stock entry if quantity > 0
      if (newQuantity > 0) {
        const { error: stockError } = await supabase
          .from('global_stock_entries')
          .insert({
            equipment_id: equipment.id,
            base_quantity: newQuantity
          });

        if (stockError) throw stockError;
      }

      return equipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', department] });
      queryClient.invalidateQueries({ queryKey: ['current-stock-levels', department] });
      resetAddForm();
      toast({ title: 'Equipo creado correctamente' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  });

  // Update equipment mutation (inline quick edit)
  const updateEquipmentMutation = useMutation({
    mutationFn: async ({ id, name, category }: { id: string; name: string; category: string }) => {
      const { error } = await supabase
        .from('equipment')
        .update({ name, category })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', department] });
      setEditingItemId(null);
      toast({ title: 'Equipo actualizado' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  });

  // Advanced update mutation (with Flex fields)
  const advancedUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!advancedEditItem) throw new Error('No item selected');

      const { error } = await supabase
        .from('equipment')
        .update({
          name: advEditName.trim(),
          category: advEditCategory,
          manufacturer: advEditManufacturer.trim() || null,
          resource_id: advEditResourceId.trim() || null,
          image_id: advEditImageId.trim() || null
        })
        .eq('id', advancedEditItem.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', department] });
      closeAdvancedEdit();
      toast({ title: 'Equipo actualizado' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  });

  // Delete equipment mutation
  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete stock entries first
      await supabase.from('global_stock_entries').delete().eq('equipment_id', id);
      await supabase.from('stock_movements').delete().eq('equipment_id', id);

      const { error } = await supabase.from('equipment').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', department] });
      queryClient.invalidateQueries({ queryKey: ['current-stock-levels', department] });
      setDeletingItemId(null);
      toast({ title: 'Equipo eliminado' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  });

  // Update quantity mutation with debounce
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ equipmentId, quantity }: { equipmentId: string; quantity: number }) => {
      setSavingQuantityId(equipmentId);

      // Get existing stock entry
      const { data: existing } = await supabase
        .from('global_stock_entries')
        .select('id')
        .eq('equipment_id', equipmentId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('global_stock_entries')
          .update({ base_quantity: quantity })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('global_stock_entries')
          .insert({ equipment_id: equipmentId, base_quantity: quantity });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-stock-levels', department] });
      setSavingQuantityId(null);
    },
    onError: (error) => {
      setSavingQuantityId(null);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  });

  const handleQuantityBlur = (equipmentId: string, value: string) => {
    const quantity = parseInt(value) || 0;
    if (quantity >= 0) {
      updateQuantityMutation.mutate({ equipmentId, quantity });
    }
  };

  const startEdit = (item: EquipmentWithStock) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditCategory(item.category);
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setEditName('');
    setEditCategory('');
  };

  const saveEdit = () => {
    if (editingItemId && editName.trim()) {
      updateEquipmentMutation.mutate({
        id: editingItemId,
        name: editName.trim(),
        category: editCategory
      });
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Search bar */}
      <div className="relative flex-shrink-0">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar equipo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Add Equipment Form (collapsible) */}
      <Collapsible open={showAddForm} onOpenChange={setShowAddForm} className="flex-shrink-0">
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            <Plus className="mr-2 h-4 w-4" />
            {showAddForm ? 'Cancelar' : 'Añadir Equipo'}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 p-4 border rounded-lg space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Label htmlFor="new-name">Nombre</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre del equipo"
                className="mt-1"
                disabled={isFetchingFlex}
              />
            </div>
            <div>
              <Label>Categoría</Label>
              <Select value={newCategory} onValueChange={setNewCategory} disabled={isFetchingFlex}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {allCategoryLabels[cat as AllCategories] || cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="new-qty">Cantidad</Label>
              <Input
                id="new-qty"
                type="number"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                className="mt-1"
                disabled={isFetchingFlex}
              />
            </div>
          </div>

          {/* Flex Integration Section */}
          <Collapsible open={showFlexSection} onOpenChange={setShowFlexSection}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
                <Link className="mr-2 h-4 w-4" />
                {showFlexSection ? 'Ocultar integración Flex' : 'Integración con Flex (opcional)'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-2 p-3 border rounded-md bg-background">
              <div>
                <Label htmlFor="new-manufacturer">Fabricante</Label>
                <Input
                  id="new-manufacturer"
                  value={newManufacturer}
                  onChange={(e) => setNewManufacturer(e.target.value)}
                  placeholder="Fabricante (opcional)"
                  className="mt-1"
                  disabled={isFetchingFlex}
                />
              </div>
              <div>
                <Label htmlFor="new-resourceId">Flex Resource ID</Label>
                <Input
                  id="new-resourceId"
                  value={newResourceId}
                  onChange={(e) => setNewResourceId(e.target.value)}
                  placeholder="UUID del recurso en Flex"
                  className="mt-1"
                  disabled={isFetchingFlex}
                />
              </div>
              <div>
                <Label>URL de Flex</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newFlexUrl}
                    onChange={(e) => setNewFlexUrl(e.target.value)}
                    placeholder="Pegar URL de Flex"
                    disabled={isFetchingFlex}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => handlePasteAndExtract(false)} disabled={isFetchingFlex} title="Pegar URL">
                    <ClipboardPaste className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleFetchFromFlex(false)}
                    disabled={isFetchingFlex || (!newResourceId && !newFlexUrl)}
                  >
                    {isFetchingFlex ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {isFetchingFlex ? 'Obteniendo...' : 'Obtener'}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="new-imageId">Image ID</Label>
                <Input
                  id="new-imageId"
                  value={newImageId}
                  onChange={(e) => setNewImageId(e.target.value)}
                  placeholder="ID de imagen de Flex"
                  className="mt-1"
                  disabled={isFetchingFlex}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={resetAddForm}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => createEquipmentMutation.mutate()}
              disabled={!newName.trim() || createEquipmentMutation.isPending || isFetchingFlex}
            >
              {createEquipmentMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Guardar
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Equipment list grouped by category */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-2 pr-4">
          {Object.entries(groupedEquipment).map(([category, items]) => (
            <Collapsible
              key={category}
              open={expandedCategories.has(category)}
              onOpenChange={() => toggleCategory(category)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  {expandedCategories.has(category) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-medium">
                    {allCategoryLabels[category as AllCategories] || category}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1">
                <div className="space-y-1 pl-2">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md",
                        editingItemId === item.id && "bg-muted"
                      )}
                    >
                      {editingItemId === item.id ? (
                        // Edit mode
                        <>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 h-8"
                          />
                          <Select value={editCategory} onValueChange={setEditCategory}>
                            <SelectTrigger className="w-32 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map(cat => (
                                <SelectItem key={cat} value={cat}>
                                  {allCategoryLabels[cat as AllCategories] || cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={saveEdit}
                            disabled={updateEquipmentMutation.isPending}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : deletingItemId === item.id ? (
                        // Delete confirmation
                        <>
                          <span className="flex-1 text-sm">Eliminar {item.name}?</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => deleteEquipmentMutation.mutate(item.id)}
                            disabled={deleteEquipmentMutation.isPending}
                          >
                            <Check className="h-4 w-4 text-red-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDeletingItemId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        // Normal view
                        <>
                          <span className="flex-1 text-sm">{item.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => startEdit(item)}
                            title="Edición rápida"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openAdvancedEdit(item)}
                            title="Edición avanzada (Flex)"
                          >
                            <Settings2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDeletingItemId(item.id)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <div className="relative w-20">
                            <Input
                              type="number"
                              min="0"
                              defaultValue={item.quantity}
                              onBlur={(e) => handleQuantityBlur(item.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="h-8 text-center pr-6"
                            />
                            {savingQuantityId === item.id && (
                              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}

          {Object.keys(groupedEquipment).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No se encontraron equipos' : 'No hay equipos. Añade uno para empezar.'}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Advanced Edit Dialog */}
      <Dialog open={!!advancedEditItem} onOpenChange={(open) => !open && closeAdvancedEdit()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Equipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="adv-name">Nombre del Equipo</Label>
              <Input
                id="adv-name"
                value={advEditName}
                onChange={(e) => setAdvEditName(e.target.value)}
                placeholder="Nombre del equipo"
                className="mt-1"
                disabled={isFetchingAdvFlex}
              />
            </div>
            <div>
              <Label htmlFor="adv-manufacturer">Fabricante</Label>
              <Input
                id="adv-manufacturer"
                value={advEditManufacturer}
                onChange={(e) => setAdvEditManufacturer(e.target.value)}
                placeholder="Fabricante (opcional)"
                className="mt-1"
                disabled={isFetchingAdvFlex}
              />
            </div>
            <div>
              <Label>Categoría</Label>
              <Select value={advEditCategory} onValueChange={setAdvEditCategory} disabled={isFetchingAdvFlex}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {allCategoryLabels[cat as AllCategories] || cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Collapsible open={showAdvFlexSection} onOpenChange={setShowAdvFlexSection}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-full">
                  <Link className="mr-2 h-4 w-4" />
                  {showAdvFlexSection ? 'Ocultar integración Flex' : 'Integración con Flex (opcional)'}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 mt-3 border rounded-md p-3">
                <div>
                  <Label htmlFor="adv-resourceId">Flex Resource ID</Label>
                  <Input
                    id="adv-resourceId"
                    value={advEditResourceId}
                    onChange={(e) => setAdvEditResourceId(e.target.value)}
                    placeholder="UUID del recurso en Flex"
                    className="mt-1"
                    disabled={isFetchingAdvFlex}
                  />
                </div>
                <div>
                  <Label>URL de Flex</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={advEditFlexUrl}
                      onChange={(e) => setAdvEditFlexUrl(e.target.value)}
                      placeholder="Pegar URL de Flex"
                      disabled={isFetchingAdvFlex}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => handlePasteAndExtract(true)} disabled={isFetchingAdvFlex} title="Pegar URL">
                      <ClipboardPaste className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleFetchFromFlex(true)}
                      disabled={isFetchingAdvFlex || (!advEditResourceId && !advEditFlexUrl)}
                    >
                      {isFetchingAdvFlex ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      {isFetchingAdvFlex ? 'Obteniendo...' : 'Obtener'}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="adv-imageId">Image ID</Label>
                  <Input
                    id="adv-imageId"
                    value={advEditImageId}
                    onChange={(e) => setAdvEditImageId(e.target.value)}
                    placeholder="ID de imagen de Flex"
                    className="mt-1"
                    disabled={isFetchingAdvFlex}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAdvancedEdit}>
              Cancelar
            </Button>
            <Button
              onClick={() => advancedUpdateMutation.mutate()}
              disabled={!advEditName.trim() || advancedUpdateMutation.isPending || isFetchingAdvFlex}
            >
              {advancedUpdateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
