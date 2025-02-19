import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Message } from '../types';
import { useMessagesSubscription } from './useMessagesSubscription';

export const useMessagesQuery = (userRole: string | null, userDepartment: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['messages', userRole, userDepartment],
    queryFn: async () => {
      console.log('Fetching messages for role:', userRole, 'department:', userDepartment);
      
      if (!userRole) {
        console.log('No user role, skipping fetch');
        return [];
      }

      const query = supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey (
            id,
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      if (userRole === 'management') {
        query.eq('department', userDepartment);
      } else {
        query.eq('sender_id', await supabase.auth.getUser().then(res => res.data.user?.id));
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }

      console.log('Fetched messages:', data);
      return data || [];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: !!userRole,
  });

  useEffect(() => {
    if (data) {
      setMessages(data);
    }
  }, [data]);

  // Set up real-time subscription
  const userId = supabase.auth.getUser().then(res => res.data.user?.id);
  useMessagesSubscription(userId ? String(userId) : undefined, () => {
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