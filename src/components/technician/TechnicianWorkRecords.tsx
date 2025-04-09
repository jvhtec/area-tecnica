
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkRecordsTable } from "./WorkRecordsTable";
import { WorkRecordDetailsDialog } from "./WorkRecordDetailsDialog";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WorkRecord {
  id: string;
  job_id: string;
  technician_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  break_duration: number;
  total_hours: number;
  signature_url: string;
  signature_date: string;
  notes: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  job: {
    title: string;
  };
}

export function TechnicianWorkRecords() {
  const [userRole, setUserRole] = useState<string>('technician');
  const [selectedRecord, setSelectedRecord] = useState<WorkRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) return;
        
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (error) {
          throw error;
        }
        
        setUserRole(data.role);
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };
    
    fetchUserRole();
  }, []);
  
  const handleViewRecord = (record: WorkRecord) => {
    setSelectedRecord(record);
    setDetailsOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          My Work Records
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <WorkRecordsTable 
              onViewRecord={handleViewRecord} 
              userRole={userRole} 
            />
          </TabsContent>
          
          <TabsContent value="pending">
            <WorkRecordsTable 
              onViewRecord={handleViewRecord} 
              userRole={userRole} 
            />
          </TabsContent>
          
          <TabsContent value="approved">
            <WorkRecordsTable 
              onViewRecord={handleViewRecord} 
              userRole={userRole} 
            />
          </TabsContent>
          
          <TabsContent value="rejected">
            <WorkRecordsTable 
              onViewRecord={handleViewRecord} 
              userRole={userRole} 
            />
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <WorkRecordDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        record={selectedRecord}
        userRole={userRole}
      />
    </Card>
  );
}
