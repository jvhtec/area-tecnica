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

  async addVenueSection(
    eventData: EventData,
    venueMapPreview: string | null,
    yPosition: number,
    venueImagePreviews?: string[]
  ): Promise<number> {
    return await this.venueSection.addVenueSection(eventData, venueMapPreview, yPosition, venueImagePreviews);
  }

  async addTravelSection(
    travelArrangements: TravelArrangement[], 
    eventVenueAddress: string | undefined,
    yPosition: number
  ): Promise<number> {
    return await this.travelSection.addTravelSection(travelArrangements, yPosition, eventVenueAddress);
  }

  async addAccommodationSection(
    accommodations: any[], 
    eventData: EventData, 
    yPosition: number,
    suppressRoomTable: boolean = false
  ): Promise<number> {
    return await this.accommodationSection.addAccommodationSection(accommodations, eventData, yPosition, suppressRoomTable);
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

  // Data validation methods
  hasEventDetailsData(eventData: EventData): boolean {
    return !!(eventData.eventName || eventData.clientName || eventData.eventDates || eventData.eventStartTime);
  }

  hasVenueData(eventData: EventData): boolean {
    return !!(eventData.venue?.name || eventData.venue?.address || eventData.venueType);
  }

  hasWeatherData(eventData: EventData): boolean {
    return eventData.weather && eventData.weather.length > 0;
  }

  hasContactsData(eventData: EventData): boolean {
    return eventData.contacts && eventData.contacts.some(contact => 
      contact.name || contact.role || contact.phone || contact.email
    );
  }

  hasStaffData(eventData: EventData): boolean {
    return eventData.staff && eventData.staff.some(staff => 
      staff.name || staff.role || staff.dni
    );
  }

  hasTravelData(travelArrangements: any[]): boolean {
    return travelArrangements && travelArrangements.length > 0;
  }

  hasAccommodationData(accommodations: any[]): boolean {
    return accommodations && accommodations.some(acc => 
      acc.hotel_name || acc.hotel_address
    );
  }

  hasRoomingData(accommodations: any[]): boolean {
    return accommodations && accommodations.some(acc => 
      acc.rooms && acc.rooms.length > 0
    );
  }

  hasLogisticsData(eventData: EventData): boolean {
    return eventData.logistics && eventData.logistics.transport && 
           eventData.logistics.transport.length > 0;
  }

  hasPowerData(eventData: EventData): boolean {
    return eventData.powerRequirements && eventData.powerRequirements.trim().length > 0;
  }

  hasAuxNeedsData(eventData: EventData): boolean {
    return eventData.auxiliaryNeeds && eventData.auxiliaryNeeds.trim().length > 0;
  }

  hasProgramData(eventData: EventData): boolean {
    return eventData.schedule && eventData.schedule.trim().length > 0;
  }
}
