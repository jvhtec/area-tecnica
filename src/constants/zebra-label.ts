export const ZEBRA_LABEL_TEMPLATE = {
  widthMm: 105,
  heightMm: 55,
  dpi: 203,
  qrModel: 'BQN,2,6',
  font: '0',
  brand: 'Sector Pro',
  footer: 'Describe el equipo en el formulario',
};

const mmToDots = (mm: number) => Math.round((mm / 25.4) * ZEBRA_LABEL_TEMPLATE.dpi);

interface BuildParams {
  equipmentName: string;
  url: string;
  detailLine?: string;
  instructionsLine?: string;
}

export const buildZplLabel = ({ equipmentName, url, detailLine, instructionsLine }: BuildParams) => {
  const widthDots = mmToDots(ZEBRA_LABEL_TEMPLATE.widthMm);
  const heightDots = mmToDots(ZEBRA_LABEL_TEMPLATE.heightMm);
  const safeName = equipmentName.replace(/[^A-Za-z0-9\s-]/g, '').slice(0, 36) || 'Equipo';
  const detail = (detailLine || 'Texto libre en el reporte').slice(0, 40);
  const instructions = (instructionsLine || 'Etiqueta 105x55mm').slice(0, 40);

  return `^XA
^PW${widthDots}
^LL${heightDots}
^CI28
^FO30,30^${ZEBRA_LABEL_TEMPLATE.qrModel}^FDLA,${url}^FS
^FO320,10^A0N,20,20^FD${ZEBRA_LABEL_TEMPLATE.brand}^FS
^FO320,40^A0N,34,34^FD${safeName}^FS
^FO320,100^A0N,24,24^FD${detail}^FS
^FO320,150^A0N,22,22^FD${ZEBRA_LABEL_TEMPLATE.footer}^FS
^FO320,190^A0N,20,20^FD${instructions}^FS
^XZ`;
};
