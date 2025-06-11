
import { supabase } from "@/lib/supabase";
import { FlexFolderPayload, FlexFolderResponse } from "./types";

/**
 * Creates a folder in the Flex system using secure edge function
 * Now properly handles the sophisticated payload structure with all required fields
 */
export async function createFlexFolder(payload: FlexFolderPayload): Promise<FlexFolderResponse> {
  console.log("Creating Flex folder with payload:", JSON.stringify(payload, null, 2));
  
  try {
    const { data, error } = await supabase.functions.invoke('secure-flex-api', {
      body: {
        endpoint: '/element',
        method: 'POST',
        payload
      }
    });

    console.log("Secure Flex API response:", data);

    if (error) {
      console.error("Secure Flex API error:", error);
      throw new Error(error.message || "Failed to create folder in Flex");
    }

    if (!data) {
      console.error("No data returned from Flex API");
      throw new Error("No data returned from Flex API");
    }

    if (!data.success) {
      console.error("Flex folder creation failed:", data.error);
      throw new Error(data.error || "Failed to create folder in Flex");
    }

    if (!data.data || !data.data.id) {
      console.error("Invalid response structure from Flex API:", data);
      throw new Error("Invalid response structure from Flex API");
    }

    console.log("Created Flex folder successfully:", data.data);
    return {
      elementId: data.data.id,
      ...data.data
    };
  } catch (error) {
    console.error("Flex folder creation error:", error);
    
    // Provide more specific error messages based on the error type
    if (error instanceof Error) {
      if (error.message.includes('could not be parsed')) {
        throw new Error('Date format error: Please check the date format being sent to Flex API');
      }
      if (error.message.includes('authentication')) {
        throw new Error('Authentication error: Please check Flex API credentials');
      }
    }
    
    throw error;
  }
}
