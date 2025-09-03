import { TravelArrangement, RoomAssignment } from '../core/pdf-types';

export class DataValidators {
  static hasData(value: any): boolean {
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0 && value.some(item => this.hasData(item));
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(val => this.hasData(val));
    }
    return value !== null && value !== undefined;
  }

  static hasMeaningfulTravelData(arrangement: TravelArrangement): boolean {
    return !!(
      arrangement.transportation_type?.trim() ||
      arrangement.pickup_address?.trim() ||
      arrangement.pickup_time?.trim() ||
      arrangement.departure_time?.trim() ||
      arrangement.arrival_time?.trim() ||
      arrangement.flight_train_number?.trim() ||
      arrangement.company?.trim() ||
      arrangement.driver_name?.trim() ||
      arrangement.driver_phone?.trim() ||
      arrangement.plate_number?.trim() ||
      arrangement.notes?.trim()
    );
  }

  static hasMeaningfulRoomData(room: RoomAssignment): boolean {
    return !!(room.room_type?.trim() && (
      room.room_number?.trim() ||
      room.staff_member1_id?.trim() ||
      room.staff_member2_id?.trim()
    ));
  }
}