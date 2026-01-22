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

export async function deleteFlexFolder(elementId: string): Promise<void> {
  const token = await getFlexAuthToken();
  const apiBaseUrl = getFlexApiBaseUrl();

  const response = await fetch(`${apiBaseUrl}/element/${encodeURIComponent(elementId)}`, {
    method: "DELETE",
    headers: {
      "X-Auth-Token": token,
      "apikey": token,
    },
  });

  if (!response.ok) {
    let errorData: any = null;
    try {
      errorData = await response.json();
    } catch {
      // ignore non-JSON response
    }
    console.error("Flex folder deletion error:", errorData);
    throw new Error(errorData?.exceptionMessage || `Failed to delete folder in Flex (${response.status})`);
  }
}

/**
 * Updates a header field on a Flex element
 * @param elementId The element UUID to update
 * @param fieldType The field to update (e.g., "documentNumber", "plannedStartDate", "plannedEndDate")
 * @param value The new value for the field
 */
export async function updateFlexElementHeader(
  elementId: string,
  fieldType: string,
  value: string
): Promise<void> {
  const token = await getFlexAuthToken();
  const apiBaseUrl = getFlexApiBaseUrl();

  const response = await fetch(
    `${apiBaseUrl}/element/${encodeURIComponent(elementId)}/header-update`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": token,
        "X-Api-Client": "flex5-desktop",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        fieldType,
        payloadValue: value,
        displayValue: value,
      }),
    }
  );

  if (!response.ok) {
    let errorData: any = null;
    try {
      errorData = await response.json();
    } catch {
      // ignore non-JSON response
    }
    console.error(`Flex element header update error (${fieldType}):`, errorData);
    throw new Error(
      errorData?.exceptionMessage ||
        `Failed to update ${fieldType} in Flex (${response.status})`
    );
  }
}
