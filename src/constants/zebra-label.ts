export const ZEBRA_LABEL_TEMPLATE = {
  widthDots: 600,
  heightDots: 400,
  qrModel: 'BQN,2,6',
  font: '0',
  brand: 'Sector Pro',
  footer: 'Reporte QR público',
};

interface BuildParams {
  equipmentName: string;
  url: string;
  barcode: string;
  stencil: string;
}

export const buildZplLabel = ({ equipmentName, url, barcode, stencil }: BuildParams) => {
  const safeName = equipmentName.replace(/[^A-Za-z0-9\s-]/g, '').slice(0, 28);
  const barcodeText = barcode || 'Sin código';
  const stencilText = stencil || 'Sin stencil';

  return `^XA
^PW${ZEBRA_LABEL_TEMPLATE.widthDots}
^LL${ZEBRA_LABEL_TEMPLATE.heightDots}
^CI28
^FO20,20^${ZEBRA_LABEL_TEMPLATE.qrModel}^FDLA,${url}^FS
^FO250,20^A0N,30,30^FD${safeName}^FS
^FO250,70^A0N,24,24^FDBarra: ${barcodeText}^FS
^FO250,110^A0N,24,24^FDStencil: ${stencilText}^FS
^FO250,150^A0N,20,20^FD${ZEBRA_LABEL_TEMPLATE.footer}^FS
^XZ`;
};
