
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useVacationRequests } from '@/hooks/useVacationRequests';
import { format } from 'date-fns';
import { History, CheckCircle, XCircle, Clock, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadVacationRequestPDF } from '@/utils/vacationRequestPdfExport';
import type { VacationRequest } from '@/lib/vacation-requests';

export const VacationRequestHistory = () => {
  const { userRequests, isLoadingUserRequests } = useVacationRequests();

  const handleExportPDF = async (request: VacationRequest) => {
    try {
      await downloadVacationRequestPDF({ request });
    } catch (error) {
      console.error('Error exporting vacation request PDF:', error);
    }
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

  if (isLoadingUserRequests) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading your requests...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="px-0 py-4 sm:py-6">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Your Vacation Requests
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {userRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            You haven't submitted any vacation requests yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Response</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRequests.map(request => (
                  <TableRow key={request.id}>
                    <TableCell>{format(new Date(request.start_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{format(new Date(request.end_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{request.reason}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>{format(new Date(request.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      {request.approved_at 
                        ? format(new Date(request.approved_at), 'MMM d, yyyy')
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExportPDF(request)}
                        className="h-8 w-8 p-0"
                        title="Export PDF"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
