
import { ApiService } from "@/lib/api-service";
import { FLEX_API_BASE_URL } from "@/lib/api-config";
import { FlexFolderPayload, FlexFolderResponse } from "./types";

/**
 * Creates a folder in the Flex system
 */
export async function createFlexFolder(payload: FlexFolderPayload): Promise<FlexFolderResponse> {
  const apiService = ApiService.getInstance();
  console.log("Creating Flex folder with payload:", payload);
  
  try {
    const response = await apiService.post<FlexFolderResponse>(
      `${FLEX_API_BASE_URL}/element`,
      payload
    );
    
    console.log("Created Flex folder:", response);
    return response;
  } catch (error) {
    console.error("Flex folder creation error:", error);
    throw error;
  }
}
