import { useEffect, useState, useCallback } from "react";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { useAppBadgeSource } from "@/hooks/useAppBadgeSource";

interface IncidentReportsNotificationBadgeProps {
  userRole: string;
  lastReadTimestamp?: string;
}

export const IncidentReportsNotificationBadge = ({ 
  userRole, 
  lastReadTimestamp 
}: IncidentReportsNotificationBadgeProps) => {
  const [hasNewReports, setHasNewReports] = useState(false);
  const [newReportsCount, setNewReportsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const fetchNewIncidentReports = useCallback(async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      console.log("Checking for new incident reports...");
      
      // Only management and admin users can see incident reports
      if (!['management', 'admin'].includes(userRole)) {
        return;
      }

      let query = supabase
        .from('job_documents')
        .select('id, uploaded_at')
        .like('file_path', 'incident-reports/%');

      // If we have a last read timestamp, only check for reports after that
      if (lastReadTimestamp) {
        query = query.gt('uploaded_at', lastReadTimestamp);
      } else {
        // If no timestamp, check for reports from the last 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        query = query.gt('uploaded_at', yesterday.toISOString());
      }

      const { data, error } = await query.limit(50);

      if (error) {
        console.error('Error fetching incident reports:', error);
        return;
      }

      const count = data?.length || 0;
      setNewReportsCount(count);
      setHasNewReports(count > 0);
      
      console.log("New incident reports:", { count, hasNew: count > 0 });
      
    } catch (error) {
      console.error("Error checking new incident reports:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userRole, lastReadTimestamp, isLoading]);

  useEffect(() => {
    // Initial fetch with a slight delay
    const timeoutId = setTimeout(() => {
      fetchNewIncidentReports();
    }, 1000);

    // Set up real-time subscription for job_documents changes
    const channel = supabase
      .channel('incident-reports-notifications')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT',
          schema: 'public',
          table: 'job_documents',
          filter: 'file_path=like.incident-reports/*'
        },
        (payload) => {
          console.log("New incident report created:", payload);
          // Debounce the fetch to avoid too many calls
          setTimeout(fetchNewIncidentReports, 500);
        }
      )
      .subscribe((status) => {
        console.log("Incident reports subscription status:", status);
      });

    return () => {
      clearTimeout(timeoutId);
      console.log("Cleaning up incident reports subscription");
      supabase.removeChannel(channel);
    };
  }, [fetchNewIncidentReports]);

  const handleIncidentReportsClick = () => {
    navigate('/incident-reports');
    // Reset the notification after navigating
    setHasNewReports(false);
    setNewReportsCount(0);
  };

  const isEligibleForBadge = ['management', 'admin'].includes(userRole);

  useAppBadgeSource('incident-reports', {
    count: newReportsCount,
    enabled: isEligibleForBadge && newReportsCount > 0,
  });

  // Only show for management and admin users
  if (!isEligibleForBadge) {
    return null;
  }

  if (!hasNewReports) return null;

  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2 text-orange-500 relative"
      onClick={handleIncidentReportsClick}
      disabled={isLoading}
    >
      <ClipboardList className="h-4 w-4" />
      <span>New Incident Reports</span>
      {newReportsCount > 0 && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {newReportsCount > 9 ? '9+' : newReportsCount}
        </span>
      )}
    </Button>
  );
};