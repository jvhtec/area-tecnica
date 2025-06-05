
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

export const useFlexCrewAssignments = () => {
  const { toast } = useToast();

  const manageFlexCrewAssignment = async (
    jobId: string,
    technicianId: string,
    department: 'sound' | 'lights',
    action: 'add' | 'remove'
  ) => {
    try {
      console.log(`Managing Flex crew assignment: ${action} technician ${technicianId} for job ${jobId} in department ${department}`);
      
      const { data, error } = await supabase.functions.invoke('manage-flex-crew-assignments', {
        body: {
          job_id: jobId,
          technician_id: technicianId,
          department: department,
          action: action
        }
      });

      if (error) {
        console.error('Error calling Flex crew assignment function:', error);
        toast({
          title: "Error",
          description: `Failed to ${action} crew assignment: ${error.message}`,
          variant: "destructive",
        });
        return false;
      }

      if (data?.error) {
        console.error('Flex crew assignment error:', data.error);
        toast({
          title: "Error",
          description: `Failed to ${action} crew assignment: ${data.error}`,
          variant: "destructive",
        });
        return false;
      }

      console.log('Flex crew assignment result:', data);
      
      // Only show success message for actual changes, not when skipped
      if (data?.message && !data.message.includes('skipped') && !data.message.includes('already exists') && !data.message.includes('No assignment to remove')) {
        toast({
          title: "Success",
          description: `Successfully ${action === 'add' ? 'added to' : 'removed from'} Flex crew call`,
        });
      }

      return true;
    } catch (error) {
      console.error('Error in manageFlexCrewAssignment:', error);
      toast({
        title: "Error",
        description: `Failed to ${action} crew assignment`,
        variant: "destructive",
      });
      return false;
    }
  };

  const useCrewCallData = (jobId: string, department: string) => {
    return useQuery({
      queryKey: ['crew-call-data', jobId, department],
      queryFn: async () => {
        if (!jobId || !department) return null;
        
        const { data, error } = await supabase
          .from('flex_crew_calls')
          .select('flex_element_id')
          .eq('job_id', jobId)
          .eq('department', department)
          .maybeSingle();

        if (error) {
          console.error('Error fetching crew call data:', error);
          return null;
        }

        return data;
      },
      enabled: !!jobId && !!department
    });
  };

  return {
    manageFlexCrewAssignment,
    useCrewCallData
  };
};
