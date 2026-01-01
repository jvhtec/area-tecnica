/**
 * Shared invoicing company data for payout documents and emails
 * Used by edge functions (Deno runtime)
 *
 * NOTE: This file is duplicated in src/utils/invoicing-company-data.ts
 * for use by the frontend app. Keep both files in sync when making changes.
 */

export interface InvoicingCompanyDetails {
  name: string;
  legalName: string;
  cif: string;
  address: string;
}

export const INVOICING_COMPANY_DATA: Record<string, InvoicingCompanyDetails> = {
  "Production Sector": {
    name: "Production Sector",
    legalName: "Production Sector S.L.",
    cif: "B86964673",
    address: "Calle Puerto Rico, 6, Griñón, 28971, Madrid",
  },
  "Sharecable": {
    name: "Sharecable",
    legalName: "Share Cable S.L.",
    cif: "B87287603",
    address: "Calle Puerto Rico, 6, Griñón, 28971, Madrid",
  },
  "MFO": {
    name: "MFO",
    legalName: "Montajes Festivales Y Organizaciones S.L.",
    cif: "B91808691",
    address: "Calle Puerto Rico, 6, Griñón, 28971, Madrid",
  },
};

/**
 * Get full invoicing company details by name
 */
export function getInvoicingCompanyDetails(companyName: string | null | undefined): InvoicingCompanyDetails | null {
  if (!companyName) return null;
  return INVOICING_COMPANY_DATA[companyName] ?? null;
}

/**
 * Format invoicing company details for display (single line)
 */
export function formatInvoicingCompanyOneLine(companyName: string | null | undefined): string | null {
  const details = getInvoicingCompanyDetails(companyName);
  if (!details) return null;
  return `${details.legalName} · CIF: ${details.cif} · ${details.address}`;
}

/**
 * Format invoicing company details for multi-line display
 */
export function formatInvoicingCompanyMultiLine(companyName: string | null | undefined): string[] | null {
  const details = getInvoicingCompanyDetails(companyName);
  if (!details) return null;
  return [
    details.legalName,
    `CIF: ${details.cif}`,
    details.address,
  ];
}
