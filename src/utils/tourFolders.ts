
import { supabase } from "@/lib/supabase";

export interface TourFolderCreationResult {
  success: boolean;
  error?: string;
  data?: any;
}

export async function createTourRootFolders(tourId: string): Promise<TourFolderCreationResult> {
  try {
    console.log("Creating tour root folders for:", tourId);
    
    const { data, error } = await supabase.functions.invoke('create-flex-folders', {
      body: {
        tourId,
        createRootFolders: true,
        createDateFolders: false
      }
    });

    if (error) {
      console.error("Error creating tour root folders:", error);
      return { success: false, error: error.message || "Failed to create tour root folders" };
    }

    console.log("Successfully created tour root folders:", data);
    return { success: true, data };
  } catch (error: any) {
    console.error("Exception creating tour root folders:", error);
    return { success: false, error: error.message || "Unknown error occurred" };
  }
}

export async function createTourDateFolders(tourId: string): Promise<TourFolderCreationResult> {
  try {
    console.log("Creating tour date folders for:", tourId);
    
    const { data, error } = await supabase.functions.invoke('create-flex-folders', {
      body: {
        tourId,
        createRootFolders: false,
        createDateFolders: true
      }
    });

    if (error) {
      console.error("Error creating tour date folders:", error);
      return { success: false, error: error.message || "Failed to create tour date folders" };
    }

    console.log("Successfully created tour date folders:", data);
    return { success: true, data };
  } catch (error: any) {
    console.error("Exception creating tour date folders:", error);
    return { success: false, error: error.message || "Unknown error occurred" };
  }
}

export async function createAllTourFolders(tourId: string): Promise<TourFolderCreationResult> {
  try {
    console.log("Creating all tour folders for:", tourId);
    
    const { data, error } = await supabase.functions.invoke('create-flex-folders', {
      body: {
        tourId,
        createRootFolders: true,
        createDateFolders: true
      }
    });

    if (error) {
      console.error("Error creating all tour folders:", error);
      return { success: false, error: error.message || "Failed to create tour folders" };
    }

    console.log("Successfully created all tour folders:", data);
    return { success: true, data };
  } catch (error: any) {
    console.error("Exception creating all tour folders:", error);
    return { success: false, error: error.message || "Unknown error occurred" };
  }
}
