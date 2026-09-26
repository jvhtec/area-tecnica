import { format } from "date-fns";

import type { EventData } from "@/types/hoja-de-ruta";
import { applyStyle, populateSheet, saveWorkbook } from "@/utils/excelExport";
import { loadExceljs } from "@/utils/lazyExceljs";

type AccreditationExportInput = {
  staff: EventData["staff"];
  jobTitle: string;
};

export const buildAccreditationRows = (staff: EventData["staff"]) => [
  ["ACREDITACIONES - USO INTERNO"],
  ["Contiene datos personales. No publicar ni compartir fuera del proceso de acreditación."],
  [],
  ["Nombre", "Apellidos", "DNI", "Posición", "Departamento"],
  ...staff
    .filter((member) => member.name || member.surname1 || member.dni)
    .map((member) => [
      member.name || "",
      [member.surname1, member.surname2].filter(Boolean).join(" "),
      member.dni || "",
      member.position || "",
      member.department || "",
    ]),
];

export const generateHojaAccreditationXLS = async ({
  staff,
  jobTitle,
}: AccreditationExportInput) => {
  const ExcelJS = await loadExceljs();
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Acreditaciones");
  const rows = buildAccreditationRows(staff);

  populateSheet(worksheet, rows);
  worksheet.mergeCells("A1:E1");
  worksheet.mergeCells("A2:E2");
  applyStyle(worksheet.getCell("A1"), {
    bold: true,
    fontSize: 14,
    bgColor: "9F1239",
    textColor: "FFFFFF",
    alignment: "center",
    borderColor: "9F1239",
  });
  applyStyle(worksheet.getCell("A2"), {
    bold: true,
    bgColor: "FFF7ED",
    textColor: "9A3412",
    borderColor: "FDBA74",
  });
  for (let column = 1; column <= 5; column += 1) {
    applyStyle(worksheet.getRow(4).getCell(column), {
      bold: true,
      bgColor: "34495E",
      textColor: "FFFFFF",
      borderColor: "000000",
    });
  }
  [18, 28, 18, 24, 20].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });

  const safeTitle = jobTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "evento";
  await saveWorkbook(
    workbook,
    `acreditaciones_${safeTitle}_${format(new Date(), "yyyy-MM-dd")}.xlsx`,
  );
};
