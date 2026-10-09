import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isPublishableStatus, manifestReportUrl, manifestStatusId } from "./manifest.ts";

Deno.test("only Preparado and Enviado are publishable", () => {
  assertEquals(isPublishableStatus("70b2de6c-aee8-11df-b8d5-00e08175e43e"), true);
  assertEquals(isPublishableStatus("4dc8c4ec-aee9-11df-b8d5-00e08175e43e"), true);
  for (const status of [
    "8943b49a-96d2-43f6-be0b-874e1788b674",
    "b99550ec-aee8-11df-b8d5-00e08175e43e",
    "359bdd40-e417-11eb-87a1-f23c925290b3",
    "576e8460-400d-11e3-862a-0025907c6802",
    null, undefined, "Preparado",
  ]) assertEquals(isPublishableStatus(status), false);
});

Deno.test("manifest status parser fails closed", () => {
  assertEquals(manifestStatusId({ statusId: "70b2de6c-aee8-11df-b8d5-00e08175e43e" }),
    "70b2de6c-aee8-11df-b8d5-00e08175e43e");
  assertEquals(manifestStatusId({ status: { id: "4dc8c4ec-aee9-11df-b8d5-00e08175e43e" } }),
    "4dc8c4ec-aee9-11df-b8d5-00e08175e43e");
  assertEquals(manifestStatusId({ unrelated: { statusId: "70b2de6c-aee8-11df-b8d5-00e08175e43e" } }), null);
  assertEquals(manifestStatusId({ status: "Preparado" }), null);
});

Deno.test("report uses manifest id and ELEMENT_VIEW_ID", () => {
  const id = "7eb9fcfa-53f0-4e42-accd-c6af89ce70f4";
  const url = new URL(manifestReportUrl(id));
  assertEquals(url.searchParams.get("PROJECT_ELEMENT_ID"), id);
  assertEquals(url.searchParams.get("ELEMENT_VIEW_ID"), "54110f73-c28a-11f1-bdc7-02e7c1b689d7");
  assertEquals(url.searchParams.get("PROJECT_ELEMENT_DEFINITION_ID"), "9945d54c-af32-11df-b8d5-00e08175e43e");
  assertThrows(() => manifestReportUrl("../another-job"));
});
