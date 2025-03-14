
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, FileDown } from "lucide-react";
import { ShiftWithAssignments } from "@/types/festival-scheduling";
import { useToast } from "@/hooks/use-toast";
import { exportShiftsTablePDF, ShiftsTablePdfData } from "@/utils/shiftsTablePdfExport";

interface ShiftsTableProps {
  shifts: ShiftWithAssignments[];
  onDeleteShift: (shiftId: string) => void;
  date: string;
  jobTitle?: string;
}

export const ShiftsTable = ({ shifts, onDeleteShift, date, jobTitle = "Festival Schedule" }: ShiftsTableProps) => {
  const { toast } = useToast();
  
  // Sort shifts by start time
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

  const formattedDate = new Date(date).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long', 
    day: 'numeric'
  });

  const handleExportPDF = async () => {
    try {
      const pdfData: ShiftsTablePdfData = {
        jobTitle,
        date,
        shifts: sortedShifts.map(shift => ({
          name: shift.name,
          time: {
            start: shift.start_time,
            end: shift.end_time
          },
          stage: shift.stage,
          department: shift.department || '',
          assignments: shift.assignments.map(assignment => ({
            name: `${assignment.profiles?.first_name || ''} ${assignment.profiles?.last_name || ''}`.trim(),
            role: assignment.role
          }))
        }))
      };

      const blob = await exportShiftsTablePDF(pdfData);
      
      // Create a download link for the generated PDF
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
                        {assignment.profiles?.first_name} {assignment.profiles?.last_name} ({assignment.role})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground print:text-gray-500">No technicians assigned</span>
                )}
              </TableCell>
              <TableCell className="border border-border print:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDeleteClick(e, shift.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
