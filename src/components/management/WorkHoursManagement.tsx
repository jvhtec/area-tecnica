import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ManageWorkRecordsDialog } from "./ManageWorkRecordsDialog";
import { FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";

interface Job {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
}

export function WorkHoursManagement() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      try {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        const { data, error } = await supabase
          .from('jobs')
          .select('id, title, start_time, end_time')
          .gte('start_time', threeMonthsAgo.toISOString())
          .order('start_time', { ascending: false })
          .limit(50);
        
        if (error) {
          throw error;
        }
        
        setJobs(data || []);
        
        const jobIdFromUrl = searchParams.get('jobId');
        if (jobIdFromUrl) {
          const jobFromUrl = data?.find(job => job.id === jobIdFromUrl);
          if (jobFromUrl) {
            setSelectedJob(jobFromUrl);
            
            const { data: records } = await supabase
              .from('technician_work_records')
              .select('id')
              .eq('job_id', jobIdFromUrl)
              .limit(1);
              
            if (records && records.length > 0) {
              setSelectedRecordId(records[0].id);
              setDialogOpen(true);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching jobs:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchJobs();
  }, [searchParams]);
  
  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleOpenDialog = async (job: Job) => {
    setSelectedJob(job);
    
    const { data: records } = await supabase
      .from('technician_work_records')
      .select('id')
      .eq('job_id', job.id)
      .limit(1);
      
    if (records && records.length > 0) {
      setSelectedRecordId(records[0].id);
      setDialogOpen(true);
    } else {
      console.log("No work records found for this job");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Work Hours Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="search">Search Jobs</Label>
              <Input
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by job title..."
              />
            </div>
            
            {loading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-muted rounded-md p-4 h-16" />
                ))}
              </div>
            ) : (
              <div className="border rounded-md">
                {filteredJobs.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">No jobs found</div>
                ) : (
                  <div className="divide-y">
                    {filteredJobs.map((job) => (
                      <div key={job.id} className="p-4 flex justify-between items-center hover:bg-muted/50">
                        <div>
                          <div className="font-medium">{job.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(job.start_time), 'PPP')}
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2"
                          onClick={() => handleOpenDialog(job)}
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                          Manage Records
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {selectedRecordId && (
        <ManageWorkRecordsDialog 
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          recordId={selectedRecordId}
        />
      )}
    </div>
  );
}
