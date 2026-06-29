
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { createAllFoldersForJob } from "@/utils/flex-folders/folders";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import type { FlexFolderJob } from "@/utils/flex-folders/folder-creation/types";

import { queryKeys } from "@/lib/react-query";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type TourDateRow = Database["public"]["Tables"]["tour_dates"]["Row"];
type TourDateFolderInput = Pick<TourDateRow, "id" | "date">;
type JobFolderStatusRow = Pick<JobRow, "flex_folders_created">;
type FolderCreationResult = {
  job: FlexFolderJob;
  tourDate: TourDateFolderInput;
};
type FolderBatchResult =
  | { tourDate: TourDateFolderInput; success: true }
  | { tourDate: TourDateFolderInput; success: false; error: unknown };

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown error";
};

export const useTourDateFlexFolders = (tourId: string) => {
  const [creatingAll, setCreatingAll] = useState(false);
  const [creatingIndividual, setCreatingIndividual] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const createFoldersForTourDate = useMutation({
    mutationFn: async (tourDate: TourDateFolderInput): Promise<FolderCreationResult> => {
      console.log('Creating Flex folders for tour date:', tourDate);
      
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('tour_date_id', tourDate.id)
        .single();

      if (jobError || !job) {
        throw new Error(`No job found for tour date ${tourDate.id}`);
      }

      // Use the correct ISO datetime format that works with Flex API
      const formattedStartDate = new Date(job.start_time).toISOString().split(".")[0] + ".000Z";
      const formattedEndDate = new Date(job.end_time).toISOString().split(".")[0] + ".000Z";
      
      const jobDate = new Date(job.start_time);
      const year = jobDate.getFullYear().toString().slice(-2);
      const month = String(jobDate.getMonth() + 1).padStart(2, '0');
      const day = String(jobDate.getDate()).padStart(2, '0');
      const documentNumber = `${year}${month}${day}`;

      await createAllFoldersForJob(job, formattedStartDate, formattedEndDate, documentNumber);

      const { error: updateError } = await supabase
        .from('jobs')
        .update({ flex_folders_created: true })
        .eq('id', job.id);

      if (updateError) {
        console.error('Error updating job folder status:', updateError);
        throw updateError;
      }

      // Broadcast push notification: Flex folders created for job
      try {
        void supabase.functions.invoke('push', {
          body: { action: 'broadcast', type: 'flex.folders.created', job_id: job.id }
        });
      } catch (pushError) {
        console.error('Error sending push notification:', pushError);
      }

      return { job, tourDate };
    },
    onSuccess: (data) => {
      toast.success(`Flex folders created successfully for ${new Date(data.tourDate.date).toLocaleDateString()}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('optimized-jobs') });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('jobs') });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('tour-dates', tourId) });
    },
    onError: (error: unknown) => {
      console.error('Error creating Flex folders:', error);
      toast.error(`Failed to create Flex folders: ${getErrorMessage(error)}`);
    }
  });

  const createFoldersForAllTourDates = useMutation({
    mutationFn: async (tourDates: TourDateFolderInput[]) => {
      console.log('Creating Flex folders for all tour dates:', tourDates.length);
      setCreatingAll(true);
      
      const results: FolderBatchResult[] = [];
      let successCount = 0;
      let errorCount = 0;

      for (const tourDate of tourDates) {
        try {
          const { data: job } = await supabase
            .from('jobs')
            .select('flex_folders_created')
            .eq('tour_date_id', tourDate.id)
            .single();

          const folderStatus = job as JobFolderStatusRow | null;
          if (folderStatus?.flex_folders_created) {
            console.log(`Skipping ${tourDate.id} - folders already exist`);
            continue;
          }

          // Add to individual creating state during bulk operation
          setCreatingIndividual(prev => new Set([...prev, tourDate.id]));
          
          await createFoldersForTourDate.mutateAsync(tourDate);
          successCount++;
          results.push({ tourDate, success: true });
        } catch (error) {
          console.error(`Error creating folders for ${tourDate.id}:`, error);
          errorCount++;
          results.push({ tourDate, success: false, error });
        } finally {
          // Remove from individual creating state
          setCreatingIndividual(prev => {
            const newSet = new Set(prev);
            newSet.delete(tourDate.id);
            return newSet;
          });
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
    onError: (error: unknown) => {
      setCreatingAll(false);
      console.error('Error creating all Flex folders:', error);
      toast.error(`Failed to create Flex folders: ${getErrorMessage(error)}`);
    }
  });

  const createIndividualFolders = async (tourDate: TourDateFolderInput) => {
    // Prevent multiple clicks for the same tour date
    if (creatingIndividual.has(tourDate.id)) {
      console.log('Folder creation already in progress for tour date:', tourDate.id);
      return;
    }
    
    setCreatingIndividual(prev => new Set([...prev, tourDate.id]));
    try {
      await createFoldersForTourDate.mutateAsync(tourDate);
    } finally {
      setCreatingIndividual(prev => {
        const newSet = new Set(prev);
        newSet.delete(tourDate.id);
        return newSet;
      });
    }
  };

  const createAllFolders = async (tourDates: TourDateFolderInput[]) => {
    if (creatingAll) {
      console.log('Bulk folder creation already in progress');
      return;
    }
    await createFoldersForAllTourDates.mutateAsync(tourDates);
  };

  const isCreatingIndividual = (tourDateId: string) => {
    return creatingIndividual.has(tourDateId);
  };

  return {
    createIndividualFolders,
    createAllFolders,
    isCreatingAll: creatingAll,
    isCreatingIndividual,
    isLoading: createFoldersForTourDate.isPending || createFoldersForAllTourDates.isPending
  };
};
