
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { createAllFoldersForJob } from "@/utils/flex-folders/folders";
import { format } from "date-fns";
import { toast } from "sonner";

export const useTourDateFlexFolders = (tourId: string) => {
  const [creatingAll, setCreatingAll] = useState(false);
  const [creatingIndividual, setCreatingIndividual] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const createFoldersForTourDate = useMutation({
    mutationFn: async (tourDate: any) => {
      console.log('Creating Flex folders for tour date:', tourDate);
      
      // Get the associated job for this tour date
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('tour_date_id', tourDate.id)
        .single();

      if (jobError || !job) {
        throw new Error(`No job found for tour date ${tourDate.id}`);
      }

      // Format dates for Flex API
      const formattedStartDate = format(new Date(job.start_time), 'yyyy-MM-dd');
      const formattedEndDate = format(new Date(job.end_time), 'yyyy-MM-dd');
      
      // Generate document number
      const jobDate = new Date(job.start_time);
      const year = jobDate.getFullYear().toString().slice(-2);
      const month = String(jobDate.getMonth() + 1).padStart(2, '0');
      const day = String(jobDate.getDate()).padStart(2, '0');
      const documentNumber = `${year}${month}${day}`;

      // Create folders using existing utility
      await createAllFoldersForJob(job, formattedStartDate, formattedEndDate, documentNumber);

      // Mark job as having folders created
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ flex_folders_created: true })
        .eq('id', job.id);

      if (updateError) {
        console.error('Error updating job folder status:', updateError);
        throw updateError;
      }

      return { job, tourDate };
    },
    onSuccess: (data) => {
      toast.success(`Flex folders created successfully for ${format(new Date(data.tourDate.date), 'MMM d, yyyy')}`);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['tour-dates', tourId] });
    },
    onError: (error: any) => {
      console.error('Error creating Flex folders:', error);
      toast.error(`Failed to create Flex folders: ${error.message}`);
    }
  });

  const createFoldersForAllTourDates = useMutation({
    mutationFn: async (tourDates: any[]) => {
      console.log('Creating Flex folders for all tour dates:', tourDates.length);
      setCreatingAll(true);
      
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const tourDate of tourDates) {
        try {
          // Check if folders already exist for this date
          const { data: job } = await supabase
            .from('jobs')
            .select('flex_folders_created')
            .eq('tour_date_id', tourDate.id)
            .single();

          if (job?.flex_folders_created) {
            console.log(`Skipping ${tourDate.id} - folders already exist`);
            continue;
          }

          await createFoldersForTourDate.mutateAsync(tourDate);
          successCount++;
          results.push({ tourDate, success: true });
        } catch (error) {
          console.error(`Error creating folders for ${tourDate.id}:`, error);
          errorCount++;
          results.push({ tourDate, success: false, error });
        }
      }

      return { results, successCount, errorCount };
    },
    onSuccess: (data) => {
      setCreatingAll(false);
      if (data.successCount > 0) {
        toast.success(`Successfully created Flex folders for ${data.successCount} tour dates`);
      }
      if (data.errorCount > 0) {
        toast.error(`Failed to create folders for ${data.errorCount} tour dates`);
      }
    },
    onError: (error: any) => {
      setCreatingAll(false);
      console.error('Error creating all Flex folders:', error);
      toast.error(`Failed to create Flex folders: ${error.message}`);
    }
  });

  const createIndividualFolders = async (tourDate: any) => {
    setCreatingIndividual(tourDate.id);
    try {
      await createFoldersForTourDate.mutateAsync(tourDate);
    } finally {
      setCreatingIndividual(null);
    }
  };

  const createAllFolders = async (tourDates: any[]) => {
    await createFoldersForAllTourDates.mutateAsync(tourDates);
  };

  return {
    createIndividualFolders,
    createAllFolders,
    isCreatingAll: creatingAll,
    isCreatingIndividual: creatingIndividual,
    isLoading: createFoldersForTourDate.isPending || createFoldersForAllTourDates.isPending
  };
};
