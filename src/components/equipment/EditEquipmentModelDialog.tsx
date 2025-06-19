
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEquipmentModels, EquipmentModel } from "@/hooks/useEquipmentModels";

const categories = [
  { value: 'foh_console', label: 'FOH Console' },
  { value: 'mon_console', label: 'Monitor Console' },
  { value: 'wireless', label: 'Wireless System' },
  { value: 'iem', label: 'IEM System' }
];

interface EditEquipmentModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: EquipmentModel | null;
}

export const EditEquipmentModelDialog = ({
  open,
  onOpenChange,
  model
}: EditEquipmentModelDialogProps) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const { updateModel, isUpdating } = useEquipmentModels();

  useEffect(() => {
    if (model) {
      setName(model.name);
      setCategory(model.category);
    }
  }, [model]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!model || !name.trim()) return;

    updateModel({ id: model.id, name: name.trim(), category });
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
      setCategory("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Equipment Model</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Model Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter model name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Update"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
