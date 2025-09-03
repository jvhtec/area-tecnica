// Re-export QR utilities from the PDF service for shared use
import { QRService } from './hoja-de-ruta/pdf/services/qr-service';

// Convenience export
export const generateQRCode = (text: string) => QRService.generateQRCode(text);