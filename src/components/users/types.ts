import { Department } from "@/types/department";

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  phone: string | null;
  department: Department | null;
  dni: string | null;
  residencia: string | null;
};