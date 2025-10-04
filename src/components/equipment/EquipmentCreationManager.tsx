
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Equipment, EquipmentCategory, AllCategories } from '@/types/equipment';
import { allCategoryLabels, getCategoriesForDepartment, SOUND_CATEGORIES, LIGHTS_CATEGORIES } from '@/types/equipment';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDepartment } from '@/contexts/DepartmentContext';
import { useContext } from 'react';
import { Department } from '@/types/equipment';

interface EditEquipmentDialogProps {
  equipment: Equipment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (equipment: Partial<Equipment>) => void;
}

function EditEquipmentDialog({ equipment, open, onOpenChange, onSave }: EditEquipmentDialogProps) {
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

  useEffect(() => {
    if (equipment) {
      setName(equipment.name);
      setCategory((equipment.category as string) || categories[0]);
    }
  }, [equipment, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: equipment?.id,
      name,
      category: category as any // Type cast for flexibility
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{equipment ? 'Editar Equipo' : 'Nuevo Equipo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Equipo</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
          <DialogFooter>
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EquipmentCreationManagerProps {
  onEquipmentChange?: () => void;
}

export function EquipmentCreationManager({ onEquipmentChange }: EquipmentCreationManagerProps) {
  const { session } = useOptimizedAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Optionally use department context - works with or without DepartmentProvider
  let department: Department | undefined;
  try {
    const context = useDepartment();
    department = context.department;
  } catch {
    department = undefined;
  }
  
  const categories = department ? getCategoriesForDepartment(department) : [...SOUND_CATEGORIES, ...LIGHTS_CATEGORIES];
  const [equipmentName, setEquipmentName] = useState('');
  const [category, setCategory] = useState<string>(categories[0] || 'convencional');
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);

  const { data: equipmentList } = useQuery({
    queryKey: department ? ['equipment', department] : ['equipment'],
    queryFn: async () => {
      let query = supabase
        .from('equipment')
        .select('*');
      
      if (department) {
        query = query.eq('department', department);
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
          department: department || 'sound' // Default to 'sound' if no department context
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
          category: equipment.category
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
