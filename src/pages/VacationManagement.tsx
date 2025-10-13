import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { getPendingVacationRequests, approveVacationRequests, rejectVacationRequests } from '../../supabase-server/src/api/vacation-requests';
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

const VacationManagement = () => {
  const [pendingRequests, setPendingRequests] = useState<VacationRequest[]>([]);
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchRequests = async () => {
    setIsLoading(true);
    const { data, error } = await getPendingVacationRequests(supabase);
    if (error) {
      toast({
        title: "Error fetching requests",
        description: error.message || "Failed to load vacation requests.",
        variant: "destructive",
      });
      setPendingRequests([]);
    } else {
      setPendingRequests(data as VacationRequest[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

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
    if (selectedRequests.length === 0) {
      toast({
        title: "No requests selected",
        description: "Please select at least one request to approve.",
        variant: "warning",
      });
      return;
    }

    const { error } = await approveVacationRequests(supabase, selectedRequests);
    if (error) {
      toast({
        title: "Approval failed",
        description: error.message || "Failed to approve selected requests.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Requests approved!",
        description: `${selectedRequests.length} vacation requests have been approved.`,
      });
      setSelectedRequests([]);
      fetchRequests(); // Refresh the list
    }
  };

  const handleRejectSelected = async () => {
    if (selectedRequests.length === 0) {
      toast({
        title: "No requests selected",
        description: "Please select at least one request to reject.",
        variant: "warning",
      });
      return;
    }

    const { error } = await rejectVacationRequests(supabase, selectedRequests);
    if (error) {
      toast({
        title: "Rejection failed",
        description: error.message || "Failed to reject selected requests.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Requests rejected!",
        description: `${selectedRequests.length} vacation requests have been rejected.`,
      });
      setSelectedRequests([]);
      fetchRequests(); // Refresh the list
    }
  };

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
                  disabled={selectedRequests.length === 0}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <span className="sm:hidden">Approve ({selectedRequests.length})</span>
                  <span className="hidden sm:inline">Approve Selected ({selectedRequests.length})</span>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleRejectSelected} 
                  disabled={selectedRequests.length === 0}
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
