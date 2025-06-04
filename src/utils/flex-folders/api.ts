
import { supabase } from "@/lib/supabase";
import { FlexFolderPayload, FlexFolderResponse } from "./types";

/**
 * Creates a folder in the Flex system using secure edge function
 */
export async function createFlexFolder(payload: FlexFolderPayload): Promise<FlexFolderResponse> {
  console.log("Creating Flex folder with payload:", payload);
  
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
      throw new Error(data.error || "Failed to create folder in Flex");
    }

    console.log("Created Flex folder:", data.data);
    return data.data;
  } catch (error) {
    console.error("Flex folder creation error:", error);
    throw error;
  }
}
