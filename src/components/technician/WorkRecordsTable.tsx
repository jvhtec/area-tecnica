
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Eye, FileText, MoreHorizontal } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";

interface WorkRecord {
  id: string;
  job_id: string;
  technician_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  break_duration: number;
  total_hours: number;
  signature_url: string;
  signature_date: string;
  notes: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  job: {
    title: string;
  };
}

interface WorkRecordsTableProps {
  jobId?: string;
  technicianId?: string;
  onViewRecord?: (record: WorkRecord) => void;
  userRole: string;
}

export function WorkRecordsTable({
  jobId,
  technicianId,
  onViewRecord,
  userRole
}: WorkRecordsTableProps) {
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchWorkRecords = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('technician_work_records')
          .select(`
            *,
            job:jobs(title)
          `)
          .order('work_date', { ascending: false });
        
        if (jobId) {
          query = query.eq('job_id', jobId);
        }
        
        if (technicianId) {
          query = query.eq('technician_id', technicianId);
        }
        
        const { data, error } = await query;
        
        if (error) {
          throw error;
        }
        
        setRecords(data as WorkRecord[]);
      } catch (error) {
        console.error("Error fetching work records:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWorkRecords();
  }, [jobId, technicianId]);
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  if (loading) {
    return <div className="text-center py-4">Loading work records...</div>;
  }
  
  if (records.length === 0) {
    return <div className="text-center py-4 text-muted-foreground">No work records found.</div>;
  }
  
  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Work Date</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id}>
              <TableCell>{format(new Date(record.work_date), 'PPP')}</TableCell>
              <TableCell>{record.job.title}</TableCell>
              <TableCell>{record.total_hours.toFixed(2)}</TableCell>
              <TableCell>{getStatusBadge(record.status)}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onViewRecord && onViewRecord(record)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    {userRole === 'management' || userRole === 'admin' ? (
                      <DropdownMenuItem>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate Report
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
