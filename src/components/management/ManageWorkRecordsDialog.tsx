
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { SignaturePad } from "@/components/technician/SignaturePad";
import { Separator } from "@/components/ui/separator";
import { FileText } from "lucide-react"; // Changed from FilePdf to FileText

interface ManageWorkRecordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
}

// Define the WorkRecord type to handle possible error cases
interface WorkRecord {
  id: string;
  job_id: string;
  technician_id: string;
  start_time: string;
  end_time: string;
  break_duration: number;
  notes: string;
  signature_url: string | null;
  signature_date: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  technician: { 
    first_name: string; 
    last_name: string; 
  } | { error: true } & string;
  status: string;
  total_hours: number;
}

export const ManageWorkRecordsDialog = ({
  open,
  onOpenChange,
  recordId,
}: ManageWorkRecordsDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("details");

  const { data: workRecord, isLoading } = useQuery({
    queryKey: ["work-record", recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technician_work_records")
        .select(
          "*, technician:technician_id(first_name, last_name), job:job_id(title)"
        )
        .eq("id", recordId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!recordId && open,
  });

  const approveRecordMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;

      const { error } = await supabase
        .from("technician_work_records")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: currentUserId,
        })
        .eq("id", recordId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Record approved",
        description: "The work record has been approved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["work-record", recordId] });
      queryClient.invalidateQueries({ queryKey: ["work-records"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error approving record",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const renderTechnicianName = () => {
    if (!workRecord) return "Unknown";
    
    // Handle the case where technician might be an error object
    const technician = workRecord.technician;
    if (typeof technician === 'string' || 'error' in technician) {
      return "Unknown Technician";
    }
    
    return `${technician.first_name} ${technician.last_name}`;
  };

  const getWorkRecordWithSafeTypes = (record: any): WorkRecord => {
    // Handle potential error cases in technician property
    if (record && typeof record.technician === 'string' || (record.technician && 'error' in record.technician)) {
      return {
        ...record,
        technician: {
          first_name: "Unknown",
          last_name: "Technician"
        }
      } as WorkRecord;
    }
    return record as WorkRecord;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Work Record</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="signature">Signature</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="space-y-4">
            {isLoading ? (
              <p>Loading work record...</p>
            ) : workRecord ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <strong>Job:</strong> {workRecord.job?.title || "N/A"}
                  </div>
                  <div>
                    <strong>Technician:</strong> {renderTechnicianName()}
                  </div>
                  <div>
                    <strong>Start Time:</strong>{" "}
                    {format(new Date(workRecord.start_time), "Pp")}
                  </div>
                  <div>
                    <strong>End Time:</strong>{" "}
                    {format(new Date(workRecord.end_time), "Pp")}
                  </div>
                  <div>
                    <strong>Break Duration:</strong> {workRecord.break_duration} minutes
                  </div>
                  <div>
                    <strong>Total Hours:</strong> {workRecord.total_hours}
                  </div>
                  <div>
                    <strong>Status:</strong> {workRecord.status}
                  </div>
                  <div>
                    <strong>Created At:</strong>{" "}
                    {format(new Date(workRecord.created_at), "Pp")}
                  </div>
                </div>
                <div>
                  <strong>Notes:</strong>
                  <Separator className="my-2" />
                  <p>{workRecord.notes}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => window.open(workRecord.signature_url, "_blank")}
                  disabled={!workRecord.signature_url}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View Signature
                </Button>
              </>
            ) : (
              <p>No work record found.</p>
            )}
          </TabsContent>
          <TabsContent value="signature">
            <div className="space-y-4">
              {workRecord?.signature_url ? (
                <>
                  <img
                    src={workRecord.signature_url}
                    alt="Technician Signature"
                    className="border rounded-md"
                  />
                  <p className="text-sm text-muted-foreground">
                    Signature captured on{" "}
                    {format(new Date(workRecord.signature_date || ""), "PPP")}
                  </p>
                </>
              ) : (
                <p>No signature captured for this work record.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Separator className="my-4" />

        <div className="flex justify-end space-x-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {workRecord?.status === "pending" && (
            <Button
              onClick={() => {
                approveRecordMutation.mutate();
              }}
              disabled={approveRecordMutation.isPending}
            >
              {approveRecordMutation.isPending ? "Approving..." : "Approve Record"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
