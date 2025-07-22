
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { HojaDeRutaTemplate, EventData } from "@/types/hoja-de-ruta";

export const useHojaDeRutaTemplates = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['hoja-de-ruta-templates'],
    queryFn: async () => {
      console.log("📋 TEMPLATES: Fetching templates");
      
      const { data, error } = await supabase
        .from('hoja_de_ruta_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('❌ TEMPLATES: Error fetching templates:', error);
        throw error;
      }

      console.log("✅ TEMPLATES: Fetched templates:", data?.length || 0);
      return data || [];
    }
  });

  // Create template mutation
  const { mutateAsync: createTemplate, isPending: isCreating } = useMutation({
    mutationFn: async (templateData: {
      name: string;
      description?: string;
      event_type: string;
      template_data: EventData;
    }) => {
      console.log("💾 TEMPLATES: Creating template:", templateData.name);
      
      const { data, error } = await supabase
        .from('hoja_de_ruta_templates')
        .insert({
          ...templateData,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) {
        console.error('❌ TEMPLATES: Error creating template:', error);
        throw error;
      }

      console.log("✅ TEMPLATES: Template created:", data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoja-de-ruta-templates'] });
      toast({
        title: "📋 Plantilla creada",
        description: "La plantilla se ha creado correctamente.",
      });
    },
    onError: (error) => {
      console.error('❌ TEMPLATES: Error creating template:', error);
      toast({
        title: "❌ Error al crear plantilla",
        description: `No se pudo crear la plantilla: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  return {
    templates,
    isLoadingTemplates,
    createTemplate,
    isCreating
  };
};
