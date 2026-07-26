/**
 * The subset of a Flex element-creation response the app reads.
 *
 * Flex returns the new element's id under several different keys depending on the
 * endpoint, hence the alternatives — all optional because none is guaranteed.
 */
export type FlexElementResponse = {
  id?: string | null;
  elementId?: string | null;
  documentNumber?: string | null;
  elementNumber?: string | null;
  number?: string | null;
  data?: {
    id?: string | null;
    elementId?: string | null;
    documentNumber?: string | null;
  } | null;
  element?: { id?: string | null } | null;
};
