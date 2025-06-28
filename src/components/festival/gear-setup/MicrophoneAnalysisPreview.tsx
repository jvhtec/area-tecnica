
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WiredMic } from "./WiredMicConfig";
import { Info, CheckCircle } from "lucide-react";

interface MicrophoneAnalysisPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peakRequirements: WiredMic[];
  analysisDetails: {
    totalArtists: number;
    microphoneModels: string[];
    peakCalculationMethod: string;
  };
  onConfirm: () => void;
  isLoading?: boolean;
}

export const MicrophoneAnalysisPreview = ({
  open,
  onOpenChange,
  peakRequirements,
  analysisDetails,
  onConfirm,
  isLoading = false
}: MicrophoneAnalysisPreviewProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Microphone Requirements Analysis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Analysis completed for {analysisDetails.totalArtists} artists using festival microphones.
              Peak requirements calculated considering show schedules and exclusive use constraints.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{analysisDetails.totalArtists}</div>
              <div className="text-sm text-blue-600">Artists Analyzed</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{peakRequirements.length}</div>
              <div className="text-sm text-green-600">Mic Models Required</div>
            </div>
          </div>

          {peakRequirements.length > 0 ? (
            <div>
              <h3 className="text-lg font-semibold mb-3">Peak Microphone Requirements</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Microphone Model</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {peakRequirements.map((mic, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{mic.model}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{mic.quantity}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {mic.notes}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No microphone requirements found. Make sure artists have wired microphones configured with festival kit selected.
            </div>
          )}

          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="text-sm text-yellow-800">
              <strong>Note:</strong> These requirements will be merged with your existing microphone kit. 
              Quantities for existing models will be updated to the higher value.
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={onConfirm} 
              disabled={isLoading || peakRequirements.length === 0}
            >
              {isLoading ? "Loading..." : "Load Requirements"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
