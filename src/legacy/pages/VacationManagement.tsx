import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { vacationRequestsApi } from '@/lib/vacation-requests';
import { queryClient } from '@/lib/react-query';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface VacationRequest {
  id: string;
  technician_id: string;
  technicians?: { first_name?: string; last_name?: string; email?: string; department?: string } | null;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const VACATION_PENDING_QUERY_KEY = ['vacationRequests', 'pending'] as const;

const VacationManagement = () => {
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const { toast } = useToast();

  const { data: pendingRequests = [], isLoading } = useQuery({
    queryKey: VACATION_PENDING_QUERY_KEY,
    queryFn: async () => {
      try {
        return (await vacationRequestsApi.getPendingRequests()) as VacationRequest[];
      } catch (error) {
        toast({
          title: "Error fetching requests",
          description: error instanceof Error ? error.message : "Failed to load vacation requests.",
          variant: "destructive",
        });
        throw error;
      }
    },
    retry: false,
  });

  const handleSelectRequest = (id: string, isChecked: boolean) => {
    setSelectedRequests(prev =>
      isChecked ? [...prev, id] : prev.filter(requestId => requestId !== id)
    );
  };

  const handleSelectAllRequests = (isChecked: boolean) => {
    if (isChecked) {
      setSelectedRequests(pendingRequests.map(req => req.id));
    } else {
      setSelectedRequests([]);
    }
  };

  const handleApproveSelected = async () => {
    if (isApproving) return;
    if (selectedRequests.length === 0) {
      toast({
        title: "No requests selected",
        description: "Please select at least one request to approve.",
        variant: "warning",
      });
      return;
    }

    setIsApproving(true);
    try {
      await vacationRequestsApi.approveRequests(selectedRequests);
      toast({
        title: "Requests approved!",
        description: `${selectedRequests.length} vacation requests have been approved.`,
      });
      setSelectedRequests([]);
      await queryClient.invalidateQueries({ queryKey: VACATION_PENDING_QUERY_KEY });
    } catch (error) {
      toast({
        title: "Approval failed",
        description: error instanceof Error ? error.message : "Failed to approve selected requests.",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectSelected = async () => {
    if (isRejecting) return;
    if (selectedRequests.length === 0) {
      toast({
        title: "No requests selected",
        description: "Please select at least one request to reject.",
        variant: "warning",
      });
      return;
    }

    setIsRejecting(true);
    try {
      await vacationRequestsApi.rejectRequests(selectedRequests);
      toast({
        title: "Requests rejected!",
        description: `${selectedRequests.length} vacation requests have been rejected.`,
      });
      setSelectedRequests([]);
      await queryClient.invalidateQueries({ queryKey: VACATION_PENDING_QUERY_KEY });
    } catch (error) {
      toast({
        title: "Rejection failed",
        description: error instanceof Error ? error.message : "Failed to reject selected requests.",
        variant: "destructive",
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const isProcessing = isApproving || isRejecting;

  return (
    <div className="w-full max-w-full space-y-4 md:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Manage Vacation Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading requests...</div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No pending vacation requests.</div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row justify-end gap-2 mb-4">
                <Button 
                  onClick={handleApproveSelected} 
                  disabled={selectedRequests.length === 0 || isProcessing}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <span className="sm:hidden">Approve ({selectedRequests.length})</span>
                  <span className="hidden sm:inline">Approve Selected ({selectedRequests.length})</span>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleRejectSelected} 
                  disabled={selectedRequests.length === 0 || isProcessing}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <span className="sm:hidden">Reject ({selectedRequests.length})</span>
                  <span className="hidden sm:inline">Reject Selected ({selectedRequests.length})</span>
                </Button>
              </div>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[600px] px-4 sm:px-0">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedRequests.length === pendingRequests.length && pendingRequests.length > 0}
                          onCheckedChange={handleSelectAllRequests}
                        />
                      </TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Requested On</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map(request => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedRequests.includes(request.id)}
                            onCheckedChange={(isChecked: boolean) => handleSelectRequest(request.id, isChecked)}
                          />
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const t = request.technicians || {};
                            const fullName = [t.first_name, t.last_name].filter(Boolean).join(' ').trim();
                            return fullName || t.email || request.technician_id;
                          })()}
                          {request.technicians?.department ? (
                            <div className="text-xs text-muted-foreground">{request.technicians.department}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>{format(new Date(request.start_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{format(new Date(request.end_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{request.reason}</TableCell>
                        <TableCell>{format(new Date(request.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                        <TableCell className="capitalize">{request.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VacationManagement;
