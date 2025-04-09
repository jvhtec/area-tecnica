
import { format } from "date-fns";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
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

interface WorkRecordDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: WorkRecord | null;
  userRole: string;
  onStatusUpdate?: () => void;
}

export function WorkRecordDetailsDialog({
  open,
  onOpenChange,
  record,
  userRole,
  onStatusUpdate
}: WorkRecordDetailsDialogProps) {
  if (!record) return null;

  const isManagement = userRole === 'management' || userRole === 'admin';
  const isPending = record.status === 'pending';
  
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
  
  const handleApprove = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      const { error } = await supabase
        .from('technician_work_records')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', record.id);
      
      if (error) {
        throw error;
      }
      
      toast.success("Work record approved");
      if (onStatusUpdate) {
        onStatusUpdate();
      }
    } catch (error) {
      console.error("Error approving work record:", error);
      toast.error("Failed to approve work record");
    }
  };
  
  const handleReject = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      const { error } = await supabase
        .from('technician_work_records')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', record.id);
      
      if (error) {
        throw error;
      }
      
      toast.success("Work record rejected");
      if (onStatusUpdate) {
        onStatusUpdate();
      }
    } catch (error) {
      console.error("Error rejecting work record:", error);
      toast.error("Failed to reject work record");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Work Record Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">{record.job.title}</h3>
            {getStatusBadge(record.status)}
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Work Date</div>
              <div>{format(new Date(record.work_date), 'PPP')}</div>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground">Total Hours</div>
              <div>{record.total_hours.toFixed(2)}</div>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground">Start Time</div>
              <div>{record.start_time}</div>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground">End Time</div>
              <div>{record.end_time}</div>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground">Break Duration</div>
              <div>{record.break_duration} minutes</div>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground">Submitted On</div>
              <div>{format(new Date(record.created_at), 'PPP')}</div>
            </div>
          </div>
          
          {record.notes && (
            <div>
              <div className="text-sm text-muted-foreground">Notes</div>
              <div className="p-2 bg-muted rounded-md mt-1">{record.notes}</div>
            </div>
          )}
          
          <div>
            <div className="text-sm text-muted-foreground mb-2">Signature</div>
            <Card>
              <CardContent className="p-2">
                <img 
                  src={record.signature_url} 
                  alt="Signature" 
                  className="max-w-full h-auto border rounded-md"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Signed on {format(new Date(record.signature_date), 'PPP p')}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <DialogFooter className="gap-2">
          {isManagement && isPending && (
            <>
              <Button variant="outline" onClick={handleReject} className="gap-1">
                <X className="h-4 w-4" />
                Reject
              </Button>
              <Button onClick={handleApprove} className="gap-1">
                <Check className="h-4 w-4" />
                Approve
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
