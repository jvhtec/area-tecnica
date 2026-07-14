import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { optimizedInvalidation, queryKeys } from "@/lib/react-query";
import { scheduleTourDateDefaultDocumentSync } from "@/utils/tourDateDocumentSync";

export const useTourDateDefaultDocumentRefresh = (fallbackTourDateId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return (affectedTourDateId?: string | null) => {
    const tourDateId = affectedTourDateId || fallbackTourDateId;
    if (!tourDateId) return;

    scheduleTourDateDefaultDocumentSync({
      tourDateId,
      onComplete: ({ tourId, result }) => {
        optimizedInvalidation.invalidateQueryKeys(queryClient, [
          queryKeys.scope("tour-documents", tourId),
          queryKeys.scope("jobcard-tour-documents"),
          queryKeys.scope("tour-documents-for-job"),
        ]);
        if (result.errors.length > 0) {
          toast({
            title: "Aviso de sincronización de PDF",
            description: `${result.errors.length} documento(s) automáticos no se pudieron actualizar.`,
            variant: "destructive",
          });
        }
      },
      onError: () => {
        toast({
          title: "Aviso de sincronización de PDF",
          description: "No se pudieron actualizar los PDF automáticos de la fecha de gira.",
          variant: "destructive",
        });
      },
    });
  };
};
