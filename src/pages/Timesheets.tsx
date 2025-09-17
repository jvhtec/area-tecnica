import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Download, FileText } from "lucide-react";
import { TimesheetView } from "@/components/timesheet/TimesheetView";
import { downloadTimesheetPDF } from "@/utils/timesheet-pdf";
import { useOptimizedJobs } from "@/hooks/useOptimizedJobs";
import { useTimesheets } from "@/hooks/useTimesheets";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";

export default function Timesheets() {
  const [searchParams] = useSearchParams();
  const jobIdFromUrl = searchParams.get('jobId');
  const [selectedJobId, setSelectedJobId] = useState<string>(jobIdFromUrl || "");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const { user, userRole } = useOptimizedAuth();
  const { data: jobs = [], isLoading: jobsLoading } = useOptimizedJobs();
  const { timesheets } = useTimesheets(selectedJobId || "", { userRole });

  useEffect(() => {
    if (jobIdFromUrl) {
      setSelectedJobId(jobIdFromUrl);
    }
  }, [jobIdFromUrl]);

  const selectedJob = jobs.find(job => job.id === selectedJobId);
  const timesheetsDisabled = selectedJob && (selectedJob.job_type === 'dryhire' || selectedJob.job_type === 'tourdate');
  const canManage = userRole === 'admin' || userRole === 'management';
  const canDownloadPDF = userRole === 'admin' || userRole === 'management';

  const handleDownloadPDF = async () => {
    if (!selectedJob) return;

    // Use all timesheets for the job, not filtered by date
    if (timesheets.length === 0) {
      alert('No timesheets found for this job');
      return;
    }

    try {
      await downloadTimesheetPDF({
        job: selectedJob,
        timesheets: timesheets, // Use all timesheets
        date: "all-dates" // Indicate this covers all dates
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

        {selectedJobId && canDownloadPDF && !timesheetsDisabled && (
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

      {selectedJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Job Details
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {timesheetsDisabled && selectedJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timesheets Disabled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Timesheets are not used for jobs of type
                <span className="font-medium"> {selectedJob.job_type}</span>.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedJobId && !timesheetsDisabled && (
        <TimesheetView
          jobId={selectedJobId}
          jobTitle={selectedJob?.title}
          canManage={canManage}
        />
      )}
    </div>
  );
}
