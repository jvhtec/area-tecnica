import {
  expect,
  test as base,
  type Page,
} from "@playwright/test";

import {
  bootstrapApp,
  isMobileViewport,
  type SupabaseCallLog,
} from "./support/app";

const JOB_ID = "b1000000-0000-0000-0000-000000000001";
const DOCUMENT_ID = "b2000000-0000-0000-0000-000000000001";
const RESTAURANT_SELECTED_ID = "restaurant-selected";
const RESTAURANT_ADDED_ID = "restaurant-added";
const REMOVED_IMAGE_ID = "b3000000-0000-0000-0000-000000000001";
const KEPT_IMAGE_IDS = [
  "b3000000-0000-0000-0000-000000000002",
  "b3000000-0000-0000-0000-000000000003",
];

const pastJob = {
  id: JOB_ID,
  title: "Gira histórica Madrid",
  start_time: "2024-02-01T17:00:00.000Z",
  end_time: "2024-02-02T01:00:00.000Z",
  tour_date_id: null,
  tour_date: null,
  tour_id: null,
  festival_id: null,
  job_type: "single",
  status: "Confirmado",
  location: {
    id: "location-past-job",
    name: "Sala Histórica",
    formatted_address: "Calle Mayor 1, Madrid",
    latitude: 40.4168,
    longitude: -3.7038,
  },
  job_assignments: [],
};

const buildAggregate = () => ({
  main: {
    id: DOCUMENT_ID,
    document_version: 7,
    status: "draft",
    event_name: "Gira histórica Madrid",
    event_dates: "1 febrero 2024",
    event_start_date: "2024-02-01",
    event_end_date: "2024-02-02",
    venue_name: "Sala Histórica",
    venue_address: "Calle Mayor 1, Madrid",
    venue_latitude: 40.4168,
    venue_longitude: -3.7038,
    restaurants_info: {
      restaurants: [
        {
          id: RESTAURANT_SELECTED_ID,
          name: "Bistro Persistido",
          address: "Calle Uno 1, Madrid",
          rating: 4.4,
          priceLevel: 2,
          isSelected: true,
        },
        {
          id: RESTAURANT_ADDED_ID,
          name: "Bistro por seleccionar",
          address: "Calle Dos 2, Madrid",
          rating: 4.7,
          priceLevel: 3,
          isSelected: false,
        },
      ],
      selectedRestaurants: [RESTAURANT_SELECTED_ID],
    },
    print_excluded_sections: [],
  },
  logistics: {
    loading_details: "Acceso por muelle norte",
    unloading_details: "",
    equipment_logistics: "",
  },
  contacts: [
    {
      id: "b4000000-0000-0000-0000-000000000001",
      name: "Producción Histórica",
      role: "Promotor",
      phone: "+34123456789",
      email: "produccion@example.com",
    },
  ],
  staff: [
    {
      id: "b5000000-0000-0000-0000-000000000001",
      name: "Ana",
      surname1: "Técnica",
      position: "PA",
      dni: "12345678Z",
      department: "sound",
    },
  ],
  transport: [],
  travelArrangements: [],
  accommodations: [],
  images: [
    {
      id: REMOVED_IMAGE_ID,
      image_path: `${JOB_ID}/venue/entrada.jpg`,
      image_type: "venue",
      sort_order: 0,
    },
    {
      id: KEPT_IMAGE_IDS[0],
      image_path: `${JOB_ID}/venue/escenario.jpg`,
      image_type: "venue",
      sort_order: 1,
    },
    {
      id: KEPT_IMAGE_IDS[1],
      image_path: `${JOB_ID}/venue/carga.jpg`,
      image_type: "venue",
      sort_order: 2,
    },
  ],
});

type HojaHarness = {
  calls: SupabaseCallLog;
  storageUploads: string[];
};

const test = base.extend<{ hoja: HojaHarness }>({
  hoja: [async ({ page }, use) => {
    const storageUploads: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      const isObjectWrite = url.pathname.includes("/storage/v1/object/")
        && !url.pathname.includes("/storage/v1/object/sign/")
        && ["POST", "PUT", "PATCH"].includes(request.method());
      if (isObjectWrite) storageUploads.push(`${request.method()} ${url.pathname}`);
    });

    const calls = await bootstrapApp(page, {
      auth: {
        role: "management",
        department: "sound",
      },
      tables: {
        profiles: [
          {
            id: "e2e-user",
            role: "management",
            department: "sound",
            soundvision_access_enabled: false,
            assignable_as_tech: false,
          },
        ],
        jobs: ({ url }) => url.searchParams.has("end_time") ? [] : [pastJob],
        power_requirement_tables: [],
        job_producer_claims: [],
        tours: [],
      },
      rpc: {
        get_hoja_de_ruta: () => buildAggregate(),
        save_hoja_de_ruta: ({ body }) => {
          const expectedVersion = Number(
            (body as { p_expected_version?: unknown } | null)?.p_expected_version ?? 0,
          );
          return {
            id: DOCUMENT_ID,
            document_version: expectedVersion + 1,
          };
        },
        publish_hoja_de_ruta_document: {
          id: DOCUMENT_ID,
        },
      },
    });

    await page.goto(`/hoja-de-ruta?jobId=${JOB_ID}`);
    await expect(page.getByRole("heading", { name: "Hoja de Ruta" })).toBeVisible();
    await expect(page.getByLabel(/Nombre del Evento/)).toHaveValue("Gira histórica Madrid");

    await use({ calls, storageUploads });
  }, { auto: true }],
});

async function selectSection(page: Page, name: string) {
  if (isMobileViewport(page)) {
    await page.getByRole("combobox", { name: "Seleccionar sección" }).click();
    await page.getByRole("option", { name, exact: true }).click();
    return;
  }

  await page.getByRole("tab", { name, exact: true }).click();
}

async function openExportDialog(page: Page) {
  if (isMobileViewport(page)) {
    await page.getByRole("button", { name: "Más acciones" }).click();
  }
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exportar Hoja de Ruta" })).toBeVisible();
}

async function requestEditorExit(page: Page) {
  await page.getByRole("link", { name: "Giras", exact: true }).first().click();
}

test("opens a directly routed historical job on desktop and mobile", async ({ page, hoja }) => {
  await expect(page).toHaveURL(new RegExp(`/hoja-de-ruta\\?jobId=${JOB_ID}$`));
  await expect(page.getByText("Datos guardados cargados")).toBeVisible();
  await expect(page.getByLabel(/Fechas del Evento/)).toHaveValue("1 febrero 2024");
  expect(hoja.calls.rpcCalls.some((call) => call.name === "get_hoja_de_ruta")).toBe(true);
});

test("saves restaurant edits with stable persisted images and explicit removals", async ({
  page,
  hoja,
}) => {
  await selectSection(page, "Restaurantes");

  const restaurantHeading = page.getByRole("heading", { name: "Bistro por seleccionar" });
  const restaurantCheckbox = restaurantHeading.locator("../..").getByRole("checkbox");
  await expect(restaurantCheckbox).not.toBeChecked();
  await restaurantCheckbox.click();
  await expect(restaurantCheckbox).toBeChecked();

  await selectSection(page, "Lugar");
  const firstVenueImage = page.getByRole("img", { name: "Venue 1" });
  await expect(page.locator('img[alt^="Venue "]')).toHaveCount(3);
  await firstVenueImage.locator("..").locator("button").click({ force: true });
  await expect(page.locator('img[alt^="Venue "]')).toHaveCount(2);

  await page.getByRole("button", { name: /Guardar(?: hoja de ruta)?$/ }).click();
  await expect.poll(
    () => hoja.calls.rpcCalls.filter((call) => call.name === "save_hoja_de_ruta").length,
  ).toBe(1);

  const saveCall = hoja.calls.rpcCalls.find((call) => call.name === "save_hoja_de_ruta");
  expect(saveCall).toBeDefined();
  const body = saveCall?.body as {
    p_expected_version: number;
    p_job_id: string;
    p_payload: {
      eventData: {
        restaurants: Array<{ id: string; isSelected: boolean }>;
        selectedRestaurants: string[];
      };
      images: Array<{ id: string; image_path: string; sort_order: number }>;
      removedImageIds: string[];
    };
    p_removed_image_ids: string[];
  };

  expect(body.p_job_id).toBe(JOB_ID);
  expect(body.p_expected_version).toBe(7);
  expect(body.p_payload.eventData.restaurants).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: RESTAURANT_SELECTED_ID, isSelected: true }),
    expect.objectContaining({ id: RESTAURANT_ADDED_ID, isSelected: true }),
  ]));
  expect(body.p_payload.eventData.selectedRestaurants).toEqual([
    RESTAURANT_SELECTED_ID,
    RESTAURANT_ADDED_ID,
  ]);
  expect(body.p_payload.images).toEqual([
    {
      id: KEPT_IMAGE_IDS[0],
      image_path: `${JOB_ID}/venue/escenario.jpg`,
      image_type: "venue",
      sort_order: 0,
    },
    {
      id: KEPT_IMAGE_IDS[1],
      image_path: `${JOB_ID}/venue/carga.jpg`,
      image_type: "venue",
      sort_order: 1,
    },
  ]);
  expect(body.p_payload.removedImageIds).toEqual([REMOVED_IMAGE_ID]);
  expect(body.p_removed_image_ids).toEqual([REMOVED_IMAGE_ID]);
});

test("downloads and previews one section without publishing or uploading", async ({
  page,
  hoja,
}) => {
  await openExportDialog(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Evento", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Hoja de Ruta - Evento - Gira histórica Madrid - .*\.pdf$/);
  expect(hoja.calls.rpcCalls.some((call) => call.name === "publish_hoja_de_ruta_document")).toBe(false);
  expect(hoja.storageUploads).toEqual([]);

  await page.getByRole("button", { name: "Vista previa Evento" }).click();
  await expect(page.getByRole("heading", { name: "Hoja de Ruta - Evento" })).toBeVisible();
  await expect(page.locator('object[aria-label="Hoja de Ruta - Evento"]')).toHaveAttribute(
    "data",
    /^blob:/,
  );
  expect(hoja.calls.rpcCalls.some((call) => call.name === "publish_hoja_de_ruta_document")).toBe(false);
  expect(hoja.storageUploads).toEqual([]);
});

test("blocks navigation while there are unsaved changes", async ({ page }) => {
  test.skip(
    isMobileViewport(page),
    "A direct mobile entry has no prior in-app history; the SPA route guard is covered on desktop.",
  );

  await page.getByLabel(/Nombre del Evento/).fill("Gira histórica editada");

  await requestEditorExit(page);
  await expect(page.getByRole("heading", { name: "Cambios sin guardar" })).toBeVisible();
  await page.getByRole("button", { name: "Seguir editando" }).click();
  await expect(page).toHaveURL(new RegExp(`/hoja-de-ruta\\?jobId=${JOB_ID}$`));
  await expect(page.getByLabel(/Nombre del Evento/)).toHaveValue("Gira histórica editada");

  await requestEditorExit(page);
  await page.getByRole("button", { name: "Descartar cambios" }).click();
  await expect(page).toHaveURL(/\/tours$/);
});

test("keeps DNI masked and requires confirmation before accreditation export", async ({
  page,
}) => {
  await selectSection(page, "Personal");
  const dni = page.getByPlaceholder("DNI");
  await expect(dni).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Mostrar DNI" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  let downloadCount = 0;
  page.on("download", () => {
    downloadCount += 1;
  });
  await openExportDialog(page);
  await page.getByRole("button", { name: "Exportar acreditaciones (XLS)" }).click();
  await expect(page.getByRole("heading", { name: "Exportar datos personales" })).toBeVisible();
  await expect(page.getByText("El archivo incluirá los DNI del personal. ¿Continuar?")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();

  await expect(page.getByRole("heading", { name: "Exportar Hoja de Ruta" })).toBeVisible();
  expect(downloadCount).toBe(0);
});
