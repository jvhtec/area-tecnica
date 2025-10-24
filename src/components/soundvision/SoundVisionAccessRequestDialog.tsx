import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSoundVisionAccessRequest } from '@/hooks/useSoundVisionAccessRequest';

interface SoundVisionAccessRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  note: string;
}

export const SoundVisionAccessRequestDialog = ({
  open,
  onOpenChange,
}: SoundVisionAccessRequestDialogProps) => {
  const {
    soundVisionRequests,
    isLoadingRequests,
    hasPendingRequest,
    submitRequest,
    isSubmitting,
    currentStatus,
  } = useSoundVisionAccessRequest();

  const form = useForm<FormData>({
    defaultValues: {
      note: '',
    },
  });

  const onSubmit = (data: FormData) => {
    if (!data.note.trim()) {
      form.setError('note', {
        message: 'Please provide a reason for requesting access',
      });
      return;
    }

    submitRequest(
      { note: data.note },
      {
        onSuccess: () => {
          form.reset();
          // Keep dialog open to show status
        },
      }
    );
  };

  const renderStatusAlert = () => {
    if (isLoadingRequests) {
      return (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>Loading your request status...</AlertDescription>
        </Alert>
      );
    }

    if (hasPendingRequest) {
      const pendingRequest = soundVisionRequests.find((r) => r.status === 'pending');
      return (
        <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            You have a pending SoundVision access request.
            {pendingRequest?.created_at && (
              <span className="block text-sm text-muted-foreground mt-1">
                Submitted: {new Date(pendingRequest.created_at).toLocaleDateString()}
              </span>
            )}
          </AlertDescription>
        </Alert>
      );
    }

    if (currentStatus === 'approved') {
      const approvedRequest = soundVisionRequests.find((r) => r.status === 'approved');
      return (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Your SoundVision access request has been approved!
            {approvedRequest?.approved_at && (
              <span className="block text-sm text-muted-foreground mt-1">
                Approved: {new Date(approvedRequest.approved_at).toLocaleDateString()}
              </span>
            )}
          </AlertDescription>
        </Alert>
      );
    }

    if (currentStatus === 'rejected') {
      const rejectedRequest = soundVisionRequests.find((r) => r.status === 'rejected');
      return (
        <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            Your previous SoundVision access request was not approved.
            {rejectedRequest?.rejection_reason && (
              <span className="block text-sm mt-1">
                Reason: {rejectedRequest.rejection_reason}
              </span>
            )}
            <span className="block text-sm text-muted-foreground mt-1">
              You can submit a new request below.
            </span>
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Request SoundVision Access</DialogTitle>
          <DialogDescription>
            Submit a request to access the SoundVision files database. Management will review your
            request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {renderStatusAlert()}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Access</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Please explain why you need access to SoundVision files..."
                        rows={4}
                        disabled={isSubmitting || hasPendingRequest}
                      />
                    </FormControl>
                    <FormDescription>
                      Provide details about your role or project that requires SoundVision access.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Close
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || hasPendingRequest || !form.watch('note')?.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>

          {soundVisionRequests.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-sm font-semibold mb-2">Request History</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {soundVisionRequests.slice(0, 5).map((request) => (
                  <div
                    key={request.id}
                    className="text-xs p-2 rounded bg-muted/50 flex justify-between items-center"
                  >
                    <div className="flex-1">
                      <span className="block text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString()}
                      </span>
                      <span className="block text-xs line-clamp-1">
                        {request.reason.replace('[SoundVision Access]', '').trim()}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        request.status === 'approved'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : request.status === 'rejected'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
