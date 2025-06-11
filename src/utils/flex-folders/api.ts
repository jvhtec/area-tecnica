
import { FlexFolderPayload, FlexFolderResponse } from "./types";

/**
 * Creates a folder in the Flex system
 * @param payload The folder creation payload
 * @returns The created folder
 */
export async function createFlexFolder(payload: FlexFolderPayload): Promise<FlexFolderResponse> {
  console.log("Creating Flex folder with payload:", payload);
  const response = await fetch("https://sectorpro.flexrentalsolutions.com/f5/api/element", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": "82b5m0OKgethSzL1YbrWMUFvxdNkNMjRf82E"
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
