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
  home_latitude?: number | null;
  home_longitude?: number | null;
  profile_picture_url?: string | null;
  assignable_as_tech?: boolean | null;
  warehouse_duty_exempt?: boolean | null;
  flex_resource_id?: string | null;
  soundvision_access_enabled?: boolean | null;
  soundvision_tool_access_enabled?: boolean | null;
  autonomo?: boolean | null;
  seasonal_house_tech?: boolean | null;
  seasonal_house_tech_start_date?: string | null;
  seasonal_house_tech_end_date?: string | null;
  bg_color?: string | null;
};
