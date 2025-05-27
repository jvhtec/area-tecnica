
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DefaultItem {
  id: string;
  name: string;
  value: number;
  quantity: number;
  category?: string;
}

interface TourDefaultsSimpleFormProps {
  tourId: string;
  tourName: string;
  type: 'power' | 'weight';
  defaults: DefaultItem[];
  onSave: (item: Omit<DefaultItem, 'id'>) => Promise<void>;
  onUpdate: (id: string, item: Partial<DefaultItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBack: () => void;
}

export const TourDefaultsSimpleForm: React.FC<TourDefaultsSimpleFormProps> = ({
  tourId,
  tourName,
  type,
  defaults,
  onSave,
  onUpdate,
  onDelete,
  onBack
}) => {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    name: '',
    value: '',
    quantity: '1',
    category: ''
  });

  const handleSaveNew = async () => {
    if (!newItem.name || !newItem.value) {
      toast({
        title: 'Missing Information',
        description: 'Please enter both name and value',
        variant: 'destructive'
      });
      return;
    }

    try {
      await onSave({
        name: newItem.name,
        value: parseFloat(newItem.value),
        quantity: parseInt(newItem.quantity) || 1,
        category: newItem.category || undefined
      });

      setNewItem({ name: '', value: '', quantity: '1', category: '' });
      
      toast({
        title: 'Success',
        description: `${type === 'power' ? 'Power' : 'Weight'} default added successfully`
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save default',
        variant: 'destructive'
      });
    }
  };

  const handleUpdate = async (id: string, field: keyof DefaultItem, value: string | number) => {
    try {
      const updates: Partial<DefaultItem> = {};
      if (field === 'value' || field === 'quantity') {
        updates[field] = typeof value === 'string' ? parseFloat(value) : value;
      } else {
        updates[field] = value as string;
      }
      
      await onUpdate(id, updates);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update default',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      toast({
        title: 'Success',
        description: 'Default removed successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete default',
        variant: 'destructive'
      });
    }
  };

  const getTotalValue = () => {
    return defaults.reduce((total, item) => total + (item.value * item.quantity), 0);
  };

  const unit = type === 'power' ? 'W' : 'kg';
  const valueLabel = type === 'power' ? 'Watts' : 'Weight (kg)';

  return (
    <Card className="w-full max-w-4xl mx-auto my-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <CardTitle className="text-2xl font-bold">
              Tour {type === 'power' ? 'Power' : 'Weight'} Defaults
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Setting defaults for: <span className="font-medium">{tourName}</span>
            </p>
          </div>
          <div></div>
        </div>
        {defaults.length > 0 && (
          <div className="text-center">
            <p className="text-sm font-medium">
              Total: {getTotalValue().toFixed(1)} {unit} ({defaults.length} items)
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Add New Default */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add New Default</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Item Name</Label>
                <Input
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="Enter item name"
                />
              </div>
              <div className="space-y-2">
                <Label>{valueLabel}</Label>
                <Input
                  type="number"
                  value={newItem.value}
                  onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                  placeholder={`Enter ${type === 'power' ? 'watts' : 'weight'}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label>Category (Optional)</Label>
                <Input
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  placeholder="Category"
                />
              </div>
            </div>
            <Button onClick={handleSaveNew} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Default
            </Button>
          </CardContent>
        </Card>

        {/* Existing Defaults */}
        {defaults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Defaults</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {defaults.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Name</Label>
                        <Input
                          value={item.name}
                          onChange={(e) => handleUpdate(item.id, 'name', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{valueLabel}</Label>
                        <Input
                          type="number"
                          value={item.value}
                          onChange={(e) => handleUpdate(item.id, 'value', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Quantity</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdate(item.id, 'quantity', e.target.value)}
                          min="1"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Category</Label>
                        <Input
                          value={item.category || ''}
                          onChange={(e) => handleUpdate(item.id, 'category', e.target.value)}
                          placeholder="Optional"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium">
                        {(item.value * item.quantity).toFixed(1)} {unit}
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        className="mt-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {defaults.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No defaults set yet. Add your first default above.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
