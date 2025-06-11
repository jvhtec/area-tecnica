
import { supabase } from "@/lib/supabase";
import { FlexFolderPayload, FlexFolderResponse } from "./types";

/**
 * Creates a folder in the Flex system using secure edge function
 * Now properly handles the sophisticated payload structure with all required fields
 */
export async function createFlexFolder(payload: FlexFolderPayload): Promise<FlexFolderResponse> {
  console.log("Creating Flex folder with sophisticated payload:", payload);
  
  try {
    const { data, error } = await supabase.functions.invoke('secure-flex-api', {
      body: {
        endpoint: '/element',
        method: 'POST',
        payload
      }
    });

    if (error) {
      console.error("Secure Flex API error:", error);
      throw new Error(error.message || "Failed to create folder in Flex");
    }

    if (!data.success) {
      console.error("Flex folder creation failed:", data.error);
      throw new Error(data.error || "Failed to create folder in Flex");
    }

    console.log("Created Flex folder successfully:", data.data);
    return {
      elementId: data.data.id,
      ...data.data
    };
  } catch (error) {
    console.error("Flex folder creation error:", error);
    throw error;
  }
}
