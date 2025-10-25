import { supabase } from "@/integrations/supabase/client";
import { FlexFolderPayload, FlexFolderResponse } from "./types";
import { getFlexApiBaseUrl } from "./config";

let cachedFlexToken: string | null = null;

/**
 * Gets the Flex authentication token from Supabase secrets
 */
async function getFlexAuthToken(): Promise<string> {
  if (cachedFlexToken) return cachedFlexToken;

  const { data, error } = await supabase.functions.invoke('get-secret', {
    body: { secretName: 'X_AUTH_TOKEN' },
  });

  if (error) {
    throw new Error(error.message || 'Failed to resolve Flex auth token');
  }

  const token = (data as { X_AUTH_TOKEN?: string } | null)?.X_AUTH_TOKEN;
  if (!token) {
    throw new Error('Flex auth token response missing X_AUTH_TOKEN');
  }

  cachedFlexToken = token;
  return token;
}

/**
 * Creates a folder in the Flex system
 * @param payload The folder creation payload
 * @returns The created folder
 */
export async function createFlexFolder(payload: FlexFolderPayload): Promise<FlexFolderResponse> {
  console.log("Creating Flex folder with payload:", payload);
  
  const token = await getFlexAuthToken();
  const apiBaseUrl = getFlexApiBaseUrl();

  const response = await fetch(`${apiBaseUrl}/element`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": token,
      "apikey": token,
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Flex folder creation error:", errorData);
    throw new Error(errorData.exceptionMessage || "Failed to create folder in Flex");
  }

  const data = await response.json();
  console.log("Created Flex folder:", data);
  return data;
}
