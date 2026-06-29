import { describe, expect, it } from "vitest";

import {
  buildInvoiceRecipientListItems,
  INVOICE_CC_EMAIL,
  INVOICE_SUBMISSION_EMAIL,
} from "../invoiceInstructions.ts";

describe("job payout invoice instructions", () => {
  it("shows the invoice recipient and required CC address", () => {
    const html = buildInvoiceRecipientListItems();

    expect(html).toContain(`mailto:${INVOICE_SUBMISSION_EMAIL}`);
    expect(html).toContain(INVOICE_SUBMISSION_EMAIL);
    expect(html).toContain("Enviar factura a:");
    expect(html).toContain(`mailto:${INVOICE_CC_EMAIL}`);
    expect(html).toContain(INVOICE_CC_EMAIL);
    expect(html).toContain("Poner en copia a:");
  });
});
