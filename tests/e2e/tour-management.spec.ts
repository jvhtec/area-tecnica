import { formatISO, addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { expect, test } from "@playwright/test";

import { bootstrapApp } from "./support/app";

const MADRID_TIMEZONE = "Europe/Madrid";

const makeFutureDate = (offsetDays: number) => {
  const madridToday = formatInTimeZone(new Date(), MADRID_TIMEZONE, "yyyy-MM-dd");
  const madridTodayAtNoon = fromZonedTime(`${madridToday}T12:00:00`, MADRID_TIMEZONE);
  return addDays(madridTodayAtNoon, offsetDays);
};

const toDateOnly = (date: Date) => formatInTimeZone(date, MADRID_TIMEZONE, "yyyy-MM-dd");

const toUtcIsoAtHour = (date: Date, hour: number) =>
  formatISO(fromZonedTime(`${toDateOnly(date)}T${String(hour).padStart(2, "0")}:00:00`, MADRID_TIMEZONE));

const smokeTourStart = makeFutureDate(7);
const smokeTourDate = makeFutureDate(14);
const smokeTourEnd = makeFutureDate(20);
const smokeTourYear = formatInTimeZone(smokeTourStart, MADRID_TIMEZONE, "yyyy");

const smokeTour = {
  id: "tour-1",
  name: "World Tour",
  description: "Arena run",
  color: "#2563eb",
  start_date: toDateOnly(smokeTourStart),
  end_date: toDateOnly(smokeTourEnd),
  tour_dates: [
    {
      id: "tour-date-1",
      date: toUtcIsoAtHour(smokeTourDate, 20),
      location: { id: "loc-1", name: "Madrid Arena" },
    },
  ],
};

test.describe("tour management smoke", () => {
  test("loads the management overview and opens the WhatsApp dialog", async ({ page }) => {
    await bootstrapApp(page, {
      auth: {
        role: "management",
        department: "sound",
      },
      tables: {
        profiles: [
          {
            role: "management",
            department: "sound",
            soundvision_access_enabled: false,
            assignable_as_tech: false,
          },
        ],
        tours: [smokeTour],
        jobs: [
          {
            id: "tour-job-1",
            tour_id: "tour-1",
            job_type: "tour",
          },
        ],
        job_whatsapp_groups: [],
        job_whatsapp_group_requests: [],
      },
    });

    await page.goto("/tour-management/tour-1");

    await expect(page.getByRole("heading", { name: "World Tour" })).toBeVisible();
    await expect(page.getByText("Áreas de Gestión")).toBeVisible();
    await page.getByRole("button", { name: /grupo whatsapp/i }).click();
    await expect(page.getByRole("heading", { name: /crear grupo de whatsapp/i })).toBeVisible();
  });

  test("keeps house-tech users in the read-only tours route", async ({ page }) => {
    await bootstrapApp(page, {
      auth: {
        role: "house_tech",
        department: "sound",
      },
      tables: {
        profiles: [
          {
            role: "house_tech",
            department: "sound",
            tours_expanded: true,
            soundvision_access_enabled: false,
            assignable_as_tech: false,
          },
        ],
        tours: [
          {
            id: "tour-1",
            name: "World Tour",
            start_date: toDateOnly(smokeTourStart),
            end_date: toDateOnly(smokeTourEnd),
          },
        ],
      },
    });

    await page.goto("/tours");

    await expect(page.getByText(new RegExp(`tours ${smokeTourYear}`, "i"))).toBeVisible();
    await page.getByRole("heading", { name: "World Tour" }).click();
    await expect(page).toHaveURL(/\/tours$/);
  });
});
