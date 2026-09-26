import * as QRCode from 'qrcode';
import { reportHojaError } from '@/features/hoja-de-ruta/lib/hojaLogger';

export class QRService {
  static async generateQRCode(text: string): Promise<string> {
    try {
      return await QRCode.toDataURL(text, {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
    } catch (error) {
      reportHojaError('pdf.qr.generate', error);
      throw error;
    }
  }
}
