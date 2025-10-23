import { useEffect } from "react";
import { pdfExportQueue, type PdfExportQueueEvent } from "@/utils/pdfExportQueue";
import { useToast } from "./use-toast";

export const usePdfExportQueueNotifications = () => {
  const { toast } = useToast();

  useEffect(() => {
    const listener = (event: PdfExportQueueEvent) => {
      const title = event.job.metadata?.title ?? "PDF Export";
      switch (event.type) {
        case "queued":
          toast({
            title: `${title} queued`,
            description: "We'll notify you when the export is ready.",
          });
          break;
        case "started":
          toast({
            title: `${title} export running`,
            description: "Generating your PDF in the background...",
          });
          break;
        case "completed":
          toast({
            title: `${title} ready`,
            description: "Export completed. Download should begin shortly.",
          });
          break;
        case "failed":
          toast({
            title: `${title} failed`,
            description: "We couldn't generate the PDF. Please try again.",
            variant: "destructive",
          });
          break;
        default:
          break;
      }
    };

    return pdfExportQueue.subscribe(listener);
  }, [toast]);
};

export default usePdfExportQueueNotifications;
