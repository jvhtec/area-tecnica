import { PDFDocument } from '../core/pdf-document';
import { EventData, TravelArrangement, Accommodation } from '../core/pdf-types';
import { EventSection } from './event';
import { VenueSection } from './venue';
import { ContactsSection } from './contacts';
import { StaffSection } from './staff';
import { AccommodationSection } from './accommodation';
import { TravelSection } from './travel';
import { ScheduleSection } from './schedule';
import { LogisticsSection } from './logistics';
import { WeatherSection } from './weather';

export class ContentSections {
  private eventSection: EventSection;
  private venueSection: VenueSection;
  private contactsSection: ContactsSection;
  private staffSection: StaffSection;
  private accommodationSection: AccommodationSection;
  private travelSection: TravelSection;
  private scheduleSection: ScheduleSection;
  private logisticsSection: LogisticsSection;
  private weatherSection: WeatherSection;

  constructor(private pdfDoc: PDFDocument) {
    this.eventSection = new EventSection(pdfDoc);
    this.venueSection = new VenueSection(pdfDoc);
    this.contactsSection = new ContactsSection(pdfDoc);
    this.staffSection = new StaffSection(pdfDoc);
    this.accommodationSection = new AccommodationSection(pdfDoc);
    this.travelSection = new TravelSection(pdfDoc);
    this.scheduleSection = new ScheduleSection(pdfDoc);
    this.logisticsSection = new LogisticsSection(pdfDoc);
    this.weatherSection = new WeatherSection(pdfDoc);
  }

  addContactsSection(eventData: EventData, yPosition: number): number {
    return this.contactsSection.addContactsSection(eventData, yPosition);
  }

  addEventDetailsSection(eventData: EventData, yPosition: number): number {
    return this.eventSection.addEventDetailsSection(eventData, yPosition);
  }

  addVenueSection(eventData: EventData, venueMapPreview: string | null, yPosition: number): number {
    return this.venueSection.addVenueSection(eventData, venueMapPreview, yPosition);
  }

  async addTravelSection(travelArrangements: TravelArrangement[], yPosition: number): Promise<number> {
    return await this.travelSection.addTravelSection(travelArrangements, yPosition);
  }

  addAccommodationSection(accommodations: Accommodation[], eventData: EventData, yPosition: number): number {
    return this.accommodationSection.addAccommodationSection(accommodations, eventData, yPosition);
  }

  addStaffSection(eventData: EventData, yPosition: number): number {
    return this.staffSection.addStaffSection(eventData, yPosition);
  }

  addScheduleSection(eventData: EventData, yPosition: number): number {
    return this.scheduleSection.addScheduleSection(eventData, yPosition);
  }

  addLogisticsSection(eventData: EventData, yPosition: number): number {
    return this.logisticsSection.addLogisticsSection(eventData, yPosition);
  }

  addWeatherSection(eventData: EventData, yPosition: number): number {
    return this.weatherSection.addWeatherSection(eventData, yPosition);
  }
}