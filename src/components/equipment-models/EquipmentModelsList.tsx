
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit2, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CreateEquipmentModelDialog } from "./CreateEquipmentModelDialog";
import { EditEquipmentModelDialog } from "./EditEquipmentModelDialog";

interface EquipmentModel {
  id: string;
  name: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export const EquipmentModelsList = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<EquipmentModel | null>(null);

  const { data: models, isLoading } = useQuery({
    queryKey: ["equipment-models"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_models")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data as EquipmentModel[];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (modelId: string) => {
      const { error } = await supabase
        .from("equipment_models")
        .delete()
        .eq("id", modelId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-models"] });
      toast({
        title: "Success",
        description: "Equipment model deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleDelete = (model: EquipmentModel) => {
    if (confirm(`Are you sure you want to delete "${model.name}"?`)) {
      deleteMutation.mutate(model.id);
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'foh_console': return 'FOH Consoles';
      case 'mon_console': return 'Monitor Consoles';
      case 'wireless': return 'Wireless Systems';
      case 'iem': return 'IEM Systems';
      default: return category;
    }
  };

  const getCategoryModels = (category: string) => {
    return models?.filter(model => model.category === category) || [];
  };

  const renderModelCard = (model: EquipmentModel) => (
    <Card key={model.id} className="mb-3">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="font-medium">{model.name}</span>
          <Badge variant="outline" className="text-xs">
            {model.category}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditingModel(model)}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(model)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return <div>Loading equipment models...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Equipment Models</h3>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Model
        </Button>
      </div>

      <Tabs defaultValue="foh_console" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="foh_console">FOH Consoles</TabsTrigger>
          <TabsTrigger value="mon_console">Monitor Consoles</TabsTrigger>
          <TabsTrigger value="wireless">Wireless</TabsTrigger>
          <TabsTrigger value="iem">IEM Systems</TabsTrigger>
        </TabsList>

        <TabsContent value="foh_console" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>FOH Console Models</CardTitle>
            </CardHeader>
            <CardContent>
              {getCategoryModels('foh_console').map(renderModelCard)}
              {getCategoryModels('foh_console').length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  No FOH console models found
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mon_console" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Monitor Console Models</CardTitle>
            </CardHeader>
            <CardContent>
              {getCategoryModels('mon_console').map(renderModelCard)}
              {getCategoryModels('mon_console').length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  No monitor console models found
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wireless" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Wireless System Models</CardTitle>
            </CardHeader>
            <CardContent>
              {getCategoryModels('wireless').map(renderModelCard)}
              {getCategoryModels('wireless').length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  No wireless system models found
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iem" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>IEM System Models</CardTitle>
            </CardHeader>
            <CardContent>
              {getCategoryModels('iem').map(renderModelCard)}
              {getCategoryModels('iem').length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  No IEM system models found
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateEquipmentModelDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {editingModel && (
        <EditEquipmentModelDialog
          model={editingModel}
          open={!!editingModel}
          onOpenChange={() => setEditingModel(null)}
        />
      )}
    </div>
  );
};
