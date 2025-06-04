
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vacationRequestsApi, VacationRequestSubmission } from '@/lib/vacation-requests';
import { useToast } from '@/hooks/use-toast';

export const useVacationRequests = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const userRequestsQuery = useQuery({
    queryKey: ['vacation-requests', 'user'],
    queryFn: vacationRequestsApi.getUserRequests,
  });

  const pendingRequestsQuery = useQuery({
    queryKey: ['vacation-requests', 'pending'],
    queryFn: vacationRequestsApi.getPendingRequests,
  });

  const submitRequestMutation = useMutation({
    mutationFn: vacationRequestsApi.submitRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
      toast({
        title: "Request submitted!",
        description: "Your vacation request has been submitted for approval.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error submitting request",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const approveRequestsMutation = useMutation({
    mutationFn: vacationRequestsApi.approveRequests,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
      toast({
        title: "Requests approved!",
        description: `${data.length} vacation request(s) have been approved.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Approval failed",
        description: error.message || "Failed to approve selected requests.",
        variant: "destructive",
      });
    },
  });

  const rejectRequestsMutation = useMutation({
    mutationFn: ({ requestIds, rejectionReason }: { requestIds: string[]; rejectionReason?: string }) =>
      vacationRequestsApi.rejectRequests(requestIds, rejectionReason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
      toast({
        title: "Requests rejected!",
        description: `${data.length} vacation request(s) have been rejected.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Rejection failed",
        description: error.message || "Failed to reject selected requests.",
        variant: "destructive",
      });
    },
  });

  return {
    userRequests: userRequestsQuery.data || [],
    pendingRequests: pendingRequestsQuery.data || [],
    isLoadingUserRequests: userRequestsQuery.isLoading,
    isLoadingPendingRequests: pendingRequestsQuery.isLoading,
    submitRequest: submitRequestMutation.mutate,
    approveRequests: approveRequestsMutation.mutate,
    rejectRequests: rejectRequestsMutation.mutate,
    isSubmitting: submitRequestMutation.isPending,
    isApproving: approveRequestsMutation.isPending,
    isRejecting: rejectRequestsMutation.isPending,
  };
};
