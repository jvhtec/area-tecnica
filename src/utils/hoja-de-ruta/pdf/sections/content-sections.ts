import { PDFDocument } from '../core/pdf-document';
import { EventData, TravelArrangement, Accommodation } from '../core/pdf-types';
import { EventSection } from './event';
import { VenueSection } from './venue';
import { ContactsSection } from './contacts';
import { StaffSection } from './staff';
import { TravelSection } from './travel';
import { AccommodationSection } from './accommodation';
import { ScheduleSection } from './schedule';
import { LogisticsSection } from './logistics';
import { WeatherSection } from './weather';
import { RoomingSection } from './rooming';
import { PowerSection } from './power';
import { AuxNeedsSection } from './aux-needs';
import { ProgramSection } from './program';

export class ContentSections {
  private eventSection: EventSection;
  private venueSection: VenueSection;
  private contactsSection: ContactsSection;
  private staffSection: StaffSection;
  private travelSection: TravelSection;
  private accommodationSection: AccommodationSection;
  private scheduleSection: ScheduleSection;
  private logisticsSection: LogisticsSection;
  private weatherSection: WeatherSection;
  private roomingSection: RoomingSection;
  private powerSection: PowerSection;
  private auxNeedsSection: AuxNeedsSection;
  private programSection: ProgramSection;

  constructor(private pdfDoc: PDFDocument) {
    this.eventSection = new EventSection(pdfDoc);
    this.venueSection = new VenueSection(pdfDoc);
    this.contactsSection = new ContactsSection(pdfDoc);
    this.staffSection = new StaffSection(pdfDoc);
    this.travelSection = new TravelSection(pdfDoc);
    this.accommodationSection = new AccommodationSection(pdfDoc);
    this.scheduleSection = new ScheduleSection(pdfDoc);
    this.logisticsSection = new LogisticsSection(pdfDoc);
    this.weatherSection = new WeatherSection(pdfDoc);
    this.roomingSection = new RoomingSection(pdfDoc);
    this.powerSection = new PowerSection(pdfDoc);
    this.auxNeedsSection = new AuxNeedsSection(pdfDoc);
    this.programSection = new ProgramSection(pdfDoc);
  }

  addContactsSection(eventData: EventData, yPosition: number): number {
    return this.contactsSection.addContactsSection(eventData, yPosition);
  }

  addEventDetailsSection(eventData: EventData, yPosition: number): number {
    return this.eventSection.addEventDetailsSection(eventData, yPosition);
  }

  async addVenueSection(eventData: EventData, venueMapPreview: string | null, yPosition: number): Promise<number> {
    return await this.venueSection.addVenueSection(eventData, venueMapPreview, yPosition);
  }

  async addTravelSection(travelArrangements: TravelArrangement[], yPosition: number): Promise<number> {
    return await this.travelSection.addTravelSection(travelArrangements, yPosition);
  }

  async addAccommodationSection(accommodations: any[], eventData: EventData, yPosition: number): Promise<number> {
    return await this.accommodationSection.addAccommodationSection(accommodations, eventData, yPosition);
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

  addRoomingSection(accommodations: Accommodation[], eventData: EventData, yPosition: number): number {
    return this.roomingSection.addRoomingSection(accommodations, eventData, yPosition);
  }

  addPowerSection(eventData: EventData, yPosition: number): number {
    return this.powerSection.addPowerSection(eventData, yPosition);
  }

  addAuxNeedsSection(eventData: EventData, yPosition: number): number {
    return this.auxNeedsSection.addAuxNeedsSection(eventData, yPosition);
  }

  addProgramSection(eventData: EventData, yPosition: number): number {
    return this.programSection.addProgramSection(eventData, yPosition);
  }
}