import { flexApiFetch } from "@/lib/flex-api-client";
import { FlexFolderPayload, FlexFolderResponse } from "./types";

/**
 * Error response from Flex API
 */
interface FlexApiError {
  exceptionMessage?: string;
}

/**
 * Creates a folder in the Flex system
 * @param payload The folder creation payload
 * @returns The created folder
 */
export async function createFlexFolder(payload: FlexFolderPayload): Promise<FlexFolderResponse> {
  console.log("Creating Flex folder with payload:", payload);
  
  const response = await flexApiFetch("/element", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json<FlexApiError>();
    console.error("Flex folder creation error:", errorData);
    throw new Error(errorData.exceptionMessage || "Failed to create folder in Flex");
  }

  const data = await response.json<FlexFolderResponse>();
  console.log("Created Flex folder:", data);
  return data;
}

export async function deleteFlexFolder(elementId: string): Promise<void> {
  const response = await flexApiFetch(`/element/${encodeURIComponent(elementId)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    let errorData: FlexApiError | null = null;
    try {
      errorData = await response.json() as FlexApiError;
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
  const response = await flexApiFetch(
    `/element/${encodeURIComponent(elementId)}/header-update`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    let errorData: FlexApiError | null = null;
    try {
      errorData = await response.json() as FlexApiError;
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
