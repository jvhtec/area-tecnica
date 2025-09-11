
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
  // Note: Stock movements table doesn't exist yet - showing placeholder
  const movements: any[] = [];
  const isLoading = false;

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
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Stock movement tracking coming soon
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
