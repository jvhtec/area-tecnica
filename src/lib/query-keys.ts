
/**
 * React Query key factory for consistent cache management
 */

// Base keys for entity types
export const baseKeys = {
  jobs: ['jobs'],
  tours: ['tours'],
  availability: ['availability'],
  profiles: ['profiles'],
  messages: ['messages'],
  directMessages: ['direct-messages'],
  equipment: ['equipment'],
  jobDocuments: ['job-documents'],
  jobDateTypes: ['job-date-types'],
  jobAssignments: ['job-assignments'],
  presets: ['presets'],
  locations: ['locations'],
  festivalArtists: ['festival-artists'],
  festivalShifts: ['festival-shifts'],
  logisticsEvents: ['logistics-events'],
};

// Common filters
export type CommonFilters = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string | Date;
  endDate?: string | Date;
};

// Factory functions for entities
export const jobsKeys = {
  all: () => [...baseKeys.jobs],
  lists: () => [...baseKeys.jobs, 'list'],
  list: (filters?: CommonFilters) => [...jobsKeys.lists(), { ...filters }],
  details: () => [...baseKeys.jobs, 'detail'],
  detail: (id: string) => [...jobsKeys.details(), id],
  dateTypes: (jobId: string) => [...baseKeys.jobDateTypes, jobId],
  assignments: (jobId: string) => [...baseKeys.jobAssignments, jobId],
  documents: (jobId: string) => [...baseKeys.jobDocuments, jobId],
  calendar: (department?: string) => [...baseKeys.jobs, 'calendar', department],
};

export const toursKeys = {
  all: () => [...baseKeys.tours],
  lists: () => [...baseKeys.tours, 'list'],
  list: (filters?: CommonFilters) => [...toursKeys.lists(), { ...filters }],
  details: () => [...baseKeys.tours, 'detail'],
  detail: (id: string) => [...toursKeys.details(), id],
  dates: (tourId: string) => [...toursKeys.detail(tourId), 'dates'],
};

export const messagesKeys = {
  all: () => [...baseKeys.messages],
  list: (department?: string) => [...baseKeys.messages, 'list', department],
  direct: () => [...baseKeys.directMessages],
  conversation: (userId: string) => [...messagesKeys.direct(), userId],
};

export const availabilityKeys = {
  all: () => [...baseKeys.availability],
  user: (userId: string) => [...baseKeys.availability, userId],
  department: (userId: string, department: string) => [...availabilityKeys.user(userId), department],
  date: (userId: string, date: string) => [...availabilityKeys.user(userId), date],
};

export const profilesKeys = {
  all: () => [...baseKeys.profiles],
  lists: () => [...baseKeys.profiles, 'list'],
  list: (filters?: CommonFilters) => [...profilesKeys.lists(), { ...filters }],
  details: () => [...baseKeys.profiles, 'detail'],
  detail: (id: string) => [...profilesKeys.details(), id],
  technicians: () => [...baseKeys.profiles, 'technicians'],
};

export const equipmentKeys = {
  all: () => [...baseKeys.equipment],
  lists: () => [...baseKeys.equipment, 'list'],
  list: (filters?: { category?: string }) => [...equipmentKeys.lists(), { ...filters }],
  details: () => [...baseKeys.equipment, 'detail'],
  detail: (id: string) => [...equipmentKeys.details(), id],
  stock: () => [...baseKeys.equipment, 'stock'],
};

export const presetsKeys = {
  all: () => [...baseKeys.presets],
  lists: () => [...baseKeys.presets, 'list'],
  list: (userId: string) => [...presetsKeys.lists(), userId],
  details: () => [...baseKeys.presets, 'detail'],
  detail: (id: string) => [...presetsKeys.details(), id],
  items: (presetId: string) => [...presetsKeys.detail(presetId), 'items'],
  assignments: (userId: string) => [...baseKeys.presets, 'assignments', userId],
  date: (userId: string, date: string) => [...presetsKeys.assignments(userId), date],
};

export const festivalKeys = {
  artists: (jobId: string) => [...baseKeys.festivalArtists, jobId],
  shifts: (jobId: string) => [...baseKeys.festivalShifts, jobId],
  shift: (jobId: string, date: string) => [...festivalKeys.shifts(jobId), date],
};

export const locationsKeys = {
  all: () => [...baseKeys.locations],
  details: () => [...baseKeys.locations, 'detail'],
  detail: (id: string) => [...locationsKeys.details(), id],
};

export const logisticsKeys = {
  events: (jobId: string) => [...baseKeys.logisticsEvents, jobId],
  event: (eventId: string) => [...baseKeys.logisticsEvents, 'detail', eventId],
};
