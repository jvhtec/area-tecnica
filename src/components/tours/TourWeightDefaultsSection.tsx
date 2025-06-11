
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Weight } from "lucide-react";
import { useTourWeightDefaults, TourWeightDefault } from "@/hooks/useTourWeightDefaults";

interface TourWeightDefaultsSectionProps {
  tourId: string;
}

interface WeightDefaultForm {
  item_name: string;
  weight_kg: string;
  quantity: string;
  category: string;
  department: string;
}

const defaultForm: WeightDefaultForm = {
  item_name: "",
  weight_kg: "",
  quantity: "1",
  category: "",
  department: "all",
};

export const TourWeightDefaultsSection: React.FC<TourWeightDefaultsSectionProps> = ({ tourId }) => {
  const [formData, setFormData] = useState<WeightDefaultForm>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const {
    weightDefaults,
    isLoading,
    createDefault,
    updateDefault,
    deleteDefault,
    isCreating,
    isUpdating,
  } = useTourWeightDefaults(tourId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.item_name || !formData.weight_kg) {
      return;
    }

    const weightData = {
      tour_id: tourId,
      item_name: formData.item_name,
      weight_kg: parseFloat(formData.weight_kg),
      quantity: parseInt(formData.quantity) || 1,
      category: formData.category || null,
      department: formData.department === "all" ? null : formData.department,
    };

    if (editingId) {
      // For updates, we need to include the required fields
      const existingDefault = weightDefaults.find(wd => wd.id === editingId);
      if (existingDefault) {
        updateDefault({
          id: editingId,
          ...weightData,
          created_at: existingDefault.created_at,
          updated_at: new Date().toISOString()
        });
      }
      setEditingId(null);
    } else {
      createDefault(weightData);
    }
    
    setFormData(defaultForm);
  };

  const handleEdit = (weightDefault: TourWeightDefault) => {
    setFormData({
      item_name: weightDefault.item_name,
      weight_kg: weightDefault.weight_kg.toString(),
      quantity: weightDefault.quantity.toString(),
      category: weightDefault.category || "",
      department: weightDefault.department || "all",
    });
    setEditingId(weightDefault.id);
  };

  const handleCancel = () => {
    setFormData(defaultForm);
    setEditingId(null);
  };

  const getTotalWeight = () => {
    return weightDefaults.reduce((total, item) => total + (item.weight_kg * item.quantity), 0);
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading weight defaults...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Weight className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Default Weight Requirements</h3>
        </div>
        {weightDefaults.length > 0 && (
          <div className="text-sm font-medium">
            Total: {getTotalWeight().toFixed(1)} kg
          </div>
        )}
      </div>

      {/* Existing weight defaults */}
      <div className="space-y-3">
        {weightDefaults.map((weightDefault) => (
          <Card key={weightDefault.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-medium">{weightDefault.item_name}</div>
                <div className="text-sm text-muted-foreground">
                  {weightDefault.weight_kg} kg × {weightDefault.quantity} = {(weightDefault.weight_kg * weightDefault.quantity).toFixed(1)} kg
                  {weightDefault.category && ` - ${weightDefault.category}`}
                  {weightDefault.department && ` (${weightDefault.department})`}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(weightDefault)}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteDefault(weightDefault.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add/Edit form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? "Edit Weight Default" : "Add Weight Default"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="item_name">Item Name</Label>
                <Input
                  id="item_name"
                  value={formData.item_name}
                  onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                  placeholder="e.g., L-Acoustics K2, LED Par"
                  required
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Speakers, Lights"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="weight_kg">Weight (kg)</Label>
                <Input
                  id="weight_kg"
                  type="number"
                  step="0.1"
                  value={formData.weight_kg}
                  onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                  placeholder="e.g., 85.5"
                  required
                />
              </div>
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => setFormData({ ...formData, department: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="sound">Sound</SelectItem>
                    <SelectItem value="lights">Lights</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isCreating || isUpdating}>
                <Plus className="h-4 w-4 mr-2" />
                {editingId ? "Update" : "Add"} Default
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
