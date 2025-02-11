
export type UserRole = 'admin' | 'management' | 'logistics' | 'technician' | 'house_tech';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
  department?: string;  // Added department field
}
