/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Calendar } from "lucide-react";

export interface TourManagementProps {
  tour: any;
  tourJobId?: string | null;
}

export type QuickAction = {
  id?: string;
  title: string;
  description: string;
  icon: typeof Calendar;
  onClick: () => void;
  badge: string;
  viewOnly?: boolean;
  showForTechnician?: boolean;
  hasAutoSync?: boolean;
  disabled?: boolean;
};
