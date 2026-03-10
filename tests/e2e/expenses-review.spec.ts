import { expect, test } from "@playwright/test";

import { bootstrapApp } from "./support/app";

test("loads the expenses review page and approves a submitted expense", async ({ page }) => {
  const calls = await bootstrapApp(page, {
    auth: {
      role: "management",
      department: "sound",
    },
    tables: {
      "job_expenses": [
        {
          id: "expense-1",
          job_id: "job-1",
          technician_id: "tech-1",
          category_slug: "dietas",
          expense_date: "2026-03-10",
          status: "submitted",
          amount_eur: 42,
          amount_original: 42,
          currency_code: "EUR",
          description: "Taxi aeropuerto",
          receipt_path: "expense-1.pdf",
          job: {
            title: "Smoke Expenses Job",
          },
          technician: {
            first_name: "Alex",
            last_name: "Doe",
          },
          category: {
            label_es: "Dietas",
          },
        },
      ],
    },
    rpc: {
      "approve_job_expense": {},
    },
  });

  await page.goto("/gastos");

  await expect(page.getByRole("heading", { name: /gastos de técnicos/i })).toBeVisible();
  await expect(page.getByText("Smoke Expenses Job")).toBeVisible();
  await expect(page.getByText("Alex Doe")).toBeVisible();

  await page.locator('tbody input[type="checkbox"]').first().check();
  await page.getByRole("button", { name: /aprobar seleccionados/i }).click();

  await expect(page.getByText(/gastos aprobados/i)).toBeVisible();
  await expect.poll(() => calls.rpcCalls.length).toBe(1);
  await expect
    .poll(() => calls.rpcCalls[0]?.body as Record<string, unknown>)
    .toMatchObject({
      p_expense_id: "expense-1",
      p_approved: true,
    });
});
