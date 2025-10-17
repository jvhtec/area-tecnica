
import { useEffect, useState, useCallback } from "react";
import { BellDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { useAppBadgeSource } from "@/hooks/useAppBadgeSource";

interface NotificationBadgeProps {
  userId: string;
  userRole: string;
  userDepartment: string | null;
}

export const NotificationBadge = ({ userId, userRole, userDepartment }: NotificationBadgeProps) => {
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const fetchUnreadMessages = useCallback(async () => {
    if (isLoading) return; // Prevent concurrent requests

    try {
      setIsLoading(true);
      console.log("Checking for unread messages...");
      
      // Check for unread department messages with optimized query
      let deptQuery = supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'unread');

      if (userRole === 'management') {
        deptQuery = deptQuery.eq('department', userDepartment);
      } else if (userRole === 'technician') {
        deptQuery = deptQuery.eq('sender_id', userId);
      }

      // Check for unread direct messages with optimized query
      const directQuery = supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('status', 'unread');

      const [deptMessages, directMessages] = await Promise.all([
        deptQuery,
        directQuery
      ]);

      if (deptMessages.error) {
        console.error('Error fetching department messages:', deptMessages.error);
        return;
      }

      if (directMessages.error) {
        console.error('Error fetching direct messages:', directMessages.error);
        return;
      }

      const departmentCount = deptMessages.count ?? 0;
      const directCount = directMessages.count ?? 0;
      const totalUnread = departmentCount + directCount;

      console.log("Unread messages status:", {
        departmentMessages: departmentCount,
        directMessages: directCount,
        hasUnread: totalUnread > 0,
        totalUnread
      });

      setUnreadCount(totalUnread);
      setHasUnreadMessages(totalUnread > 0);
    } catch (error) {
      console.error("Error checking unread messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, userRole, userDepartment, isLoading]);

  useEffect(() => {
    // Delay initial fetch to give priority to other sidebar components
    const timeoutId = setTimeout(() => {
      fetchUnreadMessages();
    }, 500);

    // Set up real-time subscription for both tables  
    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        { 
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log("Messages table changed:", payload);
          // Debounce the fetch to avoid too many calls
          setTimeout(fetchUnreadMessages, 200);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
        },
        (payload) => {
          console.log("Direct messages changed:", payload);
          // Debounce the fetch to avoid too many calls
          setTimeout(fetchUnreadMessages, 200);
        }
      )
      .subscribe((status) => {
        console.log("Realtime subscription status:", status);
      });

    return () => {
      clearTimeout(timeoutId);
      console.log("Cleaning up realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [fetchUnreadMessages]);

  const handleMessageNotificationClick = () => {
    if (userRole === 'management') {
      navigate('/dashboard?showMessages=true');
    } else if (userRole === 'technician') {
      navigate('/technician-dashboard?showMessages=true');
    }
  };

  useAppBadgeSource('messages', unreadCount > 0 ? { count: unreadCount } : null);

  if (!hasUnreadMessages) return null;

  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2 text-yellow-500"
      onClick={handleMessageNotificationClick}
      disabled={isLoading}
    >
      <BellDot className="h-4 w-4" />
      <span>New Messages</span>
    </Button>
  );
};
