export type UserRole = 'admin' | 'management' | 'logistics' | 'technician';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
}