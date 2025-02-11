import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSessionManager } from '@/hooks/useSessionManager';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Equipment } from '@/types/equipment';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const EQUIPMENT_CATEGORIES = ['convencional', 'robotica', 'fx', 'rigging', 'controles', 'cuadros', 'led', 'strobo', 'canones'] as const;
type EquipmentCategory = typeof EQUIPMENT_CATEGORIES[number];

interface EditEquipmentDialogProps {
  equipment: Equipment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (equipment: Partial<Equipment>) => void;
}

interface PresetCreationManagerProps {
  onClose?: () => void;
  selectedDate?: Date;
}

function EditEquipmentDialog({ equipment, open, onOpenChange, onSave }: EditEquipmentDialogProps) {
  const [name, setName] = useState(equipment?.name || '');
  const [category, setCategory] = useState<EquipmentCategory>((equipment?.category as EquipmentCategory) || 'convencional');

  useEffect(() => {
    if (equipment) {
      setName(equipment.name);
      setCategory((equipment.category as EquipmentCategory) || 'convencional');
    }
  }, [equipment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: equipment?.id,
      name,
      category
    });
    onOpenChange(false);
  };

  const categoryLabels: Record<EquipmentCategory, string> = {
    convencional: 'Convencional',
    robotica: 'Robótica',
    controles: 'Controles',
    fx: 'FX',
    cuadros: 'Cuadros',
    rigging: 'Rigging',
    led: 'LED',
    strobo: 'Strobo',
    canones: 'Cañones'
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
            <Select value={category} onValueChange={(value) => setCategory(value as EquipmentCategory)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione categoría" />
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {categoryLabels[cat]}
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

export function PresetCreationManager({ onClose, selectedDate }: PresetCreationManagerProps) {
  const { session } = useSessionManager();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [equipmentName, setEquipmentName] = useState('');
  const [category, setCategory] = useState<EquipmentCategory>('convencional');
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);

  const { data: equipmentList } = useQuery({
    queryKey: ['equipment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('name');
      
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
          category: category
        })
        .select()
        .single();

      if (error) throw error;
      return equipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      setEquipmentName('');
      setCategory('convencional');
      toast({
        title: "Éxito",
        description: "Equipo creado correctamente"
      });
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
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast({
        title: "Éxito",
        description: "Equipo actualizado correctamente"
      });
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
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast({
        title: "Éxito",
        description: "Equipo eliminado correctamente"
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al eliminar el equipo"
      });
    }
  });

  const categoryLabels: Record<EquipmentCategory, string> = {
    convencional: 'Convencional',
    robotica: 'Robótica',
    controles: 'Controles',
    fx: 'FX',
    cuadros: 'Cuadros',
    rigging: 'Rigging',
    led: 'LED',
    strobo: 'Strobo',
    canones: 'Cañones'
  };

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
          <Select value={category} onValueChange={(value) => setCategory(value as EquipmentCategory)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccione categoría" />
            </SelectTrigger>
            <SelectContent>
              {EQUIPMENT_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {categoryLabels[cat]}
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
                  <p className="text-sm text-muted-foreground capitalize">{categoryLabels[item.category as EquipmentCategory]}</p>
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
