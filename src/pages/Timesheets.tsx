import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Download, FileText } from "lucide-react";
import { TimesheetView } from "@/components/timesheet/TimesheetView";
import { downloadTimesheetPDF } from "@/utils/timesheet-pdf";
import { useOptimizedJobs } from "@/hooks/useOptimizedJobs";
import { useTimesheets } from "@/hooks/useTimesheets";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

export default function Timesheets() {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const { user } = useAuth();
  const { data: jobs = [], isLoading: jobsLoading } = useOptimizedJobs();
  const { timesheets } = useTimesheets(selectedJobId);

  const selectedJob = jobs.find(job => job.id === selectedJobId);
  const canManage = user?.role === 'admin' || user?.role === 'management';

  const handleDownloadPDF = async () => {
    if (!selectedJob || !selectedDate) return;

    const dateTimesheets = timesheets.filter(t => t.date === selectedDate);
    
    if (dateTimesheets.length === 0) {
      alert('No timesheets found for the selected date');
      return;
    }

    try {
      await downloadTimesheetPDF({
        job: selectedJob,
        timesheets: dateTimesheets,
        date: selectedDate
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  if (jobsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground animate-spin mb-4" />
          <p className="text-muted-foreground">Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Clock className="h-8 w-8" />
            Timesheet Management
          </h1>
          <p className="text-muted-foreground">
            Manage technician timesheets for jobs
          </p>
        </div>

        {selectedJobId && (
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border rounded-md"
            />
            <Button
              onClick={handleDownloadPDF}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select Job
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Job</label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{job.title}</span>
                          <Badge variant="outline" className="ml-2">
                            {job.job_type}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedJob && (
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium mb-2">{selectedJob.title}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Start</p>
                    <p>{format(new Date(selectedJob.start_time), 'PPP')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">End</p>
                    <p>{format(new Date(selectedJob.end_time), 'PPP')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="capitalize">{selectedJob.job_type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="capitalize">{selectedJob.status || 'Active'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedJobId && (
        <TimesheetView
          jobId={selectedJobId}
          jobTitle={selectedJob?.title}
          canManage={canManage}
        />
      )}
    </div>
  );
}