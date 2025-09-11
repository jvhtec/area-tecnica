
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

interface StockMovement {
  id: string;
  equipment_id: string;
  quantity: number;
  movement_type: 'addition' | 'subtraction';
  notes: string | null;
  created_at: string;
  equipment: {
    name: string;
  };
  profiles: {
    first_name: string;
    last_name: string;
  };
}

export function StockMovementHistory() {
  const { data: movements, isLoading } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          equipment (name),
          profiles (first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StockMovement[];
    }
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Stock Movement History</h2>
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Equipment</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements?.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>
                  {format(new Date(movement.created_at), 'dd/MM/yyyy HH:mm')}
                </TableCell>
                <TableCell>{movement.equipment.name}</TableCell>
                <TableCell>
                  <span className={movement.movement_type === 'addition' ? 'text-green-600' : 'text-red-600'}>
                    {movement.movement_type === 'addition' ? 'Addition' : 'Subtraction'}
                  </span>
                </TableCell>
                <TableCell>{Math.abs(movement.quantity)}</TableCell>
                <TableCell>
                  {movement.profiles.first_name} {movement.profiles.last_name}
                </TableCell>
                <TableCell>{movement.notes || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
