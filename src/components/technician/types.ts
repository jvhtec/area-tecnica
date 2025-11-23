export interface Theme {
  bg: string;
  nav: string;
  card: string;
  textMain: string;
  textMuted: string;
  accent: string;
  input: string;
  modalOverlay: string;
  divider: string;
  danger: string;
  success: string;
  warning: string;
  cluster: string;
}

export interface JobCardProps {
  job: any;
  theme: Theme;
  isDark: boolean;
  onAction: (action: string, job?: any) => void;
  isCrewChief: boolean;
  techName?: string;
  onOpenObliqueStrategy?: () => void;
}
