
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export type JobStatus = "Tentativa" | "Confirmado" | "Completado" | "Cancelado";

export function useJobStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateJobStatus = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: string; status: JobStatus }) => {
      const { error } = await supabase
        .from('jobs')
        .update({ status })
        .eq('id', jobId);
      
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast({
        title: "Status updated",
        description: `Job status changed to ${status}`
      });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return { updateJobStatus };
}
