import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useVacationRequests } from '@/hooks/useVacationRequests';
import { format } from 'date-fns';
import { CalendarDays, CheckCircle, XCircle, Clock, Users, Download } from 'lucide-react';
import { VacationRequestForm } from './VacationRequestForm';
import { VacationRequestHistory } from './VacationRequestHistory';
import type { VacationRequest } from '@/lib/vacation-requests';
import { downloadVacationRequestPDF } from '@/utils/vacationRequestPdfExport';

interface VacationRequestsTabsProps {
  userRole: 'house_tech' | 'management' | 'admin';
  onVacationRequestSubmit: (request: { startDate: string; endDate: string; reason: string }) => Promise<void>;
  isSubmitting: boolean;
}

export const VacationRequestsTabs: React.FC<VacationRequestsTabsProps> = ({
  userRole,
  onVacationRequestSubmit,
  isSubmitting,
}) => {
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const {
    departmentRequests,
    isLoadingDepartmentRequests,
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

  const handleSelectAllRequests = (isChecked: boolean, requests: VacationRequest[]) => {
    if (isChecked) {
      setSelectedRequests(requests.map(req => req.id));
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

  const handleExportPDF = async (request: VacationRequest) => {
    try {
      const approverName = request.technicians 
        ? `${request.technicians.first_name} ${request.technicians.last_name}`
        : undefined;
      
      await downloadVacationRequestPDF({ request, approverName });
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

  // Inline component: Status badge with hover popover to show collisions
  const StatusWithConflicts: React.FC<{ request: VacationRequest }> = ({ request }) => {
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [collisions, setCollisions] = React.useState<any[] | null>(null);

    const fetchCollisions = async () => {
      if (!request?.technician_id || !request?.start_date || !request?.end_date) return;
      setLoading(true);
      try {
        const startRange = new Date(`${request.start_date}T00:00:00`);
        const endRange = new Date(`${request.end_date}T23:59:59.999`);
        const { data, error } = await supabase
          .from('job_assignments')
          .select(`
            jobs!inner (
              id,
              title,
              start_time,
              end_time,
              locations(name)
            )
          `)
          .eq('technician_id', request.technician_id)
          .lte('jobs.start_time', endRange.toISOString())
          .gte('jobs.end_time', startRange.toISOString());

        if (error) throw error;
        // Normalize joined shape
        const rows = (data || []).map((row: any) => Array.isArray(row.jobs) ? row.jobs[0] : row.jobs).filter(Boolean);
        setCollisions(rows);
      } catch (e) {
        console.error('Error checking collisions for request', request.id, e);
        setCollisions([]);
      } finally {
        setLoading(false);
      }
    };

    const handleOpenChange = (next: boolean) => {
      setOpen(next);
      if (next && collisions === null) {
        fetchCollisions();
      }
    };

    // Prefetch collisions so badge can show a dot/count immediately
    React.useEffect(() => {
      // Only prefetch once
      if (collisions === null) {
        fetchCollisions();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const conflictsCount = collisions?.length ?? 0;

    return (
      <HoverCard open={open} onOpenChange={handleOpenChange}>
        <HoverCardTrigger asChild>
          <div className="relative inline-flex cursor-default" title={conflictsCount > 0 ? `${conflictsCount} conflict(s)` : undefined}>
            {getStatusBadge(request.status)}
            {collisions && conflictsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-[3px] rounded-full bg-red-600 text-white text-[10px] leading-[16px] text-center font-semibold shadow">
                {conflictsCount}
              </span>
            )}
          </div>
        </HoverCardTrigger>
        <HoverCardContent className="w-96" side="top" align="center">
          <div className="space-y-2">
            <div className="font-medium">Assignment collisions</div>
            {loading && <div className="text-sm text-muted-foreground">Checking…</div>}
            {!loading && collisions && collisions.length === 0 && (
              <div className="text-sm text-green-700">No conflicts detected for this period.</div>
            )}
            {!loading && collisions && collisions.length > 0 && (
              <div className="max-h-64 overflow-auto space-y-2">
                {collisions.map((job: any) => {
                  const start = new Date(job.start_time);
                  const end = new Date(job.end_time);
                  const locName = job.locations && Array.isArray(job.locations) && job.locations[0]?.name ? ` • ${job.locations[0].name}` : '';
                  return (
                    <div key={job.id} className="rounded-md border p-2">
                      <div className="text-sm font-medium">
                        <a className="text-blue-600 hover:underline" href={`/jobs/view/${job.id}`} target="_blank" rel="noopener noreferrer">
                          {job.title || 'Job'}
                        </a>
                        {locName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(start, 'PPpp')} – {format(end, 'PPpp')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!loading && collisions === null && (
              <div className="text-sm text-muted-foreground">Hover to check conflicts.</div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  };

  const renderDepartmentRequests = () => {
    if (isLoadingDepartmentRequests) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading department requests...</div>
          </CardContent>
        </Card>
      );
    }

    const pendingDepartmentRequests = departmentRequests.filter(req => req.status === 'pending');

    return (
      <Card>
        <CardHeader className="px-3 sm:px-6 py-4 sm:py-6">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Department Vacation Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {pendingDepartmentRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending vacation requests in your department.
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row justify-end gap-2 mb-4">
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
                          checked={selectedRequests.length === pendingDepartmentRequests.length && pendingDepartmentRequests.length > 0}
                          onCheckedChange={(checked) => handleSelectAllRequests(checked as boolean, pendingDepartmentRequests)}
                        />
                      </TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead className="hidden sm:table-cell">Department</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead className="hidden lg:table-cell">Reason</TableHead>
                      <TableHead className="hidden md:table-cell">Requested On</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingDepartmentRequests.map(request => (
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
                        <TableCell className="hidden sm:table-cell">
                          {request.technicians?.department || 'N/A'}
                        </TableCell>
                        <TableCell>{format(new Date(request.start_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{format(new Date(request.end_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="hidden lg:table-cell max-w-[200px] truncate">{request.reason}</TableCell>
                        <TableCell className="hidden md:table-cell">{format(new Date(request.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <StatusWithConflicts request={request as unknown as VacationRequest} />
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
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Tabs defaultValue="my-requests" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="my-requests" className="flex-1 flex items-center justify-center gap-2">
          <CalendarDays className="h-4 w-4" />
          My Requests
        </TabsTrigger>
        {(userRole === 'management' || userRole === 'admin') && (
          <TabsTrigger value="department-requests" className="flex-1 flex items-center justify-center gap-2">
            <Users className="h-4 w-4" />
            Department Requests
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="my-requests" className="space-y-4">
        {userRole === 'house_tech' && (
          <VacationRequestForm 
            onSubmit={onVacationRequestSubmit}
            isSubmitting={isSubmitting}
          />
        )}

        {(userRole === 'management' || userRole === 'admin') && (
          <VacationRequestForm 
            onSubmit={onVacationRequestSubmit}
            isSubmitting={isSubmitting}
          />
        )}

        <VacationRequestHistory />
      </TabsContent>

      {(userRole === 'management' || userRole === 'admin') && (
        <TabsContent value="department-requests" className="space-y-4">
          {renderDepartmentRequests()}
        </TabsContent>
      )}
    </Tabs>
  );
};
