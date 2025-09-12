import { PDFDocument } from '../core/pdf-document';
import { QRService } from '../services/qr-service';
import { MapService } from '../services/map-service';
import type { Restaurant } from '@/types/hoja-de-ruta';

export class RestaurantsSection {
  constructor(private pdfDoc: PDFDocument) {}

  async addRestaurantsSection(restaurants: Restaurant[], yPosition: number): Promise<number> {
    if (!restaurants || restaurants.length === 0) return yPosition;

    let currentY = yPosition;

    // Section title
    this.pdfDoc.setText(16, [51, 51, 51]);
    this.pdfDoc.addText('RECOMENDACIONES DE RESTAURANTES', 20, currentY);
    currentY += 25;

    // Add separator (using rect instead of line)
    this.pdfDoc.setFillColor(200, 200, 200);
    this.pdfDoc.addRect(20, currentY - 10, 555, 1, 'F');
    currentY += 10;

    // Process restaurants in groups to fit pages
    for (let i = 0; i < restaurants.length; i++) {
      const restaurant = restaurants[i];
      const estimatedHeight = await this.calculateRestaurantHeight(restaurant);
      
      // Check if we need a new page
      if (currentY + estimatedHeight > 750) {
        this.pdfDoc.addPage();
        currentY = 50;
      }

      currentY = await this.addRestaurantCard(restaurant, currentY);
      currentY += 20; // Space between restaurants
    }

    return currentY;
  }

  private async addRestaurantCard(restaurant: Restaurant, yPosition: number): Promise<number> {
    let currentY = yPosition;

    // Restaurant name
    this.pdfDoc.setText(12, [51, 51, 51]);
    this.pdfDoc.addText(restaurant.name, 20, currentY);
    currentY += 18;

    // Rating and price
    const ratingPrice = [];
    if (restaurant.rating) {
      ratingPrice.push(`★ ${restaurant.rating.toFixed(1)}`);
    }
    if (restaurant.priceLevel) {
      ratingPrice.push('€'.repeat(restaurant.priceLevel));
    }
    
    if (ratingPrice.length > 0) {
      this.pdfDoc.setText(10, [100, 100, 100]);
      this.pdfDoc.addText(ratingPrice.join(' • '), 20, currentY);
      currentY += 15;
    }

    // Address
    this.pdfDoc.setText(10, [80, 80, 80]);
    this.pdfDoc.addText(`📍 ${restaurant.address}`, 20, currentY);
    currentY += 15;

    // Cuisine types
    if (restaurant.cuisine && restaurant.cuisine.length > 0) {
      const cuisineText = restaurant.cuisine.slice(0, 3).join(', ');
      this.pdfDoc.setText(9, [120, 120, 120]);
      this.pdfDoc.addText(`Cocina: ${cuisineText}`, 20, currentY);
      currentY += 12;
    }

    // Contact information
    const contactInfo = [];
    if (restaurant.phone) {
      contactInfo.push(`📞 ${restaurant.phone}`);
    }
    if (restaurant.website) {
      contactInfo.push('🌐 Sitio web');
    }

    if (contactInfo.length > 0) {
      this.pdfDoc.setText(9, [80, 80, 80]);
      this.pdfDoc.addText(contactInfo.join(' • '), 20, currentY);
      currentY += 12;
    }

    // Distance (if available)
    if (restaurant.distance) {
      const distanceText = restaurant.distance < 1000 
        ? `${restaurant.distance}m del evento`
        : `${(restaurant.distance / 1000).toFixed(1)}km del evento`;
      
      this.pdfDoc.setText(9, [150, 150, 150]);
      this.pdfDoc.addText(distanceText, 20, currentY);
      currentY += 12;
    }

    // QR Code for directions
    try {
      const qrSize = 40;
      const qrX = 500;
      const qrY = yPosition;

      const destUrl = MapService.generateDestinationUrl(restaurant.address);
      const qrCode = await QRService.generateQRCode(destUrl);
      
      if (qrCode) {
        this.pdfDoc.addImage(qrCode, "PNG", qrX, qrY, qrSize, qrSize);
        
        // Make QR code clickable
        this.pdfDoc.addLink(destUrl, qrX, qrY, qrSize, qrSize);

        // QR caption
        this.pdfDoc.setText(7, [125, 125, 125]);
        this.pdfDoc.addText('Direcciones', qrX, qrY + qrSize + 3);
      }
    } catch (error) {
      console.error('Error generating QR code for restaurant:', error);
    }

    // Add a subtle border around the restaurant card
    const cardHeight = currentY - yPosition + 5;
    this.pdfDoc.setFillColor(240, 240, 240);
    this.pdfDoc.addRect(15, yPosition - 5, 565, cardHeight, 'S');

    return currentY + 5;
  }

  private async calculateRestaurantHeight(restaurant: Restaurant): Promise<number> {
    let height = 18; // Name
    
    if (restaurant.rating || restaurant.priceLevel) height += 15;
    height += 15; // Address
    if (restaurant.cuisine && restaurant.cuisine.length > 0) height += 12;
    if (restaurant.phone || restaurant.website) height += 12;
    if (restaurant.distance) height += 12;
    
    height += 25; // Padding and border
    
    return height;
  }

  // Helper method to check if there's restaurant data
  static hasRestaurantsData(restaurants: Restaurant[]): boolean {
    return restaurants && restaurants.length > 0;
  }
}