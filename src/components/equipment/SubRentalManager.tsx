import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import { useDepartment } from '@/contexts/DepartmentContext';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { ChevronsUpDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useOptimizedTableSubscriptions } from '@/hooks/useOptimizedSubscriptions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SubRental {
  id: string;
  batch_id?: string;
  equipment_id: string;
  quantity: number;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_by: string | null;
  equipment?: {
    name: string;
    category: string;
  };
}

export function SubRentalManager() {
  const { session } = useOptimizedAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { department } = useDepartment();
  const [isAdding, setIsAdding] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // collapsed by default
  // Support multiple items in a single sub-rental action
  const [items, setItems] = useState<Array<{ equipment_id: string; quantity: number }>>([
    { equipment_id: '', quantity: 1 }
  ]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [notes, setNotes] = useState('');

  // Realtime: refresh sub-rentals list and stock view when changes occur elsewhere
  useOptimizedTableSubscriptions([
    { table: 'sub_rentals', queryKey: ['sub-rentals', department], priority: 'high' },
    { table: 'sub_rentals', queryKey: ['equipment-with-stock', department], priority: 'medium' },
  ]);

  const { data: equipmentList } = useQuery({
    queryKey: ['equipment', department],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('department', department)
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: subRentals = [] } = useQuery({
    queryKey: ['sub-rentals', department],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sub_rentals')
        .select(`
          *,
          equipment:equipment!inner (
            name,
            category,
            department
          )
        `)
        .eq('equipment.department', department)
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      return (data || []) as SubRental[];
    }
  });

  // Group sub-rentals by creation batch
  const batches = Object.values(
    (subRentals as SubRental[]).reduce((acc: Record<string, { batchId: string; start: string; end: string; notes: string | null; items: SubRental[]; total: number }>, r) => {
      const key = r.batch_id || r.id;
      if (!acc[key]) {
        acc[key] = { batchId: key, start: r.start_date, end: r.end_date, notes: r.notes || null, items: [], total: 0 };
      }
      acc[key].items.push(r);
      acc[key].total += r.quantity;
      return acc;
    }, {})
  ).sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

  // Add sub-rental mutation
  const addSubRentalMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id || !startDate || !endDate) {
        throw new Error('Missing required fields');
      }

      // Validate at least one complete line item
      const validItems = items.filter(
        (it) => it.equipment_id && (it.quantity ?? 0) > 0
      );
      if (validItems.length === 0) {
        throw new Error('Add at least one item');
      }

      // Bulk insert with shared batch id so items are grouped together
      const batchId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
        ? (crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const payload = validItems.map((it) => ({
        equipment_id: it.equipment_id,
        quantity: it.quantity,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        notes: notes || null,
        created_by: session.user.id,
        department: department,
        batch_id: batchId
      }));

      const { error } = await supabase.from('sub_rentals').insert(payload);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-rentals'] });
      queryClient.invalidateQueries({ queryKey: ['sub-rentals-week'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-with-stock'] });
      toast({
        title: "Success",
        description: "Sub-rental items added successfully"
      });
      // Reset form
      setItems([{ equipment_id: '', quantity: 1 }]);
      setStartDate(undefined);
      setEndDate(undefined);
      setNotes('');
      setIsAdding(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add sub-rental"
      });
    }
  });

  // Delete sub-rental mutation
  const deleteSubRentalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sub_rentals')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-rentals'] });
      queryClient.invalidateQueries({ queryKey: ['sub-rentals-week'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-with-stock'] });
      toast({
        title: "Success",
        description: "Sub-rental removed"
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove sub-rental"
      });
    }
  });

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Sub-Rentals (Temporary Stock Boosts)</CardTitle>
            <div className="flex items-center gap-2">
              {!isAdding && (
                <Button onClick={() => { setIsAdding(true); setIsOpen(true); }} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Sub-Rental
                </Button>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Toggle">
                  <ChevronsUpDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
        <CardContent className="space-y-4">
        {isAdding && (
          <Card className="p-4 border-2 border-primary">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Items</Label>
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-8">
                      <Select
                        value={it.equipment_id}
                        onValueChange={(val) => {
                          setItems((prev) => prev.map((p, i) => i === idx ? { ...p, equipment_id: val } : p));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select equipment" />
                        </SelectTrigger>
                        <SelectContent>
                          {equipmentList?.map((eq) => (
                            <SelectItem key={eq.id} value={eq.id}>
                              {eq.name} ({eq.category})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => {
                          const q = parseInt(e.target.value) || 1;
                          setItems((prev) => prev.map((p, i) => i === idx ? { ...p, quantity: q } : p));
                        }}
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={items.length === 1}
                        title={items.length === 1 ? 'At least one item required' : 'Remove item'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setItems((prev) => [...prev, { equipment_id: '', quantity: 1 }])}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add another item
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Rented from Company XYZ"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAdding(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => addSubRentalMutation.mutate()}
                  disabled={
                    !startDate ||
                    !endDate ||
                    items.filter((it) => it.equipment_id && (it.quantity ?? 0) > 0).length === 0
                  }
                >
                  Add Sub-Rental
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="space-y-2">
          {batches.map((batch) => (
            <Card key={batch.batchId} className="p-4">
              <div className="space-y-1">
                <div className="font-medium">{format(new Date(batch.start), 'PPP')} → {format(new Date(batch.end), 'PPP')}</div>
                <div className="text-sm text-muted-foreground">Total: +{batch.total} units</div>
                {batch.notes && (
                  <div className="text-sm text-muted-foreground italic">{batch.notes}</div>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {batch.items.map((rental) => (
                  <div key={rental.id} className="flex items-start justify-between border rounded-md p-2">
                    <div className="text-sm">
                      <div>+{rental.quantity} · {rental.equipment?.name} ({rental.equipment?.category})</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSubRentalMutation.mutate(rental.id)}
                      title="Remove sub-rental item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
          {subRentals.length === 0 && !isAdding && (
            <p className="text-muted-foreground text-center py-4">
              No sub-rentals active
            </p>
          )}
        </div>
        </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
