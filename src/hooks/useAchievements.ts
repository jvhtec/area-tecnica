import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import type {
  Achievement,
  AchievementProgress,
  AchievementUnlock,
  AchievementWithStatus,
} from '@/types/achievements';

const ACHIEVEMENTS_KEY = ['achievements'] as const;

function achievementsQueryKey(userId: string | undefined) {
  return [...ACHIEVEMENTS_KEY, userId] as const;
}

function unseenQueryKey(userId: string | undefined) {
  return [...ACHIEVEMENTS_KEY, 'unseen', userId] as const;
}

/**
 * Fetch all achievements merged with user progress and unlock status.
 * Optionally pass a targetUserId for managers viewing another user's achievements.
 */
export function useAchievements(targetUserId?: string) {
  const { user } = useOptimizedAuth();
  const userId = targetUserId || user?.id;

  return useQuery({
    queryKey: achievementsQueryKey(userId),
    queryFn: async (): Promise<AchievementWithStatus[]> => {
      if (!userId) return [];

      // Fetch all three datasets in parallel
      const [achievementsRes, progressRes, unlocksRes] = await Promise.all([
        supabase
          .from('achievements')
          .select('*')
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('achievement_progress')
          .select('*')
          .eq('user_id', userId),
        supabase
          .from('achievement_unlocks')
          .select('*')
          .eq('user_id', userId),
      ]);

      const achievements = (achievementsRes.data || []) as Achievement[];
      const progress = (progressRes.data || []) as AchievementProgress[];
      const unlocks = (unlocksRes.data || []) as AchievementUnlock[];

      // Build lookup maps
      const progressMap = new Map(progress.map((p) => [p.metric_key, p.current_value]));
      const unlockMap = new Map(unlocks.map((u) => [u.achievement_id, u]));

      return achievements.map((a): AchievementWithStatus => {
        const unlock = unlockMap.get(a.id);
        return {
          ...a,
          unlocked: !!unlock,
          unlocked_at: unlock?.unlocked_at ?? null,
          seen: unlock?.seen ?? null,
          current_value: progressMap.get(a.metric_key) ?? 0,
        };
      });
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch only unseen achievement unlocks for the current user (for the banner).
 */
export function useUnseenAchievements() {
  const { user, userRole } = useOptimizedAuth();
  const isTech = userRole === 'technician' || userRole === 'house_tech';

  return useQuery({
    queryKey: unseenQueryKey(user?.id),
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: unlocks } = await supabase
        .from('achievement_unlocks')
        .select('*, achievements(*)')
        .eq('user_id', user.id)
        .eq('seen', false)
        .order('unlocked_at', { ascending: true })
        .limit(1);

      if (!unlocks || unlocks.length === 0) return [];

      return unlocks.map((u) => ({
        unlockId: u.id,
        achievement: u.achievements as unknown as Achievement,
        unlocked_at: u.unlocked_at,
      }));
    },
    enabled: !!user?.id && isTech,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Mark an achievement unlock as seen.
 */
export function useMarkAchievementSeen() {
  const queryClient = useQueryClient();
  const { user } = useOptimizedAuth();

  return useMutation({
    mutationFn: async (unlockId: string) => {
      const { error } = await supabase
        .from('achievement_unlocks')
        .update({ seen: true })
        .eq('id', unlockId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: unseenQueryKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: achievementsQueryKey(user?.id) });
    },
  });
}

/**
 * Manually award an achievement to a user (admin/management only).
 */
export function useManuallyAwardAchievement() {
  const queryClient = useQueryClient();
  const { user } = useOptimizedAuth();

  return useMutation({
    mutationFn: async ({
      userId,
      achievementId,
    }: {
      userId: string;
      achievementId: string;
    }) => {
      if (!user?.id) {
        throw new Error('You must be logged in to award achievements');
      }

      // Note: Function derives caller from auth.uid(), no need to pass p_awarded_by
      const { data, error } = await supabase.rpc('manually_award_achievement', {
        p_user_id: userId,
        p_achievement_id: achievementId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to award achievement');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: achievementsQueryKey(variables.userId),
      });
      queryClient.invalidateQueries({
        queryKey: unseenQueryKey(variables.userId),
      });
    },
  });
}
