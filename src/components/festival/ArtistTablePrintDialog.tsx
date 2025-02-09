
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface ArtistTablePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobDates: Date[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  onStageChange: (stage: string) => void;
  onPrint: () => void;
  isLoading: boolean;
}

export const ArtistTablePrintDialog = ({
  open,
  onOpenChange,
  jobDates,
  selectedDate,
  onDateChange,
  onStageChange,
  onPrint,
  isLoading
}: ArtistTablePrintDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Print Artist Schedule</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Date</Label>
            <Select value={selectedDate} onValueChange={onDateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select date" />
              </SelectTrigger>
              <SelectContent>
                {jobDates.map((date) => (
                  <SelectItem key={format(date, 'yyyy-MM-dd')} value={format(date, 'yyyy-MM-dd')}>
                    {format(date, 'EEE, MMM d')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Filter by Stage</Label>
            <Select onValueChange={onStageChange}>
              <SelectTrigger>
                <SelectValue placeholder="All stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All stages</SelectItem>
                {Array.from({ length: 5 }, (_, i) => i + 1).map((stage) => (
                  <SelectItem key={stage} value={stage.toString()}>
                    Stage {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={onPrint} disabled={isLoading} className="w-full">
            {isLoading ? "Generating PDF..." : "Generate PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
