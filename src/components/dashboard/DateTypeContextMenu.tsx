
import { useEffect, useState } from 'react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuTrigger } from '@/components/ui/context-menu';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Check, X, AlertCircle, Clock, Calendar, Star, Plane, Wrench, Moon, Mic } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JobStatusBadge } from '@/components/jobs/JobStatusBadge';

type JobType = 'tour' | 'tourdate' | 'festival' | 'single' | 'dryhire';
type DateType = 'show' | 'travel' | 'setup' | 'off' | 'rehearsal';
type JobStatus = "Tentativa" | "Confirmado" | "Completado" | "Cancelado";

interface DateTypeContextMenuProps {
  jobId: string;
  date: string;
  children: React.ReactNode;
  jobType?: JobType;
  jobStatus?: JobStatus | null;
  department?: string;
}

export function DateTypeContextMenu({ jobId, date, children, jobType, jobStatus, department }: DateTypeContextMenuProps) {
  const [currentDateType, setCurrentDateType] = useState<DateType | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchCurrentType = async () => {
      const { data, error } = await supabase
        .from('job_date_types')
        .select('type')
        .eq('job_id', jobId)
        .eq('date', date)
        .single();

      if (!error && data) {
        setCurrentDateType(data.type as DateType);
      }
    };

    fetchCurrentType();
  }, [jobId, date]);

  const updateDateTypeMutation = useMutation({
    mutationFn: async (newType: DateType) => {
      const { data: existing } = await supabase
        .from('job_date_types')
        .select('id')
        .eq('job_id', jobId)
        .eq('date', date)
        .single();

      if (existing) {
        await supabase
          .from('job_date_types')
          .update({ type: newType })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('job_date_types')
          .insert({
            job_id: jobId,
            date,
            type: newType
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: 'Date type updated',
        description: 'The date type has been successfully updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating date type',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleStatusChange = (newStatus: JobStatus) => {
    // This is handled by the JobStatusBadge component
  };

  const handleDateTypeChange = (newType: DateType) => {
    updateDateTypeMutation.mutate(newType);
    setCurrentDateType(newType);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <Tabs defaultValue="status">
          <TabsList className="w-full">
            <TabsTrigger value="status" className="flex-1"><Calendar className="h-4 w-4 mr-1" /> Job Status</TabsTrigger>
            <TabsTrigger value="datetype" className="flex-1">Date Type</TabsTrigger>
          </TabsList>
          
          <TabsContent value="status" className="py-2">
            <ContextMenuLabel>Set Job Status</ContextMenuLabel>
            <div className="p-2 flex justify-center">
              <JobStatusBadge 
                jobId={jobId} 
                status={jobStatus} 
                className="w-full justify-center"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="datetype">
            <ContextMenuLabel>Set Date Type</ContextMenuLabel>
            <ContextMenuItem 
              onClick={() => handleDateTypeChange('show')}
              className="flex items-center"
            >
              <Star className="h-4 w-4 mr-2 text-green-500" />
              Show
              {currentDateType === 'show' && <Check className="h-4 w-4 ml-auto" />}
            </ContextMenuItem>
            <ContextMenuItem 
              onClick={() => handleDateTypeChange('travel')}
              className="flex items-center"
            >
              <Plane className="h-4 w-4 mr-2 text-blue-500" />
              Travel
              {currentDateType === 'travel' && <Check className="h-4 w-4 ml-auto" />}
            </ContextMenuItem>
            <ContextMenuItem 
              onClick={() => handleDateTypeChange('setup')}
              className="flex items-center"
            >
              <Wrench className="h-4 w-4 mr-2 text-yellow-500" />
              Setup
              {currentDateType === 'setup' && <Check className="h-4 w-4 ml-auto" />}
            </ContextMenuItem>
            <ContextMenuItem 
              onClick={() => handleDateTypeChange('off')}
              className="flex items-center"
            >
              <Moon className="h-4 w-4 mr-2 text-gray-500" />
              Day Off
              {currentDateType === 'off' && <Check className="h-4 w-4 ml-auto" />}
            </ContextMenuItem>
            <ContextMenuItem 
              onClick={() => handleDateTypeChange('rehearsal')}
              className="flex items-center"
            >
              <Mic className="h-4 w-4 mr-2 text-violet-500" />
              Rehearsal
              {currentDateType === 'rehearsal' && <Check className="h-4 w-4 ml-auto" />}
            </ContextMenuItem>
          </TabsContent>
        </Tabs>
      </ContextMenuContent>
    </ContextMenu>
  );
}
