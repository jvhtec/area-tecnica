import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

type IdFields = {
  id?: string | number | null;
  user_id?: string | number | null;
  technician_id?: string | number | null;
  staff_id?: string | number | null;
};

/** Any staff-like row the Hoja PDFs resolve room occupants against. */
export type StaffNameSource = IdFields & {
  name?: string | null;
  surname1?: string | null;
  surname2?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profiles?: { first_name?: string | null; last_name?: string | null } | null;
};

const staffNameOf = (staff: StaffNameSource | undefined): string => {
  if (!staff) return '';
  if (staff.profiles) {
    return `${staff.profiles.first_name || ''} ${staff.profiles.last_name || ''}`.trim();
  }
  if (staff.name || staff.surname1) {
    return `${staff.name || ''} ${staff.surname1 || ''} ${staff.surname2 || ''}`.trim();
  }
  if (staff.first_name || staff.last_name) {
    return `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
  }
  return '';
};

export class Formatters {
  static formatCurrency(amount: number, currency: string = 'EUR'): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  static formatPhone(phone: string): string {
    if (!phone) return 'N/A';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 9) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  }

  static translateTransportType(type: string | undefined): string {
    if (!type) return 'N/A';
    
    const translations: Record<string, string> = {
      'van': 'Furgoneta',
      'autobus': 'Autobús',
      'bus': 'Autobús',
      'sleeper_bus': 'Autobús Cama',
      'train': 'Tren',
      'plane': 'Avión',
      'rv': 'Autocaravana',
      'RV': 'Autocaravana',
      'own_means': 'Medios propios',
      'trailer': 'Trailer',
      '9m': '9m',
      '8m': '8m',
      '6m': '6m',
      '4m': '4m',
      'furgoneta': 'Furgoneta'
    };
    
    return translations[type] || type;
  }

  static translateCompany(company: string | undefined): string {
    if (!company) return '';
    const map: Record<string, string> = {
      'pantoja': 'Pantoja',
      'transluminaria': 'Transluminaria',
      'transcamarena': 'Transcamarena',
      'wild tour': 'Wild Tour',
      'camionaje': 'Camionaje',
      'sector-pro': 'Sector-Pro',
      'crespo': 'Crespo',
      'montabi_dorado': 'Montabi Dorado',
      'grupo_sese': 'Grupo Sesé',
      'nacex': 'Nacex',
      'montoya': 'Montoya',
      'recogida_cliente': 'Recogida Cliente',
      'other': 'Otro'
    };
    return map[company] || company;
  }

  static formatTime(time: string): string {
    if (!time) return 'N/A';
    try {
      // If it's an ISO datetime string (contains 'T' or full date), parse it directly in Spain time
      if (time.includes('T') || time.includes('-')) {
        const date = new Date(time);
        if (!isNaN(date.getTime())) {
          // Display in Spain time (Europe/Madrid)
          return formatInTimeZone(date, 'Europe/Madrid', 'HH:mm');
        }
      }
      // Otherwise, treat it as a time-only string (legacy format)
      return format(new Date(`2000-01-01T${time}`), 'HH:mm');
    } catch {
      return time;
    }
  }

  static formatDateTime(datetime: string): string {
    if (!datetime) return 'N/A';
    try {
      const date = new Date(datetime);
      if (isNaN(date.getTime())) return datetime;
      // Format as "dd/MM/yy - HH:mm" in Spain time (Europe/Madrid)
      return formatInTimeZone(date, 'Europe/Madrid', 'dd/MM/yy - HH:mm');
    } catch {
      return datetime;
    }
  }

  static getStaffName(staffId: string, staffData?: StaffNameSource[]): string {
    if (!staffId || !staffData) return 'Por asignar';

    // Legacy rooms may store the staff array index instead of an ID.
    const numericIndex = parseInt(staffId);
    if (!isNaN(numericIndex) && numericIndex >= 0 && numericIndex < staffData.length) {
      const indexed = staffNameOf(staffData[numericIndex]);
      if (indexed) return indexed;
    }

    const matches = (value: StaffNameSource[keyof IdFields]) =>
      value !== null && value !== undefined && String(value) === staffId;
    const staff = staffData.find((entry) => matches(entry.id))
      ?? staffData.find((entry) =>
        matches(entry.user_id) || matches(entry.technician_id) || matches(entry.staff_id)
      );

    const found = staffNameOf(staff);
    if (found) return found;

    // If staffId looks like a name, return it as is
    if (/[a-zA-Z]/.test(staffId)) {
      return staffId;
    }

    return 'Por asignar';
  }
}
