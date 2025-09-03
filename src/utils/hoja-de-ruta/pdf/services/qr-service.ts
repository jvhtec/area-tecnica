import * as QRCode from 'qrcode';

export class QRService {
  static async generateQRCode(text: string): Promise<string> {
    try {
      return await QRCode.toDataURL(text, {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  }
}