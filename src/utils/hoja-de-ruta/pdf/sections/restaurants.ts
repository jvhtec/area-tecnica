import { PDFDocument } from '../core/pdf-document';
import { QRService } from '../services/qr-service';
import { MapService } from '../services/map-service';
import type { Restaurant } from '@/types/hoja-de-ruta';

export class RestaurantsSection {
  constructor(private pdfDoc: PDFDocument) {}

  async addRestaurantsSection(restaurants: Restaurant[], yPosition: number): Promise<number> {
    if (!restaurants || restaurants.length === 0) return yPosition;

    let currentY = yPosition;

    // Title (no separator line)
    this.pdfDoc.setText(16, [51, 51, 51]);
 
    currentY += 14;

    // Grid layout: 2 columns x 2 rows per page (up to 4 per page)
    const leftMargin = 20;
    const rightMargin = 20;
    const gap = 12;
    const { width: pageWidth, height: pageHeight, footerSpace } = this.pdfDoc.dimensions;
    const availableWidth = pageWidth - leftMargin - rightMargin;
    const cardWidth = Math.floor((availableWidth - gap) / 2);
    const cardHeight = 80; // much shorter cards (~80px) while keeping compact meta

    let rowY = currentY;
    let rowsOnPage = 0;
    for (let i = 0; i < restaurants.length; i += 2) {
      // Enforce max 2 rows per page (up to 4 cards per page)
      if (rowsOnPage === 2 || rowY + cardHeight > pageHeight - footerSpace) {
        this.pdfDoc.addPage();
        rowY = 30; // top margin on continued pages
        rowsOnPage = 0;
      }

      // Left card
      const leftX = leftMargin;
      await this.renderRestaurantCard(restaurants[i], leftX, rowY, cardWidth, cardHeight);

      // Right card (if exists)
      if (i + 1 < restaurants.length) {
        const rightX = leftMargin + cardWidth + gap;
        await this.renderRestaurantCard(restaurants[i + 1], rightX, rowY, cardWidth, cardHeight);
      }

      rowsOnPage += 1;
      rowY += cardHeight + 6; // very tight row gap
    }

    return rowY;
  }

  private async renderRestaurantCard(
    restaurant: Restaurant,
    x: number,
    y: number,
    w: number,
    h: number
  ): Promise<void> {
    // Card border
    this.pdfDoc.document.setDrawColor(220, 220, 220);
    this.pdfDoc.document.setLineWidth(0.4);
    this.pdfDoc.document.rect(x, y, w, h);

    // Map takes the entire card area (with small inset to avoid clipping)
    const inset = 2; // smaller inset for more map area
    const mapX = x + inset;
    const mapY = y + inset;
    const mapW = w - inset * 2;
    const mapH = h - inset * 2;

    // Fetch map image
    let mapDataUrl: string | null = null;
    try {
      if (restaurant.coordinates?.lat && restaurant.coordinates?.lng) {
        mapDataUrl = await MapService.getStaticMapDataUrl(
          restaurant.coordinates.lat,
          restaurant.coordinates.lng,
          mapW,
          mapH,
          15
        );
      }
      if (!mapDataUrl && restaurant.address) {
        mapDataUrl = await MapService.getMapImageForAddress(restaurant.address, mapW, mapH, 15);
      }
    } catch (e) {
      console.warn('Restaurant map fetch failed:', e);
    }

    if (mapDataUrl) {
      try {
        this.pdfDoc.addImage(mapDataUrl, 'PNG', mapX, mapY, mapW, mapH);
      } catch (errPng) {
        try {
          this.pdfDoc.addImage(mapDataUrl, 'JPEG', mapX, mapY, mapW, mapH);
        } catch (err) {
          this.pdfDoc.setText(8, [150, 150, 150]);
          this.pdfDoc.addText('[MAPA NO DISPONIBLE]', mapX + 8, mapY + mapH / 2);
        }
      }
    } else {
      this.pdfDoc.setText(8, [150, 150, 150]);
      this.pdfDoc.addText('[MAPA NO DISPONIBLE]', mapX + 8, mapY + mapH / 2);
    }

    // Compact meta overlay (top-left): name + (rating • price • distance)
    const overlayPad = 2;
    const overlayW = Math.max(60, Math.min(160, w - 20));
    const overlayH = 24; // compact three-line box
    const overlayX = x + 6;
    const overlayY = y + 6;

    // Background box for readability on top of map
    this.pdfDoc.setFillColor(255, 255, 255);
    this.pdfDoc.addRect(overlayX, overlayY, overlayW, overlayH, 'F');
    this.pdfDoc.document.setDrawColor(230, 230, 230);
    this.pdfDoc.document.setLineWidth(0.3);
    this.pdfDoc.document.rect(overlayX, overlayY, overlayW, overlayH);

    // Name with origin label (single line)
    const label = restaurant.originLabel ? `${restaurant.originLabel}: ` : '';
    this.pdfDoc.setText(9, [51, 51, 51]);
    const nameLine = this.pdfDoc.splitText(`${label}${restaurant.name || ''}`, overlayW - overlayPad * 2)[0] || '';
    this.pdfDoc.addText(nameLine, overlayX + overlayPad, overlayY + 7);

    // Address (single truncated line)
    this.pdfDoc.setText(7, [90, 90, 90]);
    const addrLine = this.pdfDoc.splitText(restaurant.address || '', overlayW - overlayPad * 2)[0] || '';
    this.pdfDoc.addText(addrLine, overlayX + overlayPad, overlayY + 14);

    // Meta line
    const meta: string[] = [];
    if (restaurant.rating) meta.push(restaurant.rating.toFixed(1));
    if (restaurant.priceLevel) meta.push('€'.repeat(Math.max(1, Math.min(4, restaurant.priceLevel))));
    if (restaurant.distance) meta.push(restaurant.distance < 1000 ? `${restaurant.distance} m` : `${(restaurant.distance / 1000).toFixed(1)} km`);
    if (meta.length) {
      this.pdfDoc.setText(7, [120, 120, 120]);
      this.pdfDoc.addText(meta.join(' • '), overlayX + overlayPad, overlayY + 21);
    }

    // Overlay QR at bottom-right corner on top of the map
    const qrSize = 18; // smaller QR to fit shorter card
    const margin = 4;
    const qrX = x + w - margin - qrSize;
    const qrY = y + h - margin - qrSize;
    try {
      const destUrl = MapService.generateDestinationUrl(restaurant.address || '');
      const qrData = await QRService.generateQRCode(destUrl);
      this.pdfDoc.addImage(qrData, 'PNG', qrX, qrY, qrSize, qrSize);
      this.pdfDoc.addLink(destUrl, qrX, qrY, qrSize, qrSize);
    } catch (e) {
      // If QR generation fails, draw a small placeholder box
      this.pdfDoc.document.setDrawColor(180, 180, 180);
      this.pdfDoc.document.rect(qrX, qrY, qrSize, qrSize);
    }
  }

  // Helper method to check if there's restaurant data
  static hasRestaurantsData(restaurants: Restaurant[]): boolean {
    return restaurants && restaurants.length > 0;
  }
}
