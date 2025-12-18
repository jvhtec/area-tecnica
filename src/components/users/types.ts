import { Department } from "@/types/department";

export type Profile = {
  id: string;
  first_name: string | null;
  nickname: string | null;
  last_name: string | null;
  email: string;
  role: string;
  phone: string | null;
  department: Department | null;
  dni: string | null;
  residencia: string | null;
  profile_picture_url?: string | null;
  assignable_as_tech?: boolean | null;
  flex_resource_id?: string | null;
  soundvision_access_enabled?: boolean | null;
  autonomo?: boolean | null;
};
