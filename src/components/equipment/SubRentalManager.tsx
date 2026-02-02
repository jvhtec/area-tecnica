import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface SubRental {
  id: string;
  batch_id?: string;
  equipment_id: string;
  quantity: number;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_by: string | null;
  job_id?: string | null;
  is_stock_extension?: boolean;
  equipment?: {
    name: string;
    category: string;
  };
}

export function SubRentalManager() {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { department } = useDepartment();
  const isMobile = useIsMobile();
  const [isAdding, setIsAdding] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // collapsed by default
  // Support multiple items in a single sub-rental action
  const [items, setItems] = useState<Array<{ equipment_id: string; quantity: number }>>([
    { equipment_id: '', quantity: 1 }
  ]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [notes, setNotes] = useState('');
  const [jobId, setJobId] = useState<string>('');
  const [autoCreateTransport, setAutoCreateTransport] = useState(false);
  const [isStockExtension, setIsStockExtension] = useState(false);

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

  // Query for jobs that are available (not archived/cancelled) for linking
  const { data: availableJobs } = useQuery({
    queryKey: ['jobs-for-subrental', department],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, event_date, locations(name)')
        .gte('event_date', format(new Date(), 'yyyy-MM-dd'))
        .order('event_date', { ascending: true })
        .limit(50);

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
        batch_id: batchId,
        job_id: jobId || null,
        is_stock_extension: isStockExtension,
      }));

      const { data: insertedRentals, error } = await supabase
        .from('sub_rentals')
        .insert(payload)
        .select('id');

      if (error) throw error;

      // If auto-create transport is enabled and we have a job_id, create transport request
      if (autoCreateTransport && jobId && insertedRentals && insertedRentals.length > 0) {
        try {
          const vendor_name = notes || 'Vendor';
          const description = `Subrental pickup: ${vendor_name}`;

          const { error: transportErr } = await supabase.functions.invoke('create-transport-request', {
            body: {
              job_id: jobId,
              subrental_id: insertedRentals[0].id, // Use first item as reference
              description: description,
              department: department,
              note: `Auto-created from sub-rental batch ${batchId}`,
              auto_created: true,
            },
          });

          if (transportErr) {
            console.error('Failed to create transport request:', transportErr);
            // Don't fail the entire operation, just log
            toast({
              title: "Warning",
              description: "Sub-rental created but transport request failed. You can create it manually.",
              variant: "default"
            });
          } else {
            toast({
              title: "Success",
              description: "Sub-rental and transport request created successfully"
            });
          }
        } catch (transportErr) {
          console.error('Error creating transport request:', transportErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-rentals'] });
      queryClient.invalidateQueries({ queryKey: ['sub-rentals-week'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-with-stock'] });
      queryClient.invalidateQueries({ queryKey: ['transport-requests-all'] });
      // Only show success toast if we didn't already show one in the mutation
      if (!autoCreateTransport || !jobId) {
        toast({
          title: "Success",
          description: "Sub-rental items added successfully"
        });
      }
      // Reset form
      setItems([{ equipment_id: '', quantity: 1 }]);
      setStartDate(undefined);
      setEndDate(undefined);
      setNotes('');
      setJobId('');
      setAutoCreateTransport(false);
      setIsStockExtension(false);
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
      <Card className="p-4 md:p-6">
        <CardHeader className="p-0 mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <CardTitle>Sub-Rentals (Temporary Stock Boosts)</CardTitle>
            <div className="flex items-center gap-2">
              {!isAdding && (
                <Button onClick={() => { setIsAdding(true); setIsOpen(true); }} size="sm" className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Sub-Rental
                </Button>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Toggle" className="w-auto">
                  <ChevronsUpDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
        <CardContent className="space-y-4 p-0">
        {isAdding && (
          <Card className="p-4 border-2 border-primary">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label>Items</Label>
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-8">
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
                    <div className="sm:col-span-3">
                      <Input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => {
                          const q = parseInt(e.target.value) || 1;
                          setItems((prev) => prev.map((p, i) => i === idx ? { ...p, quantity: q } : p));
                        }}
                        placeholder="Quantity"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={items.length === 1}
                        title={items.length === 1 ? 'At least one item required' : 'Remove item'}
                        className="w-full sm:w-auto"
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
                    className="w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add another item
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
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

                <div className="space-y-2">
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

              <div className="space-y-2">
                <Label>Notes (Vendor/Provider)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Rented from Company XYZ"
                />
              </div>

              <div className="space-y-2">
                <Label>Link to Job (Optional)</Label>
                <Select
                  value={jobId || "none"}
                  onValueChange={(val) => {
                    const newJobId = val === "none" ? "" : val;
                    setJobId(newJobId);
                    if (newJobId) {
                      setIsStockExtension(false); // If job is selected, it's not a stock extension
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No job (stock extension)</SelectItem>
                    {availableJobs?.map((job: any) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title} - {job.event_date ? format(new Date(job.event_date), 'PPP') : 'No date'}
                        {job.locations?.name ? ` (${job.locations.name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is-stock-extension"
                  checked={isStockExtension}
                  onCheckedChange={(checked) => {
                    setIsStockExtension(checked as boolean);
                    if (checked) {
                      setJobId(''); // If stock extension, clear job
                      setAutoCreateTransport(false); // Can't auto-create transport without job
                    }
                  }}
                />
                <Label htmlFor="is-stock-extension" className="text-sm font-normal cursor-pointer">
                  Long-term stock extension (not tied to a specific job)
                </Label>
              </div>

              {jobId && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-transport"
                    checked={autoCreateTransport}
                    onCheckedChange={(checked) => setAutoCreateTransport(checked as boolean)}
                  />
                  <Label htmlFor="auto-transport" className="text-sm font-normal cursor-pointer">
                    Automatically create transport request for this subrental
                  </Label>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAdding(false)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button
                  onClick={() => addSubRentalMutation.mutate()}
                  disabled={
                    !startDate ||
                    !endDate ||
                    items.filter((it) => it.equipment_id && (it.quantity ?? 0) > 0).length === 0
                  }
                  className="w-full sm:w-auto"
                >
                  Add Sub-Rental
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="space-y-3">
          {batches.map((batch) => (
            <Card key={batch.batchId} className="p-4">
              <div className="space-y-1">
                <div className="font-medium text-sm sm:text-base">{format(new Date(batch.start), 'PPP')} → {format(new Date(batch.end), 'PPP')}</div>
                <div className="text-sm text-muted-foreground">Total: +{batch.total} units</div>
                {batch.notes && (
                  <div className="text-sm text-muted-foreground italic">{batch.notes}</div>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {batch.items.map((rental) => (
                  <div key={rental.id} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border rounded-md p-3">
                    <div className="text-sm">
                      <div>+{rental.quantity} · {rental.equipment?.name} ({rental.equipment?.category})</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSubRentalMutation.mutate(rental.id)}
                      title="Remove sub-rental item"
                      className="self-end md:self-auto"
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
