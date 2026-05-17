import { useCallback, useState } from "react";

import type { PrintOptions } from "@/components/festival/pdf/PrintOptionsDialog";

import { downloadBlobInBrowser, generateFestivalDocumentation } from "../commands";

type ToastFn = (props: { description?: string; title: string; variant?: "destructive" }) => void;

export const useFestivalPrintActions = ({
  jobId,
  jobTitle,
  maxStages,
  toast,
}: {
  jobId?: string;
  jobTitle: string;
  maxStages: number;
  toast: ToastFn;
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);

  const handlePrintAllDocumentation = useCallback(
    async (options: PrintOptions, filename: string) => {
      if (!jobId) return;

      setIsPrinting(true);
      try {
        console.log("Starting documentation print process with options:", options);
        const result = await generateFestivalDocumentation({
          filename,
          jobId,
          jobTitle: jobTitle || "Festival",
          maxStages,
          options,
        });

        console.log(`Generated file, size: ${result.blob.size} bytes`);
        if (!result.blob || result.blob.size === 0) {
          throw new Error("Generated file is empty");
        }

        downloadBlobInBrowser(result.blob, result.filename);

        toast({
          title: "Éxito",
          description: options.generateIndividualStagePDFs
            ? "PDFs individuales de escenarios generados exitosamente"
            : "Documentación generada exitosamente",
        });
      } catch (error: any) {
        console.error("Error generating documentation:", error);
        toast({
          title: "Error",
          description: `Error al generar documentación: ${error.message}`,
          variant: "destructive",
        });
      } finally {
        setIsPrinting(false);
      }
    },
    [jobId, jobTitle, maxStages, toast],
  );

  const handlePrintButtonClick = useCallback(() => {
    setIsPrintDialogOpen(true);
  }, []);

  return {
    handlePrintAllDocumentation,
    handlePrintButtonClick,
    isPrintDialogOpen,
    isPrinting,
    setIsPrintDialogOpen,
  };
};
