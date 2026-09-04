
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataLayerClient } from '@/services/dataLayerClient';
import { Message } from '../types';
import { useMessagesSubscription } from './useMessagesSubscription';
import { isDepartmentManagementRole } from '@/utils/permissions';


import { queryKeys } from "@/lib/react-query";
export const useMessagesQuery = (
  userRole: string | null,
  userDepartment: string | null,
  userId: string | null,
) => {
  const [messages, setMessages] = useState<Message[]>([]);

  const { data, isLoading, isFetching } = useQuery({
    // Technician and departmentless-management results are scoped by sender.
    // Include the user so React Query cannot reuse another account's messages after a login change.
    queryKey: queryKeys.scope('messages', userRole, userDepartment, userId),
    queryFn: async () => {
      console.log('Fetching messages for role:', userRole, 'department:', userDepartment);
      
      if (!userRole) {
        console.log('No user role, skipping fetch');
        return [];
      }

      const query = dataLayerClient.from('messages')
        .select(`
          id,
          content,
          created_at,
          department,
          sender_id,
          status,
          metadata,
          sender:profiles!messages_sender_id_fkey (
            id,
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      if (isDepartmentManagementRole(userRole) && userDepartment) {
        query.eq('department', userDepartment);
      } else {
        // No signed-in user means no messages to scope to.
        if (!userId) return [];
        query.eq('sender_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }

      console.log('Fetched messages:', data);
      
      // Transform the data to handle the sender relationship properly
      const transformedData = (data || []).map((msg: any) => ({
        ...msg,
        sender: Array.isArray(msg.sender) && msg.sender.length > 0 
          ? msg.sender[0] 
          : msg.sender || { id: '', first_name: '', last_name: '' }
      }));
      
      return transformedData;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: !!userRole && !!userId,
  });

  useEffect(() => {
    if (data) {
      setMessages(data);
    }
  }, [data]);

  // Use the same identity as the query so auth changes also move the realtime scope.
  useMessagesSubscription(userId ?? undefined, () => {
    if (data) {
      setMessages(data);
    }
  });

  return {
    messages,
    loading: isLoading,
    isFetching,
    setMessages,
  };
};
