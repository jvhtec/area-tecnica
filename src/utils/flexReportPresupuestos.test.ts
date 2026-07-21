import { describe, expect, it } from "vitest";

import { FLEX_FOLDER_IDS } from "@/utils/flex-folders/constants";
import type { FlexElementNode } from "@/utils/flex-folders/getElementTree";
import {
  getFlexPresupuestoOptions,
  getFlexReportRootElementId,
} from "@/utils/flexReportPresupuestos";

describe("Flex report presupuesto discovery", () => {
  it("finds every presupuesto in the tree and inherits its tracked department", () => {
    const tree: FlexElementNode[] = [{
      elementId: "job-root",
      displayName: "Trabajo",
      children: [{
        elementId: "sound-folder",
        displayName: "Sonido",
        definitionId: FLEX_FOLDER_IDS.subFolder,
        children: [{
          elementId: "quote-main",
          displayName: "Presupuesto principal",
          documentNumber: "Q-100",
          definitionId: FLEX_FOLDER_IDS.presupuesto,
        }, {
          elementId: "stage-extra",
          displayName: "Escenario B",
          definitionId: FLEX_FOLDER_IDS.subFolder,
          children: [{
            elementId: "quote-extra",
            displayName: "Extra escenario B",
            documentNumber: "Q-101",
            definitionId: FLEX_FOLDER_IDS.presupuesto,
          }],
        }],
      }, {
        elementId: "lights-folder",
        displayName: "Luces",
        definitionId: FLEX_FOLDER_IDS.subFolder,
        children: [{
          elementId: "quote-lights",
          displayName: "Presupuesto iluminación",
          definitionId: FLEX_FOLDER_IDS.presupuestoDryHire,
        }],
      }],
    }];

    expect(getFlexPresupuestoOptions(tree, [
      { element_id: "job-root", department: "production", folder_type: "main_event" },
      { element_id: "sound-folder", department: "sound", folder_type: "department" },
    ])).toEqual([
      expect.objectContaining({ elementId: "quote-main", department: "sound", documentNumber: "Q-100" }),
      expect.objectContaining({ elementId: "quote-extra", department: "sound", documentNumber: "Q-101" }),
      expect.objectContaining({ elementId: "quote-lights", department: "lights" }),
    ]);
  });

  it("excludes containers and pull sheets, deduplicates tracked rows, and keeps tracked fallbacks", () => {
    const tree: FlexElementNode[] = [{
      elementId: "container",
      displayName: "Presupuestos Recibidos",
      definitionId: FLEX_FOLDER_IDS.presupuestosRecibidos,
      children: [{
        elementId: "tracked-quote",
        displayName: "Presupuesto desde Flex",
        definitionId: FLEX_FOLDER_IDS.presupuesto,
      }, {
        elementId: "pull-sheet",
        displayName: "Lista material",
        definitionId: FLEX_FOLDER_IDS.pullSheet,
      }],
    }];

    const options = getFlexPresupuestoOptions(tree, [{
      element_id: "tracked-quote",
      department: "sound",
      folder_type: "comercial_presupuesto",
    }, {
      element_id: "db-only-quote",
      department: "lights",
      folder_type: "dryhire_presupuesto",
    }]);

    expect(options).toHaveLength(2);
    expect(options.map((option) => option.elementId)).toEqual([
      "tracked-quote",
      "db-only-quote",
    ]);
    expect(options[0]).toMatchObject({ displayName: "Presupuesto desde Flex", department: "sound" });
  });

  it("uses the closest supported job root", () => {
    expect(getFlexReportRootElementId([
      { element_id: "quote", folder_type: "comercial_presupuesto" },
      { element_id: "dryhire-root", folder_type: "dryhire" },
      { element_id: "main-root", folder_type: "main_event" },
    ])).toBe("main-root");
  });
});
