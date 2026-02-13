export type AchievementCategory = 'volume' | 'house' | 'reliability' | 'endurance' | 'diversity' | 'community' | 'hidden';

export interface Achievement {
  id: string;
  code: string;
  title: string;
  description: string;
  hint: string | null;
  category: AchievementCategory;
  evaluation_type: string;
  metric_key: string;
  threshold: number;
  threshold_param: number | null;
  department: string | null;
  role_code: string | null;
  is_hidden: boolean;
  is_active: boolean;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

export interface AchievementProgress {
  id: string;
  user_id: string;
  metric_key: string;
  current_value: number;
  last_evaluated_at: string;
}

export interface AchievementUnlock {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  seen: boolean;
}

export interface AchievementWithStatus extends Achievement {
  unlocked: boolean;
  unlocked_at: string | null;
  seen: boolean | null;
  current_value: number;
}

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  volume: 'Volumen',
  house: 'Técnico de Casa',
  reliability: 'Fiabilidad',
  endurance: 'Resistencia',
  diversity: 'Experiencia',
  community: 'Comunidad',
  hidden: 'Ocultos',
};

export const CATEGORY_ORDER: AchievementCategory[] = [
  'volume',
  'house',
  'reliability',
  'endurance',
  'diversity',
  'community',
  'hidden',
];
