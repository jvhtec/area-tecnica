
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkRecordsTable } from "@/components/technician/WorkRecordsTable";
import { WorkRecordDetailsDialog } from "@/components/technician/WorkRecordDetailsDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilePdf, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  technician?: {
    first_name: string;
    last_name: string;
  };
}

interface ManageWorkRecordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
}

export function ManageWorkRecordsDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle
}: ManageWorkRecordsDialogProps) {
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedRecord, setSelectedRecord] = useState<WorkRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  // Set default date range to current month
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setStartDate(format(firstDay, 'yyyy-MM-dd'));
    setEndDate(format(lastDay, 'yyyy-MM-dd'));
  }, []);
  
  const handleViewRecord = (record: WorkRecord) => {
    setSelectedRecord(record);
    setDetailsOpen(true);
  };
  
  const handleStatusUpdate = () => {
    setDetailsOpen(false);
    // Force a re-render of the table
    setActiveTab(prev => prev);
  };
  
  const generateWorkHoursReport = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select a date range");
      return;
    }
    
    setIsGeneratingReport(true);
    
    try {
      // Fetch all approved records for the job within the date range
      const { data, error } = await supabase
        .from('technician_work_records')
        .select(`
          *,
          job:jobs(title),
          technician:profiles(first_name, last_name)
        `)
        .eq('job_id', jobId)
        .eq('status', 'approved')
        .gte('work_date', startDate)
        .lte('work_date', endDate)
        .order('work_date', { ascending: true });
      
      if (error) {
        throw error;
      }
      
      if (!data || data.length === 0) {
        toast.error("No approved work records found in this date range");
        return;
      }
      
      // Create PDF document
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(20);
      doc.text(`Work Hours Report: ${jobTitle}`, 14, 22);
      
      // Add date range
      doc.setFontSize(12);
      doc.text(`Date Range: ${format(new Date(startDate), 'PP')} to ${format(new Date(endDate), 'PP')}`, 14, 32);
      doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, 14, 38);
      
      // Group records by technician
      const recordsByTechnician: Record<string, WorkRecord[]> = {};
      data.forEach(record => {
        const technicianName = `${record.technician?.first_name} ${record.technician?.last_name}`;
        if (!recordsByTechnician[technicianName]) {
          recordsByTechnician[technicianName] = [];
        }
        recordsByTechnician[technicianName].push(record as WorkRecord);
      });
      
      // Add summary table
      const summaryTableBody = Object.entries(recordsByTechnician).map(([technicianName, records]) => {
        const totalHours = records.reduce((sum, record) => sum + record.total_hours, 0);
        return [technicianName, totalHours.toFixed(2)];
      });
      
      autoTable(doc, {
        startY: 45,
        head: [['Technician', 'Total Hours']],
        body: summaryTableBody,
        headStyles: {
          fillColor: [66, 66, 66],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
      });
      
      // Add detailed tables for each technician
      let yPosition = (doc as any).lastAutoTable.finalY + 15;
      
      for (const [technicianName, records] of Object.entries(recordsByTechnician)) {
        // Check if we need a new page
        if (yPosition > 240) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.setFontSize(14);
        doc.text(`${technicianName} - Detailed Hours`, 14, yPosition);
        yPosition += 10;
        
        const detailedTableBody = records.map(record => [
          format(new Date(record.work_date), 'PP'),
          record.start_time,
          record.end_time,
          record.break_duration.toString(),
          record.total_hours.toFixed(2),
          record.notes || ''
        ]);
        
        autoTable(doc, {
          startY: yPosition,
          head: [['Date', 'Start', 'End', 'Break (min)', 'Hours', 'Notes']],
          body: detailedTableBody,
          headStyles: {
            fillColor: [100, 100, 100],
            textColor: [255, 255, 255]
          },
        });
        
        yPosition = (doc as any).lastAutoTable.finalY + 15;
        
        // Add signature for the technician
        const lastRecord = records[records.length - 1];
        if (lastRecord.signature_url) {
          // Check if we need a new page
          if (yPosition > 220) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.setFontSize(12);
          doc.text(`Signature:`, 14, yPosition);
          yPosition += 5;
          
          // Add signature image
          try {
            // Create an image element to load the signature
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = lastRecord.signature_url;
            
            // Wait for image to load
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
            });
            
            // Calculate appropriate dimensions (max width 100px)
            const imgWidth = Math.min(100, img.width);
            const imgHeight = (img.height * imgWidth) / img.width;
            
            // Add image to PDF
            doc.addImage(img, 'PNG', 14, yPosition, imgWidth, imgHeight);
            yPosition += imgHeight + 10;
            
            // Add signature date
            doc.setFontSize(10);
            doc.text(`Signed on: ${format(new Date(lastRecord.signature_date), 'PPP p')}`, 14, yPosition);
            yPosition += 15;
          } catch (error) {
            console.error("Error adding signature:", error);
            doc.text("Signature could not be loaded", 14, yPosition);
            yPosition += 10;
          }
        }
        
        // Add page break for next technician
        if (yPosition > 200) {
          doc.addPage();
          yPosition = 20;
        } else {
          yPosition += 10;
        }
      }
      
      // Save the PDF
      doc.save(`${jobTitle}_work_hours_report.pdf`);
      toast.success("Work hours report generated successfully");
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate work hours report");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Manage Work Records - {jobTitle}</DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
              </TabsList>
              
              <TabsContent value="pending">
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2">Pending Work Records</h3>
                  <WorkRecordsTable 
                    jobId={jobId} 
                    onViewRecord={handleViewRecord} 
                    userRole="management" 
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="approved">
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2">Approved Work Records</h3>
                  <WorkRecordsTable 
                    jobId={jobId} 
                    onViewRecord={handleViewRecord} 
                    userRole="management" 
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="rejected">
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2">Rejected Work Records</h3>
                  <WorkRecordsTable 
                    jobId={jobId} 
                    onViewRecord={handleViewRecord} 
                    userRole="management" 
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="mt-8">
              <h3 className="text-sm font-medium mb-4">Generate Work Hours Report</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              
              <Button 
                onClick={generateWorkHoursReport} 
                disabled={isGeneratingReport} 
                className="gap-2"
              >
                {isGeneratingReport ? (
                  <>Generating...</>
                ) : (
                  <>
                    <FilePdf className="h-4 w-4" />
                    Generate PDF Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <WorkRecordDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        record={selectedRecord}
        userRole="management"
        onStatusUpdate={handleStatusUpdate}
      />
    </>
  );
}
