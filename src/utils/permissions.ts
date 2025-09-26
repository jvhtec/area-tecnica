export type UserRole = string | null | undefined;

export const isTechnicianRole = (role: UserRole) => role === 'technician' || role === 'house_tech';

export const canViewDetails = (_role: UserRole) => true;

export const canEditJobs = (role: UserRole) => ['admin', 'management', 'logistics'].includes(role || '');

export const canAssignPersonnel = (role: UserRole) => ['admin', 'management', 'logistics'].includes(role || '');

export const canUploadDocuments = (role: UserRole) => ['admin', 'management', 'logistics'].includes(role || '');

export const canDeleteDocuments = (role: UserRole) => ['admin', 'management'].includes(role || '');

export const canCreateFolders = (role: UserRole) => ['admin', 'management', 'logistics'].includes(role || '');

export const canManageFestivalArtists = (role: UserRole) => ['admin', 'management', 'logistics', 'technician', 'house_tech'].includes(role || '');

