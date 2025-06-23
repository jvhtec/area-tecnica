
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useEquipmentModels, EquipmentModel } from "@/hooks/useEquipmentModels";
import { CreateEquipmentModelDialog } from "./CreateEquipmentModelDialog";
import { EditEquipmentModelDialog } from "./EditEquipmentModelDialog";

const categories = [
  { value: 'foh_console', label: 'FOH Consoles' },
  { value: 'mon_console', label: 'Monitor Consoles' },
  { value: 'wireless', label: 'Wireless Systems' },
  { value: 'iem', label: 'IEM Systems' },
  { value: 'wired_mics', label: 'Wired Microphones' }
];

export const EquipmentModelsList = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<EquipmentModel | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('foh_console');

  const { models, isLoading, deleteModel, isDeleting } = useEquipmentModels();

  const filteredModels = models.filter(model => model.category === selectedCategory);

  const handleEdit = (model: EquipmentModel) => {
    setSelectedModel(model);
    setEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this equipment model?')) {
      deleteModel(id);
    }
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading equipment models...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium">Equipment Models</h4>
        <Button
          size="sm"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Model
        </Button>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid w-full grid-cols-5">
          {categories.map((category) => (
            <TabsTrigger key={category.value} value={category.value}>
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category.value} value={category.value} className="space-y-2">
            {filteredModels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No models in this category
              </p>
            ) : (
              <div className="space-y-2">
                {filteredModels.map((model) => (
                  <div
                    key={model.id}
                    className="flex items-center justify-between p-2 border rounded-lg"
                  >
                    <span className="text-sm">{model.name}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(model)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(model.id)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <CreateEquipmentModelDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultCategory={selectedCategory}
      />

      <EditEquipmentModelDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        model={selectedModel}
      />
    </div>
  );
};
