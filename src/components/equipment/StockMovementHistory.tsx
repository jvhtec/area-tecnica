
import { useQuery } from "@tanstack/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";


import { queryKeys } from "@/lib/react-query";
interface StockMovement {
  id: string;
  equipment_id: string;
  user_id: string;
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
    queryKey: queryKeys.scope('stock-movements'),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('stock_movements')
        .select(`
          *,
          equipment (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data || []) as Array<Omit<StockMovement, 'profiles'> & {
        equipment: { name: string } | null;
      }>;
      const userIds = Array.from(new Set(rows.map((movement) => movement.user_id).filter(Boolean)));

      let profiles: Array<{ id: string; first_name: string | null; last_name: string | null }> = [];
      if (userIds.length) {
        const { data: profileRows, error: profilesError } = await dataLayerClient.from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);

        if (profilesError) throw profilesError;
        profiles = profileRows || [];
      }

      const profilesById = new Map(
        (profiles || []).map((profile) => [
          profile.id,
          {
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
          },
        ])
      );

      return rows.map((movement) => ({
        ...movement,
        equipment: movement.equipment || { name: '-' },
        profiles: profilesById.get(movement.user_id) || { first_name: '', last_name: '' },
      }));
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
