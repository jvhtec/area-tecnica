import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
      return data.map(item => ({
        ...item,
        template_data: item.template_data as any
      })) as HojaDeRutaTemplate[];
    }
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (template: Omit<HojaDeRutaTemplate, 'id'>) => {
      const { data, error } = await supabase
        .from('hoja_de_ruta_templates')
        .insert({
          ...template,
          template_data: template.template_data as any
        })
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
        .update({
          ...updates,
          ...(updates.template_data && { template_data: updates.template_data as any })
        })
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

// Equipment hook removed per user request