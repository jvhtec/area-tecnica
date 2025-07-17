import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { HojaDeRutaTemplate } from '@/types/hoja-de-ruta';

export const useHojaDeRutaTemplates = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all active templates
  const {
    data: templates = [],
    isLoading: isLoadingTemplates,
    error: templatesError
  } = useQuery({
    queryKey: ['hoja-de-ruta-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hoja_de_ruta_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as HojaDeRutaTemplate[];
    }
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (template: Omit<HojaDeRutaTemplate, 'id'>) => {
      const { data, error } = await supabase
        .from('hoja_de_ruta_templates')
        .insert(template)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta-templates'] });
      toast({
        title: "Plantilla creada",
        description: "La plantilla se ha creado correctamente."
      });
    },
    onError: (error) => {
      console.error('Error creating template:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la plantilla.",
        variant: "destructive"
      });
    }
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<HojaDeRutaTemplate> }) => {
      const { data, error } = await supabase
        .from('hoja_de_ruta_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta-templates'] });
      toast({
        title: "Plantilla actualizada",
        description: "La plantilla se ha actualizado correctamente."
      });
    },
    onError: (error) => {
      console.error('Error updating template:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la plantilla.",
        variant: "destructive"
      });
    }
  });

  // Delete template mutation (soft delete by setting is_active to false)
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('hoja_de_ruta_templates')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta-templates'] });
      toast({
        title: "Plantilla eliminada",
        description: "La plantilla se ha eliminado correctamente."
      });
    },
    onError: (error) => {
      console.error('Error deleting template:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la plantilla.",
        variant: "destructive"
      });
    }
  });

  return {
    templates,
    isLoadingTemplates,
    templatesError,
    createTemplate: createTemplateMutation.mutate,
    updateTemplate: updateTemplateMutation.mutate,
    deleteTemplate: deleteTemplateMutation.mutate,
    isCreating: createTemplateMutation.isPending,
    isUpdating: updateTemplateMutation.isPending,
    isDeleting: deleteTemplateMutation.isPending
  };
};

export const useHojaDeRutaEquipment = (hojaDeRutaId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch equipment for a specific hoja de ruta
  const {
    data: equipment = [],
    isLoading: isLoadingEquipment,
    error: equipmentError
  } = useQuery({
    queryKey: ['hoja-de-ruta-equipment', hojaDeRutaId],
    queryFn: async () => {
      if (!hojaDeRutaId) return [];
      
      const { data, error } = await supabase
        .from('hoja_de_ruta_equipment')
        .select('*')
        .eq('hoja_de_ruta_id', hojaDeRutaId)
        .order('equipment_category', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!hojaDeRutaId
  });

  // Save equipment mutation
  const saveEquipmentMutation = useMutation({
    mutationFn: async ({ hojaDeRutaId, equipmentList }: { 
      hojaDeRutaId: string; 
      equipmentList: any[] 
    }) => {
      // First, delete existing equipment
      const { error: deleteError } = await supabase
        .from('hoja_de_ruta_equipment')
        .delete()
        .eq('hoja_de_ruta_id', hojaDeRutaId);

      if (deleteError) throw deleteError;

      // Then insert new equipment
      if (equipmentList.length > 0) {
        const { data, error: insertError } = await supabase
          .from('hoja_de_ruta_equipment')
          .insert(
            equipmentList.map(eq => ({
              hoja_de_ruta_id: hojaDeRutaId,
              equipment_category: eq.equipment_category,
              equipment_name: eq.equipment_name,
              quantity: eq.quantity,
              notes: eq.notes
            }))
          )
          .select();

        if (insertError) throw insertError;
        return data;
      }
      return [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta-equipment'] });
      toast({
        title: "Equipamiento guardado",
        description: "El equipamiento se ha guardado correctamente."
      });
    },
    onError: (error) => {
      console.error('Error saving equipment:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el equipamiento.",
        variant: "destructive"
      });
    }
  });

  return {
    equipment,
    isLoadingEquipment,
    equipmentError,
    saveEquipment: saveEquipmentMutation.mutate,
    isSavingEquipment: saveEquipmentMutation.isPending
  };
};