import { format } from "date-fns";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, FileDown, Edit, Users } from "lucide-react";
import { ShiftWithAssignments } from "@/types/festival-scheduling";
import { useToast } from "@/hooks/use-toast";
import { exportShiftsTablePDF, ShiftsTablePdfData } from "@/utils/shiftsTablePdfExport";
import { supabase } from "@/lib/supabase";
import { EditShiftDialog } from "./EditShiftDialog";
import { ManageAssignmentsDialog } from "./ManageAssignmentsDialog";

interface ShiftsTableProps {
  shifts: ShiftWithAssignments[];
  onDeleteShift: (shiftId: string) => void;
  onShiftUpdated: () => void;
  date: string;
  jobId: string;
  isViewOnly?: boolean;
}

export const ShiftsTable = ({ 
  shifts, 
  onDeleteShift,
  onShiftUpdated,
  date, 
  jobId, 
  isViewOnly = false 
}: ShiftsTableProps) => {
  const { toast } = useToast();
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [jobTitle, setJobTitle] = useState<string>("");
  const [editingShift, setEditingShift] = useState<ShiftWithAssignments | null>(null);
  const [managingShift, setManagingShift] = useState<ShiftWithAssignments | null>(null);
  
  useEffect(() => {
    const fetchJobAndLogo = async () => {
      if (!jobId) return;
      
      try {
        const { data: jobData, error: jobError } = await supabase
          .from("jobs")
          .select("title")
          .eq("id", jobId)
          .single();
          
        if (jobError) {
          console.error("Error fetching job title:", jobError);
        } else if (jobData) {
          setJobTitle(jobData.title);
        }
        
        const { data, error } = await supabase
          .from("festival_settings")
          .select("logo_url")
          .eq("job_id", jobId)
          .single();
          
        if (error) {
          console.error("Error fetching festival logo:", error);
          return;
        }
        
        if (data?.logo_url) {
          const logoPath = data.logo_url;
          console.log("Retrieved logo path:", logoPath);
          
          if (logoPath.startsWith('http')) {
            setLogoUrl(logoPath);
          } 
          else {
            try {
              let bucket = 'festival-assets';
              let path = logoPath;
              
              if (logoPath.includes('/')) {
                const parts = logoPath.split('/', 1);
                bucket = parts[0];
                path = logoPath.substring(bucket.length + 1);
              }
              
              console.log(`Getting public URL for bucket: ${bucket}, path: ${path}`);
              const { data: publicUrlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(path);
                
              if (publicUrlData?.publicUrl) {
                console.log("Generated public URL:", publicUrlData.publicUrl);
                setLogoUrl(publicUrlData.publicUrl);
              }
            } catch (storageErr) {
              console.error("Error getting public URL:", storageErr);
            }
          }
        }
      } catch (err) {
        console.error("Error in fetch:", err);
      }
    };
    
    fetchJobAndLogo();
  }, [jobId]);
  
  const sortedShifts = [...shifts].sort((a, b) => 
    a.start_time.localeCompare(b.start_time)
  );

  const formatTimeRange = (start: string, end: string) => {
    return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
  };

  const handleDeleteClick = (e: React.MouseEvent, shiftId: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this shift?")) {
      onDeleteShift(shiftId);
    }
  };

  const handleEditClick = (e: React.MouseEvent, shift: ShiftWithAssignments) => {
    e.stopPropagation();
    setEditingShift(shift);
  };

  const handleManageClick = (e: React.MouseEvent, shift: ShiftWithAssignments) => {
    e.stopPropagation();
    setManagingShift(shift);
  };

  const formattedDate = new Date(date).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long', 
    day: 'numeric'
  });

  const handleExportPDF = async () => {
    try {
      console.log("Exporting PDF with jobId:", jobId, "and jobTitle:", jobTitle);
      console.log("Using logo URL:", logoUrl);
      
      const pdfData: ShiftsTablePdfData = {
        jobTitle,
        date,
        jobId,
        shifts: sortedShifts,
        logoUrl
      };

      const blob = await exportShiftsTablePDF(pdfData);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${jobTitle.replace(/\s+/g, '_')}_${date}_shifts.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "PDF generated successfully",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Could not generate PDF",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="print:p-8">
      <div className="flex justify-between items-center mb-4">
        <div className="print:block hidden">
          <h2 className="text-xl font-bold text-center">{jobTitle}</h2>
          <p className="text-center text-muted-foreground">{formattedDate}</p>
        </div>
        <Button 
          variant="outline" 
          className="ml-auto mb-2 print:hidden"
          onClick={handleExportPDF}
        >
          <FileDown className="h-4 w-4 mr-2" />
          Export to PDF
        </Button>
      </div>
      
      <Table className="border-collapse border border-border print:border-black">
        <TableHeader>
          <TableRow className="bg-muted print:bg-gray-200">
            <TableHead className="border border-border print:border-black print:text-black font-medium">Shift</TableHead>
            <TableHead className="border border-border print:border-black print:text-black font-medium">Time</TableHead>
            <TableHead className="border border-border print:border-black print:text-black font-medium">Stage</TableHead>
            <TableHead className="border border-border print:border-black print:text-black font-medium">Department</TableHead>
            <TableHead className="border border-border print:border-black print:text-black font-medium">Technicians</TableHead>
            <TableHead className="border border-border print:border-black print:text-black font-medium print:hidden">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedShifts.map((shift) => (
            <TableRow key={shift.id} className="hover:bg-accent/5">
              <TableCell className="border border-border print:border-black font-medium print:text-black">
                {shift.name}
              </TableCell>
              <TableCell className="border border-border print:border-black print:text-black">
                {formatTimeRange(shift.start_time, shift.end_time)}
              </TableCell>
              <TableCell className="border border-border print:border-black print:text-black">
                {shift.stage ? `Stage ${shift.stage}` : '-'}
              </TableCell>
              <TableCell className="border border-border print:border-black print:text-black">
                {shift.department || '-'}
              </TableCell>
              <TableCell className="border border-border print:border-black print:text-black">
                {shift.assignments.length > 0 ? (
                  <ul className="list-disc list-inside">
                    {shift.assignments.map((assignment) => (
                      <li key={assignment.id} className="text-sm">
                        {assignment.external_technician_name || 
                          (assignment.profiles && 
                            `${assignment.profiles.first_name} ${assignment.profiles.last_name}`)} ({assignment.role})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground print:text-gray-500">No technicians assigned</span>
                )}
              </TableCell>
              <TableCell className="border border-border print:hidden">
                {!isViewOnly && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleEditClick(e, shift)}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleManageClick(e, shift)}
                      className="h-8 w-8"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteClick(e, shift.id)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editingShift && (
        <EditShiftDialog
          open={!!editingShift}
          onOpenChange={(open) => !open && setEditingShift(null)}
          shift={editingShift}
          onShiftUpdated={() => {
            onShiftUpdated();
            setEditingShift(null);
          }}
        />
      )}

      {managingShift && (
        <ManageAssignmentsDialog
          open={!!managingShift}
          onOpenChange={(open) => !open && setManagingShift(null)}
          shift={managingShift}
          onAssignmentsUpdated={() => {
            onShiftUpdated();
          }}
          isViewOnly={isViewOnly}
        />
      )}
    </div>
  );
};
