
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface ProgressiveFlexFolderCreation {
  jobId: string;
  jobTitle: string;
  startTime: string;
  endTime: string;
}

interface ProgressStep {
  step: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  message: string;
}

const FLEX_API_BASE_URL = 'https://api.intranet.sectorpro.es';

export const useProgressiveFlexFolders = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  const updateProgress = (step: string, status: 'in-progress' | 'completed' | 'error', message: string) => {
    setCurrentStep(step);
    
    if (status === 'completed') {
      toast({
        title: "✓ " + message,
        variant: "default"
      });
    } else if (status === 'in-progress') {
      toast({
        title: "🔄 " + message,
        variant: "default"
      });
    } else if (status === 'error') {
      toast({
        title: "❌ " + message,
        variant: "destructive"
      });
    }
  };

  const createFlexFolder = async (payload: any, authToken: string) => {
    const response = await fetch(`${FLEX_API_BASE_URL}/element`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  };

  const createProgressiveFolders = useMutation({
    mutationFn: async ({ jobId, jobTitle, startTime, endTime }: ProgressiveFlexFolderCreation) => {
      setIsCreating(true);
      
      try {
        // Step 1: Initialize
        updateProgress('init', 'in-progress', 'Starting folder creation process...');
        
        // Get environment variables
        const authToken = process.env.NEXT_PUBLIC_FLEX_AUTH_TOKEN;
        const parentFolderId = process.env.NEXT_PUBLIC_FLEX_PARENT_FOLDER_ID;
        
        if (!authToken || !parentFolderId) {
          throw new Error('Flex API configuration missing');
        }

        // Step 2: Create main job folder
        updateProgress('main', 'in-progress', 'Creating main job folder...');
        
        const startDate = new Date(startTime);
        const documentNumber = startDate.toISOString().slice(2, 10).replace(/-/g, "");
        const folderName = `${documentNumber} - ${jobTitle}`;
        
        const mainFolder = await createFlexFolder({
          name: folderName,
          parent_id: parentFolderId,
          description: `Main folder for ${jobTitle}`
        }, authToken);
        
        updateProgress('main', 'completed', 'Main job folder created');

        // Step 3: Create department folders
        updateProgress('departments', 'in-progress', 'Creating department folders...');
        
        const departments = ['Sound', 'Lights', 'Video', 'Production', 'Personnel'];
        const departmentFolders = [];
        
        for (const dept of departments) {
          const deptFolder = await createFlexFolder({
            name: `${folderName} - ${dept}`,
            parent_id: mainFolder.id,
            description: `${dept} folder for ${jobTitle}`
          }, authToken);
          departmentFolders.push({ department: dept.toLowerCase(), folderId: deptFolder.id });
        }
        
        updateProgress('departments', 'completed', `Created ${departments.length} department folders`);

        // Step 4: Store in database
        updateProgress('database', 'in-progress', 'Updating database records...');
        
        // Store main folder
        const { error: mainFolderError } = await supabase
          .from("flex_folders")
          .insert({
            job_id: jobId,
            element_id: mainFolder.id,
            folder_type: "main"
          });

        if (mainFolderError) throw mainFolderError;

        // Store department folders
        for (const { department, folderId } of departmentFolders) {
          const { error: deptError } = await supabase
            .from("flex_folders")
            .insert({
              job_id: jobId,
              element_id: folderId,
              folder_type: "department",
              department: department
            });
          
          if (deptError) throw deptError;
        }

        // Update job record
        const { error: jobUpdateError } = await supabase
          .from("jobs")
          .update({ flex_folders_created: true })
          .eq("id", jobId);

        if (jobUpdateError) throw jobUpdateError;
        
        updateProgress('database', 'completed', 'Database records updated');

        // Final success message
        toast({
          title: "🎉 Folder creation complete!",
          description: `Created 1 main folder and ${departments.length} department folders successfully`,
          variant: "default"
        });

        return { success: true, mainFolder, departmentFolders };
        
      } catch (error: any) {
        console.error("Error in progressive folder creation:", error);
        updateProgress('error', 'error', `Failed at step: ${currentStep} - ${error.message}`);
        throw error;
      } finally {
        setIsCreating(false);
        setCurrentStep('');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["folder-existence"] });
    }
  });

  return {
    createProgressiveFolders: createProgressiveFolders.mutateAsync,
    isCreating,
    currentStep,
    isLoading: createProgressiveFolders.isPending
  };
};
