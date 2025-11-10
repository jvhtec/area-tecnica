/**
 * Microphone List Transformation Utilities
 *
 * These utilities handle transformation between the database format and the UI format
 * for microphone lists. Since the current schema already uses aggregated quantities,
 * these transformations are minimal but provide a clear abstraction layer.
 */

export interface WiredMic {
  model: string;
  quantity: number;
  exclusive_use?: boolean;
  notes?: string;
}

/**
 * Hydrate microphone data from database format to UI format
 *
 * @param dbData - Raw data from database (could be JSONB string or array)
 * @returns Array of WiredMic objects for UI consumption
 */
export function hydrateFromDB(dbData: any): WiredMic[] {
  // Handle null or undefined
  if (!dbData) {
    return [];
  }

  // Handle JSON string (from some database queries)
  if (typeof dbData === 'string') {
    try {
      dbData = JSON.parse(dbData);
    } catch (e) {
      console.error('Failed to parse microphone data:', e);
      return [];
    }
  }

  // Handle empty array
  if (!Array.isArray(dbData) || dbData.length === 0) {
    return [];
  }

  // Validate and normalize data
  return dbData
    .filter(mic => mic && typeof mic === 'object' && mic.model)
    .map(mic => ({
      model: String(mic.model),
      quantity: typeof mic.quantity === 'number' && mic.quantity > 0 ? mic.quantity : 1,
      exclusive_use: Boolean(mic.exclusive_use),
      notes: mic.notes ? String(mic.notes) : undefined,
    }));
}

/**
 * Dehydrate microphone data from UI format to database format
 *
 * @param micList - Array of WiredMic objects from UI
 * @returns Data ready for database storage (as array, will be converted to JSONB by Supabase)
 */
export function dehydrateForDB(micList: WiredMic[]): WiredMic[] {
  // Handle empty or invalid input
  if (!Array.isArray(micList) || micList.length === 0) {
    return [];
  }

  // Clean and validate data for storage
  return micList
    .filter(mic => mic && mic.model && mic.quantity > 0)
    .map(mic => {
      const cleaned: WiredMic = {
        model: mic.model,
        quantity: mic.quantity,
      };

      // Only include optional fields if they have meaningful values
      if (mic.exclusive_use) {
        cleaned.exclusive_use = true;
      }

      if (mic.notes && mic.notes.trim()) {
        cleaned.notes = mic.notes.trim();
      }

      return cleaned;
    });
}

/**
 * Sanitize microphone list for database submission
 * Alias for dehydrateForDB for backward compatibility with existing code
 *
 * @param micList - Array of WiredMic objects
 * @returns Sanitized array ready for database
 */
export function sanitizeWiredMics(micList: WiredMic[]): WiredMic[] {
  return dehydrateForDB(micList);
}

/**
 * Merge multiple microphone lists, combining quantities for duplicate models
 * Useful for calculating peak requirements across multiple artists
 *
 * @param micLists - Multiple microphone lists to merge
 * @returns Merged list with combined quantities
 */
export function mergeMicLists(...micLists: WiredMic[][]): WiredMic[] {
  const merged: Record<string, WiredMic> = {};

  micLists.forEach(list => {
    if (!Array.isArray(list)) return;

    list.forEach(mic => {
      if (!mic || !mic.model) return;

      if (merged[mic.model]) {
        merged[mic.model].quantity += mic.quantity;
        // If any instance requires exclusive use, mark as exclusive
        if (mic.exclusive_use) {
          merged[mic.model].exclusive_use = true;
        }
        // Concatenate notes if multiple
        if (mic.notes && merged[mic.model].notes) {
          merged[mic.model].notes += `; ${mic.notes}`;
        } else if (mic.notes) {
          merged[mic.model].notes = mic.notes;
        }
      } else {
        merged[mic.model] = { ...mic };
      }
    });
  });

  return Object.values(merged).sort((a, b) => a.model.localeCompare(b.model));
}

/**
 * Calculate total count of microphones in a list
 *
 * @param micList - Array of WiredMic objects
 * @returns Total quantity across all models
 */
export function getTotalMicCount(micList: WiredMic[]): number {
  if (!Array.isArray(micList)) return 0;
  return micList.reduce((sum, mic) => sum + (mic.quantity || 0), 0);
}

/**
 * Validate microphone list data structure
 *
 * @param data - Data to validate
 * @returns Validation result with errors if any
 */
export function validateMicList(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data) {
    return { valid: true, errors: [] }; // Empty is valid
  }

  if (!Array.isArray(data)) {
    errors.push('Microphone list must be an array');
    return { valid: false, errors };
  }

  data.forEach((mic, index) => {
    if (!mic || typeof mic !== 'object') {
      errors.push(`Item at index ${index} is not a valid object`);
      return;
    }

    if (!mic.model || typeof mic.model !== 'string') {
      errors.push(`Item at index ${index} is missing or has invalid model name`);
    }

    if (typeof mic.quantity !== 'number' || mic.quantity < 1) {
      errors.push(`Item at index ${index} has invalid quantity (must be >= 1)`);
    }

    if (mic.exclusive_use !== undefined && typeof mic.exclusive_use !== 'boolean') {
      errors.push(`Item at index ${index} has invalid exclusive_use value (must be boolean)`);
    }

    if (mic.notes !== undefined && typeof mic.notes !== 'string') {
      errors.push(`Item at index ${index} has invalid notes value (must be string)`);
    }
  });

  return { valid: errors.length === 0, errors };
}
