
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useVacationRequests } from '@/hooks/useVacationRequests';
import { format } from 'date-fns';
import { CalendarDays, CheckCircle, XCircle, Clock } from 'lucide-react';

export const VacationManagement = () => {
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const {
    pendingRequests,
    isLoadingPendingRequests,
    approveRequests,
    rejectRequests,
    isApproving,
    isRejecting,
  } = useVacationRequests();

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

  const handleApproveSelected = () => {
    if (selectedRequests.length === 0) return;
    approveRequests(selectedRequests);
    setSelectedRequests([]);
  };

  const handleRejectSelected = () => {
    if (selectedRequests.length === 0) return;
    rejectRequests({ requestIds: selectedRequests });
    setSelectedRequests([]);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoadingPendingRequests) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading vacation requests...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Manage Vacation Requests
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendingRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No pending vacation requests.
          </div>
        ) : (
          <>
            <div className="flex justify-end gap-2 mb-4">
              <Button 
                onClick={handleApproveSelected} 
                disabled={selectedRequests.length === 0 || isApproving}
                className="bg-green-600 hover:bg-green-700"
              >
                Approve Selected ({selectedRequests.length})
              </Button>
              <Button 
                variant="outline" 
                onClick={handleRejectSelected} 
                disabled={selectedRequests.length === 0 || isRejecting}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                Reject Selected ({selectedRequests.length})
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedRequests.length === pendingRequests.length && pendingRequests.length > 0}
                        onCheckedChange={handleSelectAllRequests}
                      />
                    </TableHead>
                    <TableHead>Technician</TableHead>
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
                        {request.technicians 
                          ? `${request.technicians.first_name} ${request.technicians.last_name}`
                          : 'N/A'
                        }
                      </TableCell>
                      <TableCell>{format(new Date(request.start_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{format(new Date(request.end_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{request.reason}</TableCell>
                      <TableCell>{format(new Date(request.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
