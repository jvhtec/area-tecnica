import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Equipment, AllCategories } from '@/types/equipment';
import { allCategoryLabels, getCategoriesForDepartment, SOUND_CATEGORIES, LIGHTS_CATEGORIES, Department } from '@/types/equipment';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Pencil, Loader2, ClipboardPaste, Link, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDepartment } from '@/contexts/DepartmentContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// UUID regex for extracting Flex resource IDs
const UUID_REGEX = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/;

interface EditEquipmentDialogProps {
  equipment: Equipment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (equipment: Partial<Equipment>) => void;
}

function EditEquipmentDialog({ equipment, open, onOpenChange, onSave }: EditEquipmentDialogProps) {
  const { toast } = useToast();

  // Optionally use department context
  let department: Department | undefined;
  try {
    const context = useDepartment();
    department = context.department;
  } catch {
    department = undefined;
  }

  const categories = department ? getCategoriesForDepartment(department) : [...SOUND_CATEGORIES, ...LIGHTS_CATEGORIES];
  const [name, setName] = useState(equipment?.name || '');
  const [category, setCategory] = useState<string>((equipment?.category as string) || categories[0]);
  const [manufacturer, setManufacturer] = useState(equipment?.manufacturer || '');
  const [resourceId, setResourceId] = useState(equipment?.resource_id || '');
  const [imageId, setImageId] = useState(equipment?.image_id || '');
  const [flexUrl, setFlexUrl] = useState('');
  const [isFetchingFlex, setIsFetchingFlex] = useState(false);
  const [showFlexSection, setShowFlexSection] = useState(false);

  useEffect(() => {
    if (equipment) {
      setName(equipment.name);
      setCategory((equipment.category as string) || categories[0]);
      setManufacturer(equipment.manufacturer || '');
      setResourceId(equipment.resource_id || '');
      setImageId(equipment.image_id || '');
      setShowFlexSection(!!(equipment.resource_id || equipment.manufacturer || equipment.image_id));
    }
  }, [equipment?.id]);

  const extractUuidFromUrl = (url: string): string | null => {
    const match = url.match(UUID_REGEX);
    return match?.[0] || null;
  };

  const handlePasteAndExtract = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      setFlexUrl(clip);
      const uuid = extractUuidFromUrl(clip);
      if (uuid) {
        setResourceId(uuid);
        toast({ title: 'UUID extraído', description: 'Se ha extraído el ID del recurso de Flex.' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo acceder al portapapeles.', variant: 'destructive' });
    }
  };

  const handleFetchFromFlex = async () => {
    const idToFetch = resourceId || extractUuidFromUrl(flexUrl);
    if (!idToFetch) {
      toast({ title: 'Error', description: 'No hay un ID de recurso válido para buscar.', variant: 'destructive' });
      return;
    }

    try {
      setIsFetchingFlex(true);
      const { data, error } = await supabase.functions.invoke('fetch-flex-inventory-model', {
        body: { model_id: idToFetch }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const mapped = data?.mapped || {};
      if (mapped.name) setName(mapped.name);
      if (mapped.manufacturer) setManufacturer(mapped.manufacturer);
      if (data?.model_id) setResourceId(data.model_id);
      if (mapped.imageId) setImageId(mapped.imageId);

      toast({ title: 'Datos obtenidos', description: 'Los datos del equipo se han rellenado desde Flex.' });
    } catch (e: any) {
      toast({ title: 'Error al obtener datos', description: e?.message || 'Error desconocido', variant: 'destructive' });
    } finally {
      setIsFetchingFlex(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: equipment?.id,
      name,
      category: category as any,
      manufacturer: manufacturer.trim() || null,
      resource_id: resourceId.trim() || null,
      image_id: imageId.trim() || null
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{equipment ? 'Editar Equipo' : 'Nuevo Equipo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nombre del Equipo</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ingrese nombre del equipo"
              disabled={isFetchingFlex}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-manufacturer">Fabricante</Label>
            <Input
              id="edit-manufacturer"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="Fabricante (opcional)"
              disabled={isFetchingFlex}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-category">Categoría</Label>
            <Select value={category} onValueChange={(value) => setCategory(value)} disabled={isFetchingFlex}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {allCategoryLabels[cat as AllCategories] || cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Collapsible open={showFlexSection} onOpenChange={setShowFlexSection}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="w-full">
                <Link className="mr-2 h-4 w-4" />
                {showFlexSection ? 'Ocultar integración Flex' : 'Integración con Flex (opcional)'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-3 border rounded-md p-3">
              <div className="space-y-2">
                <Label htmlFor="edit-resourceId">Flex Resource ID</Label>
                <Input
                  id="edit-resourceId"
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                  placeholder="adcf7550-4fa3-11eb-815f-2a0a4490a7fb"
                  disabled={isFetchingFlex}
                />
              </div>
              <div className="space-y-2">
                <Label>URL de Flex</Label>
                <div className="flex gap-2">
                  <Input
                    value={flexUrl}
                    onChange={(e) => setFlexUrl(e.target.value)}
                    placeholder="Pegar URL de Flex"
                    disabled={isFetchingFlex}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handlePasteAndExtract} disabled={isFetchingFlex} title="Pegar URL">
                    <ClipboardPaste className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleFetchFromFlex}
                    disabled={isFetchingFlex || (!resourceId && !flexUrl)}
                  >
                    {isFetchingFlex ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {isFetchingFlex ? 'Obteniendo...' : 'Obtener datos'}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-imageId">Image ID</Label>
                <Input
                  id="edit-imageId"
                  value={imageId}
                  onChange={(e) => setImageId(e.target.value)}
                  placeholder="ID de imagen de Flex"
                  disabled={isFetchingFlex}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isFetchingFlex}>Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EquipmentCreationManagerProps {
  onEquipmentChange?: () => void;
  department?: string;
}

/**
 * Provides a UI to create, view, edit, and delete equipment for a given department or globally.
 *
 * The component renders a form for adding equipment, a scrollable list of existing equipment, an edit dialog,
 * and a deletion confirmation. It optionally integrates with Flex to paste/extract a resource UUID and fetch
 * equipment data, and it keeps data consistent by invalidating equipment queries after create/update/delete operations.
 *
 * @param onEquipmentChange - Optional callback invoked after equipment is created, updated, or deleted.
 * @param department - Optional department to scope which categories and equipment are shown; if omitted the component will attempt to obtain a department from context or fall back to global categories.
 * @returns The component's JSX element.
 */
export function EquipmentCreationManager({ onEquipmentChange, department: propDepartment }: EquipmentCreationManagerProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use prop department if provided, otherwise try context
  let department: Department | undefined = propDepartment as Department | undefined;
  if (!department) {
    try {
      const context = useDepartment();
      department = context.department;
    } catch {
      department = undefined;
    }
  }

  const categories = department ? getCategoriesForDepartment(department) : [...SOUND_CATEGORIES, ...LIGHTS_CATEGORIES];

  // Form state for new equipment
  const [equipmentName, setEquipmentName] = useState('');
  const [category, setCategory] = useState<string>(categories[0] || 'convencional');
  const [manufacturer, setManufacturer] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [imageId, setImageId] = useState('');
  const [flexUrl, setFlexUrl] = useState('');
  const [isFetchingFlex, setIsFetchingFlex] = useState(false);
  const [showFlexSection, setShowFlexSection] = useState(false);

  // Dialog state
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);

  const extractUuidFromUrl = (url: string): string | null => {
    const match = url.match(UUID_REGEX);
    return match?.[0] || null;
  };

  const handlePasteAndExtract = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      setFlexUrl(clip);
      const uuid = extractUuidFromUrl(clip);
      if (uuid) {
        setResourceId(uuid);
        toast({ title: 'UUID extraído', description: 'Se ha extraído el ID del recurso de Flex.' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo acceder al portapapeles.', variant: 'destructive' });
    }
  };

  const handleFetchFromFlex = async () => {
    const idToFetch = resourceId || extractUuidFromUrl(flexUrl);
    if (!idToFetch) {
      toast({ title: 'Error', description: 'No hay un ID de recurso válido para buscar.', variant: 'destructive' });
      return;
    }

    try {
      setIsFetchingFlex(true);
      const { data, error } = await supabase.functions.invoke('fetch-flex-inventory-model', {
        body: { model_id: idToFetch }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const mapped = data?.mapped || {};
      if (mapped.name) setEquipmentName(mapped.name);
      if (mapped.manufacturer) setManufacturer(mapped.manufacturer);
      if (data?.model_id) setResourceId(data.model_id);
      if (mapped.imageId) setImageId(mapped.imageId);

      toast({ title: 'Datos obtenidos', description: 'Los datos del equipo se han rellenado desde Flex.' });
    } catch (e: any) {
      toast({ title: 'Error al obtener datos', description: e?.message || 'Error desconocido', variant: 'destructive' });
    } finally {
      setIsFetchingFlex(false);
    }
  };

  const resetForm = () => {
    setEquipmentName('');
    setManufacturer('');
    setCategory(categories[0] || 'convencional');
    setResourceId('');
    setImageId('');
    setFlexUrl('');
    setShowFlexSection(false);
  };

  const { data: equipmentList } = useQuery({
    queryKey: department ? ['equipment', department] : ['equipment'],
    queryFn: async () => {
      let query = supabase
        .from('equipment')
        .select('*');

      if (department) {
        const deptCategories = getCategoriesForDepartment(department);
        query = query.in('category', deptCategories);
      }

      query = query.order('name');

      const { data, error } = await query;

      if (error) throw error;
      return data as Equipment[];
    }
  });

  const createEquipmentMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error('Must be logged in');
      if (!equipmentName.trim()) throw new Error('Equipment name is required');

      const { data: equipment, error } = await supabase
        .from('equipment')
        .insert({
          name: equipmentName,
          category: category,
          manufacturer: manufacturer.trim() || null,
          resource_id: resourceId.trim() || null,
          image_id: imageId.trim() || null
        })
        .select()
        .single();

      if (error) throw error;
      return equipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: department ? ['equipment', department] : ['equipment'] });
      setEquipmentName('');
      setCategory(categories[0] || 'convencional');
      setManufacturer('');
      setResourceId('');
      setImageId('');
      setFlexUrl('');
      setShowFlexSection(false);
      toast({
        title: "Éxito",
        description: "Equipo creado correctamente"
      });
      onEquipmentChange?.();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  });

  const updateEquipmentMutation = useMutation({
    mutationFn: async (equipment: Partial<Equipment>) => {
      if (!equipment.id) throw new Error('Equipment ID is required');

      const { error } = await supabase
        .from('equipment')
        .update({
          name: equipment.name,
          category: equipment.category,
          manufacturer: equipment.manufacturer,
          resource_id: equipment.resource_id,
          image_id: equipment.image_id
        })
        .eq('id', equipment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: department ? ['equipment', department] : ['equipment'] });
      toast({
        title: "Éxito",
        description: "Equipo actualizado correctamente"
      });
      onEquipmentChange?.();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al actualizar el equipo"
      });
    }
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (equipmentId: string) => {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', equipmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: department ? ['equipment', department] : ['equipment'] });
      toast({
        title: "Éxito",
        description: "Equipo eliminado correctamente"
      });
      onEquipmentChange?.();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al eliminar el equipo"
      });
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="equipmentName">Nombre del Equipo</Label>
          <Input
            id="equipmentName"
            value={equipmentName}
            onChange={(e) => setEquipmentName(e.target.value)}
            placeholder="Ingrese nombre del equipo"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoría</Label>
          <Select value={category} onValueChange={(value) => setCategory(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccione categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {allCategoryLabels[cat as AllCategories] || cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="manufacturer">Fabricante</Label>
          <Input
            id="manufacturer"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            placeholder="Fabricante (opcional)"
          />
        </div>

        <Collapsible open={showFlexSection} onOpenChange={setShowFlexSection}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="w-full">
              <Link className="mr-2 h-4 w-4" />
              {showFlexSection ? 'Ocultar integración Flex' : 'Integración con Flex (opcional)'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3 border rounded-md p-3">
            <div className="space-y-2">
              <Label htmlFor="resourceId">Flex Resource ID</Label>
              <Input
                id="resourceId"
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                placeholder="adcf7550-4fa3-11eb-815f-2a0a4490a7fb"
                disabled={isFetchingFlex}
              />
            </div>
            <div className="space-y-2">
              <Label>URL de Flex</Label>
              <div className="flex gap-2">
                <Input
                  value={flexUrl}
                  onChange={(e) => setFlexUrl(e.target.value)}
                  placeholder="Pegar URL de Flex"
                  disabled={isFetchingFlex}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={handlePasteAndExtract} disabled={isFetchingFlex} title="Pegar URL">
                  <ClipboardPaste className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleFetchFromFlex}
                  disabled={isFetchingFlex || (!resourceId && !flexUrl)}
                >
                  {isFetchingFlex ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {isFetchingFlex ? 'Obteniendo...' : 'Obtener datos'}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageId">Image ID</Label>
              <Input
                id="imageId"
                value={imageId}
                onChange={(e) => setImageId(e.target.value)}
                placeholder="ID de imagen de Flex"
                disabled={isFetchingFlex}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Button
          onClick={() => createEquipmentMutation.mutate()}
          disabled={createEquipmentMutation.isPending || !equipmentName.trim()}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Añadir Equipo
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium">Lista de Equipos</h3>
        <ScrollArea className="h-[300px] rounded-md border p-4">
          <div className="space-y-4">
            {equipmentList?.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{allCategoryLabels[item.category as AllCategories] || item.category}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingEquipment(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEquipmentToDelete(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <EditEquipmentDialog
        equipment={editingEquipment}
        open={!!editingEquipment}
        onOpenChange={(open) => !open && setEditingEquipment(null)}
        onSave={updateEquipmentMutation.mutate}
      />

      <AlertDialog
        open={!!equipmentToDelete}
        onOpenChange={(open) => !open && setEquipmentToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el equipo
              y lo quitará de tu inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (equipmentToDelete) {
                  deleteEquipmentMutation.mutate(equipmentToDelete.id);
                  setEquipmentToDelete(null);
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}