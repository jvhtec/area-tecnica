export const CARLOS_AGENT_NAME = 'C.A.R.L.O.S.';
export const CARLOS_AGENT_DESCRIPTION =
  'Coordinador Automático de Recursos, Logística, Ofertas y Selección';
export const CARLOS_REQUEST_ORIGIN = 'auto_staffing';

export function isCarlosStaffingRequest(requestOrigin: string | null | undefined): boolean {
  return requestOrigin === CARLOS_REQUEST_ORIGIN;
}
