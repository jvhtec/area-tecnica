
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Clock, FileText, Download, Plus, User } from "lucide-react";
import { useTimesheets } from "@/hooks/useTimesheets";
import { useJobAssignmentsRealtime } from "@/hooks/useJobAssignmentsRealtime";
import { useAuth } from "@/hooks/useAuth";
import { Timesheet, TimesheetFormData } from "@/types/timesheet";
import { TimesheetSignature } from "./TimesheetSignature";
import { format, parseISO } from "date-fns";

interface TimesheetViewProps {
  jobId: string;
  jobTitle?: string;
  canManage?: boolean;
}

export const TimesheetView = ({ jobId, jobTitle, canManage = false }: TimesheetViewProps) => {
  const { timesheets, isLoading, createTimesheet, updateTimesheet, submitTimesheet, approveTimesheet, signTimesheet } = useTimesheets(jobId);
  const { assignments } = useJobAssignmentsRealtime(jobId);
  const { user, userRole } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [editingTimesheet, setEditingTimesheet] = useState<string | null>(null);
  const [selectedTimesheets, setSelectedTimesheets] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [formData, setFormData] = useState<TimesheetFormData>({
    date: selectedDate,
    start_time: "09:00",
    end_time: "17:00",
    break_minutes: 30,
    overtime_hours: 0,
    notes: ""
  });

  // Filter timesheets based on user role
  const filteredTimesheets = useMemo(() => {
    if (!timesheets || !user) return [];
    
    // Technicians only see their own timesheets
    if (userRole === 'technician') {
      return timesheets.filter(t => t.technician_id === user.id);
    }
    
    // Management sees all timesheets
    return timesheets;
  }, [timesheets, userRole, user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'submitted': return 'default';
      case 'approved': return 'outline';
      default: return 'secondary';
    }
  };

  const handleCreateTimesheets = async () => {
    if (!assignments.length) {
      return;
    }

    for (const assignment of assignments) {
      await createTimesheet(assignment.technician_id, selectedDate);
    }
  };

  const handleUpdateTimesheet = async (timesheet: Timesheet) => {
    if (!editingTimesheet) return;

    await updateTimesheet(editingTimesheet, {
      start_time: formData.start_time,
      end_time: formData.end_time,
      break_minutes: formData.break_minutes,
      overtime_hours: formData.overtime_hours,
      notes: formData.notes
    });
    setEditingTimesheet(null);
  };

  const startEditing = (timesheet: Timesheet) => {
    setEditingTimesheet(timesheet.id);
    setFormData({
      date: timesheet.date,
      start_time: timesheet.start_time || "09:00",
      end_time: timesheet.end_time || "17:00",
      break_minutes: timesheet.break_minutes || 0,
      overtime_hours: timesheet.overtime_hours || 0,
      notes: timesheet.notes || ""
    });
  };

  const calculateHours = (startTime: string, endTime: string, breakMinutes: number) => {
    if (!startTime || !endTime) return 0;
    
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const workingHours = diffHours - (breakMinutes / 60);
    
    return Math.max(0, workingHours);
  };

  const handleBulkAction = async (action: 'approve' | 'submit') => {
    const promises = Array.from(selectedTimesheets).map(timesheetId => {
      if (action === 'approve') {
        return approveTimesheet(timesheetId);
      } else {
        return submitTimesheet(timesheetId);
      }
    });
    
    await Promise.all(promises);
    setSelectedTimesheets(new Set());
    setShowBulkActions(false);
  };

  const toggleTimesheetSelection = (timesheetId: string) => {
    const newSelection = new Set(selectedTimesheets);
    if (newSelection.has(timesheetId)) {
      newSelection.delete(timesheetId);
    } else {
      newSelection.add(timesheetId);
    }
    setSelectedTimesheets(newSelection);
    setShowBulkActions(newSelection.size > 0);
  };

  const selectAllVisibleTimesheets = () => {
    const visibleIds = filteredTimesheets.map(t => t.id);
    setSelectedTimesheets(new Set(visibleIds));
    setShowBulkActions(visibleIds.length > 0);
  };

  const clearSelection = () => {
    setSelectedTimesheets(new Set());
    setShowBulkActions(false);
  };

  const timesheetsByDate = filteredTimesheets.reduce((acc, timesheet) => {
    const date = timesheet.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(timesheet);
    return acc;
  }, {} as Record<string, Timesheet[]>);

  const isManagementUser = userRole === 'admin' || userRole === 'management';
  const isTechnician = userRole === 'technician';

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading timesheets...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" />
            {isTechnician ? 'My Timesheets' : 'Timesheets'}
          </h2>
          {jobTitle && <p className="text-muted-foreground">Job: {jobTitle}</p>}
        </div>
        {canManage && filteredTimesheets.length > 0 && (
          <div className="flex items-center gap-2">
            {showBulkActions && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('submit')}
                  disabled={selectedTimesheets.size === 0}
                >
                  Submit Selected ({selectedTimesheets.size})
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleBulkAction('approve')}
                  disabled={selectedTimesheets.size === 0}
                >
                  Approve Selected ({selectedTimesheets.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                >
                  Clear
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={selectedTimesheets.size > 0 ? clearSelection : selectAllVisibleTimesheets}
            >
              {selectedTimesheets.size > 0 ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        )}
      </div>

      {!assignments.length && isManagementUser && (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No technicians assigned to this job</p>
              <p className="text-sm text-muted-foreground mt-2">
                Assign technicians to this job to generate timesheets automatically
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && assignments.length > 0 && (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground animate-spin mb-4" />
              <p className="text-muted-foreground">Loading timesheets...</p>
              <p className="text-sm text-muted-foreground mt-2">
                {isTechnician ? 'Loading your timesheets...' : 'Creating timesheets for assigned technicians...'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.entries(timesheetsByDate).length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {isTechnician ? 'No timesheets found for you on this job' : 'Timesheets are being generated...'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {isTechnician 
                  ? 'Your timesheets will appear here once they are created by management'
                  : 'Timesheets are automatically created for all assigned technicians'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.entries(timesheetsByDate).map(([date, dayTimesheets]) => (
        <Card key={date}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {format(parseISO(date), 'EEEE, MMMM do, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dayTimesheets.map((timesheet) => (
              <div key={timesheet.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {canManage && (
                      <input
                        type="checkbox"
                        checked={selectedTimesheets.has(timesheet.id)}
                        onChange={() => toggleTimesheetSelection(timesheet.id)}
                        className="h-4 w-4"
                      />
                    )}
                    <div>
                      <p className="font-medium">
                        {isTechnician ? 'My Timesheet' : `${timesheet.technician?.first_name} ${timesheet.technician?.last_name}`}
                      </p>
                      {!isTechnician && (
                        <p className="text-sm text-muted-foreground">{timesheet.technician?.department}</p>
                      )}
                    </div>
                    <Badge variant={getStatusColor(timesheet.status)}>
                      {timesheet.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Technicians can edit their own draft timesheets */}
                    {isTechnician && timesheet.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEditing(timesheet)}
                      >
                        Edit
                      </Button>
                    )}
                    
                    {/* Management can edit any draft timesheet */}
                    {isManagementUser && timesheet.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEditing(timesheet)}
                      >
                        Edit
                      </Button>
                    )}
                    
                    {/* Only management can approve submitted timesheets */}
                    {isManagementUser && timesheet.status === 'submitted' && (
                      <Button
                        size="sm"
                        onClick={() => approveTimesheet(timesheet.id)}
                      >
                        Approve
                      </Button>
                    )}
                    
                    {/* Both technicians and management can submit draft timesheets */}
                    {(isTechnician || isManagementUser) && timesheet.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => submitTimesheet(timesheet.id)}
                      >
                        Submit
                      </Button>
                    )}
                  </div>
                </div>

                {editingTimesheet === timesheet.id ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="start_time">Start Time</Label>
                      <Input
                        id="start_time"
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end_time">End Time</Label>
                      <Input
                        id="end_time"
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="break_minutes">Break (minutes)</Label>
                      <Input
                        id="break_minutes"
                        type="number"
                        value={formData.break_minutes}
                        onChange={(e) => setFormData({ ...formData, break_minutes: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="overtime_hours">Overtime (hours)</Label>
                      <Input
                        id="overtime_hours"
                        type="number"
                        step="0.5"
                        value={formData.overtime_hours}
                        onChange={(e) => setFormData({ ...formData, overtime_hours: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="col-span-2 md:col-span-4">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Additional notes..."
                      />
                    </div>
                    <div className="col-span-2 md:col-span-4 flex gap-2">
                      <Button onClick={() => handleUpdateTimesheet(timesheet)}>
                        Save Changes
                      </Button>
                      <Button variant="outline" onClick={() => setEditingTimesheet(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Start Time</p>
                      <p className="font-medium">{timesheet.start_time || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">End Time</p>
                      <p className="font-medium">{timesheet.end_time || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Break</p>
                      <p className="font-medium">{timesheet.break_minutes || 0} min</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Hours</p>
                      <p className="font-medium">
                        {calculateHours(
                          timesheet.start_time || '09:00',
                          timesheet.end_time || '17:00',
                          timesheet.break_minutes || 0
                        ).toFixed(1)}h
                      </p>
                    </div>
                    {timesheet.notes && (
                      <div className="col-span-2 md:col-span-4">
                        <p className="text-muted-foreground">Notes</p>
                        <p className="font-medium">{timesheet.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {(timesheet.status === 'draft' || timesheet.status === 'submitted') && (
                  <TimesheetSignature
                    timesheetId={timesheet.id}
                    currentSignature={timesheet.signature_data}
                    canSign={timesheet.technician_id === user?.id || isManagementUser}
                    onSigned={signTimesheet}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
