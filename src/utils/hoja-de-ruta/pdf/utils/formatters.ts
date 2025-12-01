import { format } from 'date-fns';

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
      'sleeper_bus': 'Autobús Cama',
      'train': 'Tren',
      'plane': 'Avión',
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
      'other': 'Otro'
    };
    return map[company] || company;
  }

  static formatTime(time: string): string {
    if (!time) return 'N/A';
    try {
      // If it's an ISO datetime string (contains 'T' or full date), parse it directly
      if (time.includes('T') || time.includes('-')) {
        const date = new Date(time);
        if (!isNaN(date.getTime())) {
          return format(date, 'HH:mm');
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
      // Format as "DD/MM/YYYY HH:mm"
      return format(date, 'dd/MM/yyyy HH:mm');
    } catch {
      return datetime;
    }
  }

  static getStaffName(staffId: string, staffData?: any[]): string {
    if (!staffId || !staffData) return 'Por asignar';
    
    // Check if staffId is a numeric string (array index)
    const numericIndex = parseInt(staffId);
    if (!isNaN(numericIndex) && numericIndex >= 0 && numericIndex < staffData.length) {
      const staff = staffData[numericIndex];
      if (staff) {
        if (staff.profiles) {
          return `${staff.profiles.first_name || ''} ${staff.profiles.last_name || ''}`.trim();
        }
        if (staff.name || staff.surname1) {
          return `${staff.name || ''} ${staff.surname1 || ''} ${staff.surname2 || ''}`.trim();
        }
        if (staff.first_name || staff.last_name) {
          return `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
        }
      }
    }
    
    // Try to find by exact ID match
    let staff = staffData.find(s => s.id === staffId || s.id?.toString() === staffId);
    
    // If not found, try different ID fields
    if (!staff) {
      staff = staffData.find(s => 
        s.user_id === staffId || 
        s.technician_id === staffId ||
        s.staff_id === staffId ||
        s.user_id?.toString() === staffId ||
        s.technician_id?.toString() === staffId ||
        s.staff_id?.toString() === staffId
      );
    }
    
    if (staff) {
      if (staff.profiles) {
        return `${staff.profiles.first_name || ''} ${staff.profiles.last_name || ''}`.trim();
      }
      if (staff.name || staff.surname1) {
        return `${staff.name || ''} ${staff.surname1 || ''} ${staff.surname2 || ''}`.trim();
      }
      if (staff.first_name || staff.last_name) {
        return `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
      }
    }
    
    // If staffId looks like a name, return it as is
    if (typeof staffId === 'string' && /[a-zA-Z]/.test(staffId)) {
      return staffId;
    }
    
    return 'Por asignar';
  }
}
