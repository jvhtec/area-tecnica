import { expect, test } from "@playwright/test";

import { bootstrapApp } from "./support/app";

test("loads equipment inventory and creates a new equipment row through the form", async ({
  page,
}) => {
  const calls = await bootstrapApp(page, {
    auth: {
      role: "management",
      department: "sound",
    },
    tables: {
      "global_stock_entries": ({ method }) => {
        if (method === "GET") {
          return [
            {
              id: "stock-1",
              equipment_id: "eq-1",
              base_quantity: 4,
              equipment: {
                id: "eq-1",
                category: "wireless",
                name: "QLX-D",
              },
            },
          ];
        }

        return null;
      },
      "equipment": ({ method, body }) => {
        if (method === "GET") {
          return [
            {
              id: "eq-1",
              name: "QLX-D",
              category: "wireless",
              manufacturer: "Shure",
              resource_id: null,
              image_id: null,
            },
          ];
        }

        const record = Array.isArray(body) ? body[0] : body;
        return {
          id: "eq-created",
          ...(record as Record<string, unknown>),
        };
      },
      "current_stock_levels": [
        {
          equipment_id: "eq-1",
          category: "wireless",
          current_quantity: 4,
        },
      ],
    },
  });

  await page.goto("/equipment-management");

  await expect(page.getByRole("heading", { name: /gestionar inventario/i })).toBeVisible();

  await page.getByRole("button", { name: /añadir equipo/i }).click();
  await page.getByLabel("Nombre").fill("Smoke Wireless Rack");
  await page.getByLabel("Cantidad").fill("3");
  await page.getByRole("button", { name: /^guardar$/i }).click();

  await expect(page.getByText(/equipo creado correctamente/i)).toBeVisible();
  await expect.poll(() => calls.tableMutations.length).toBeGreaterThan(0);
  await expect(
    calls.tableMutations.some(
      (call) =>
        call.table === "equipment" &&
        call.method === "POST" &&
        typeof call.body === "object" &&
        call.body !== null &&
        !Array.isArray(call.body) &&
        (call.body as Record<string, unknown>).name === "Smoke Wireless Rack",
    ),
  ).toBe(true);
});
