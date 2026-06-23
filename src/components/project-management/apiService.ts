import { flexApiFetch } from "@/lib/flex-api-client";
export interface CreateLaborPORequest {
  name: string;
  plannedStartDate: string;
  plannedEndDate: string;
  personResponsibleId: string;
  locationId: string;
  vendorId: string;
  parentElementId: string;
}

export interface CreateLaborPOResponse {
  id: string;
  name: string;
}

export interface AddResourceLineItemRequest {
  documentId: string;
  resourceId: string;
  resourceParentId: string;
  managedResourceLineItemType: string;
  quantity: number;
}

export interface AddResourceLineItemResponse {
  addedResourceLineIds: string[];
  affectedRootLineIds: string[];
  addedNoteLineId: string | null;
  nonRootClonedLineIds: string[] | null;
}

export interface UpdateLineItemDatesRequest {
  documentId: string;
  lineItemId: string;
  alternatePickupDate: string;
  alternateReturnDate: string;
}

export interface UpdateLineItemDatesResponse {
  success: boolean;
}

export interface ProjectDetails {
  id: string;
  name: string;
}

export interface ProjectHeader {
  documentName: string;
  venueId: string;
  plannedStartDate: string;
  plannedEndDate: string;
  personResponsibleId: { id: string };
  locationId: string;
}

interface FlexField<T> {
  fieldType: string;
  data?: T;
  fieldRestrictions: {
    readOnly: boolean;
    readOnlyReason: string | null;
    timeAssociated: boolean;
    required: boolean;
  };
}

interface FlexUserData {
  id: string;
  name: string;
  userName: string;
  domainId: string;
}

interface FlexPersonResponsible {
  id: string;
  name: string;
  preferredDisplayString: string;
  barcode: string | null;
  deleted: boolean;
  shortName: string | null;
  shortNameOrName: string;
  className: string | null;
}

interface ProjectHeaderResponse {
  documentName: FlexField<string>;
  documentNumber: FlexField<string>;
  personResponsibleId: FlexField<FlexPersonResponsible>;
  plannedStartDate: FlexField<string>;
  plannedEndDate: FlexField<string>;
  venueId: FlexField<string>;
  createdByUserId: FlexField<FlexUserData>;
  lastEditBy: FlexField<FlexUserData>;
  lastEditDate: FlexField<string>;
  createdByDate: FlexField<string>;
  clientId: FlexField<string>;
  customerPO: FlexField<string>;
}

export const getProjectDetails = async (searchText: string): Promise<ProjectDetails[]> => {
  const url = `/element/search?searchText=${encodeURIComponent(searchText)}`;
  
  const response = await flexApiFetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch project details: ${response.statusText}`);
  }

  return response.json();
};

export const getProjectHeader = async (projectId: string): Promise<ProjectHeader> => {
  const url = `/element/${encodeURIComponent(projectId)}/key-info/`;
  
  const response = await flexApiFetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch project header: ${response.statusText}`);
  }

  const data = await response.json<ProjectHeaderResponse>();
  
  return {
    documentName: data.documentName.data || '',
    venueId: data.venueId.data || '',
    plannedStartDate: data.plannedStartDate.data || '',
    plannedEndDate: data.plannedEndDate.data || '',
    personResponsibleId: data.personResponsibleId.data ? { id: data.personResponsibleId.data.id } : { id: '' },
    locationId: data.venueId.data || ''
  };
};

export const createLaborPO = async (data: CreateLaborPORequest): Promise<CreateLaborPOResponse> => {
  const url = '/element';

  const response = await flexApiFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: '*/*',
    },
    body: JSON.stringify({
      definitionId: 'labor-po-definition-id',
      parentElementId: data.parentElementId,
      open: true,
      locked: false,
      documentNumber: data.name,
      name: data.name,
      plannedStartDate: data.plannedStartDate,
      plannedEndDate: data.plannedEndDate,
      personResponsibleId: data.personResponsibleId,
      locationId: data.locationId,
      vendorId: data.vendorId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create Labor PO: ${response.statusText}`);
  }

  const responseData = await response.json<CreateLaborPOResponse>();
  return {
    id: responseData.id,
    name: responseData.name,
  };
};

export const addResourceLineItem = async (
  data: AddResourceLineItemRequest
): Promise<AddResourceLineItemResponse> => {
  const query = new URLSearchParams({
    resourceParentId: data.resourceParentId,
    managedResourceLineItemType: data.managedResourceLineItemType,
    quantity: String(data.quantity),
  });
  const url = `/financial-document-line-item/${encodeURIComponent(data.documentId)}/add-resource/${encodeURIComponent(data.resourceId)}?${query}`;

  const response = await flexApiFetch(url, {
    method: 'POST',
    headers: {
      accept: '*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to add resource line item: ${response.statusText}`);
  }

  return response.json<AddResourceLineItemResponse>();
};

export const updateLineItemDates = async (
  data: UpdateLineItemDatesRequest
): Promise<UpdateLineItemDatesResponse> => {
  const url = `/financial-document-line-item/${encodeURIComponent(data.documentId)}/bulk-update`;

  const payload = {
    bulkData: [
      {
        itemId: data.lineItemId,
        alternatePickupDate: data.alternatePickupDate,
        alternateReturnDate: data.alternateReturnDate,
      },
    ],
  };

  const response = await flexApiFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: '*/*',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to update line item dates: ${response.statusText}`);
  }

  return { success: true };
};

export interface ElementTreeNode {
  nodeId: string;
  name: string;
  documentNumber?: string;
  parentId?: string | null;
  iconUrl?: string;
  leaf: boolean;
  children?: ElementTreeNode[];
  displayName: string;
}

export const getElementTree = async (elementId: string): Promise<ElementTreeNode[]> => {
  const url = `/element/${encodeURIComponent(elementId)}/tree`;

  console.log(`Fetching element tree for element ID: ${elementId}`);

  const response = await flexApiFetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorMessage = `Failed to fetch element tree for element ID ${elementId}: ${response.statusText} (${response.status})`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  const data = await response.json<ElementTreeNode[] | unknown>();
  console.log(`Successfully fetched element tree for element ID: ${elementId}`, data);

  return Array.isArray(data) ? data : [];
};
