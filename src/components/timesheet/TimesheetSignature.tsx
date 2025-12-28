import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PenTool, X, Check } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { useTimesheets } from "@/hooks/useTimesheets";

interface TimesheetSignatureProps {
  timesheetId: string;
  currentSignature?: string;
  canSign: boolean;
  onSigned: (timesheetId: string, signatureData: string) => Promise<any>;
}

export const TimesheetSignature = ({ timesheetId, currentSignature, canSign, onSigned }: TimesheetSignatureProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const signaturePadRef = useRef<SignatureCanvas>(null);

  const handleSaveSignature = async () => {
    if (!signaturePadRef.current) return;

    setIsLoading(true);
    try {
      const signatureData = signaturePadRef.current.toDataURL();
      await onSigned(timesheetId, signatureData);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving signature:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <PenTool className="h-4 w-4" />
          Digital Signature
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentSignature ? (
          <div className="space-y-3">
            <div className="border rounded-lg p-2 bg-background">
              <img 
                src={currentSignature} 
                alt="Signature" 
                width={400}
                height={150}
                loading="lazy"
                decoding="async"
                className="max-w-full h-20 object-contain"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Signed digitally
            </p>
          </div>
        ) : canSign ? (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <PenTool className="h-4 w-4 mr-2" />
                Add Signature
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Digital Signature</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="border rounded-lg p-2 bg-background">
                  <SignatureCanvas
                    ref={signaturePadRef}
                    canvasProps={{
                      width: 400,
                      height: 150,
                      className: 'signature-canvas w-full'
                    }}
                    backgroundColor="white"
                  />
                </div>
                <div className="flex justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={handleClearSignature}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                  <Button
                    onClick={handleSaveSignature}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    {isLoading ? 'Saving...' : 'Save Signature'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Signature pending</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
