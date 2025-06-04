import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, FileText } from "lucide-react";
import { useTourWeightDefaults } from "@/hooks/useTourWeightDefaults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TourWeightDefaultsSectionProps {
  tourId: string;
}

export const TourWeightDefaultsSection: React.FC<TourWeightDefaultsSectionProps> = ({ tourId }) => {
  const { weightDefaults, createDefault, deleteDefault, isLoading } = useTourWeightDefaults(tourId);
  const [newDefault, setNewDefault] = useState({
    item_name: '',
    weight_kg: '',
    quantity: '1',
    category: 'rigging' as const,
    department: 'sound' as const
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDefault.item_name || !newDefault.weight_kg) return;

    try {
      await createDefault({
        tour_id: tourId,
        item_name: newDefault.item_name,
        weight_kg: parseFloat(newDefault.weight_kg),
        quantity: parseInt(newDefault.quantity),
        category: newDefault.category,
        department: newDefault.department
      });

      setNewDefault({
        item_name: '',
        weight_kg: '',
        quantity: '1',
        category: 'rigging',
        department: 'sound'
      });
    } catch (error) {
      console.error('Error creating weight default:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDefault(id);
    } catch (error) {
      console.error('Error deleting weight default:', error);
    }
  };

  if (isLoading) {
    return <div>Loading weight defaults...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Add New Default Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Weight Default
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="item_name">Item Name</Label>
                <Input
                  id="item_name"
                  value={newDefault.item_name}
                  onChange={(e) => setNewDefault(prev => ({ ...prev, item_name: e.target.value }))}
                  placeholder="e.g., K2 Array"
                  required
                />
              </div>
              <div>
                <Label htmlFor="weight_kg">Weight (kg)</Label>
                <Input
                  id="weight_kg"
                  type="number"
                  step="0.01"
                  value={newDefault.weight_kg}
                  onChange={(e) => setNewDefault(prev => ({ ...prev, weight_kg: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={newDefault.quantity}
                  onChange={(e) => setNewDefault(prev => ({ ...prev, quantity: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Select 
                  value={newDefault.department} 
                  onValueChange={(value: 'sound' | 'lights' | 'video') => 
                    setNewDefault(prev => ({ ...prev, department: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sound">Sound</SelectItem>
                    <SelectItem value="lights">Lights</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit">Add Default</Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Current Weight Defaults
          </CardTitle>
        </CardHeader>
        <CardContent>
          {weightDefaults.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No weight defaults found. Add your first default above.
            </p>
          ) : (
            <div className="space-y-4">
              {weightDefaults.map((weightDefault) => (
                <div key={weightDefault.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <h4 className="font-medium">{weightDefault.item_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {weightDefault.weight_kg} kg × {weightDefault.quantity} = {(weightDefault.weight_kg * weightDefault.quantity).toFixed(2)} kg total
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="capitalize">{weightDefault.department}</span> • <span className="capitalize">{weightDefault.category}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(weightDefault.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
