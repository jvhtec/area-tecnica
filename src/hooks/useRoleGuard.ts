import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function useRoleGuard(allowed: string[]) {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let role: string | null = (user?.app_metadata as any)?.role || (user?.user_metadata as any)?.role || null;
      // Fallback to profiles.role if not present in JWT metadata
      if (!role && user?.id) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        role = prof?.role ?? null;
      }
      if (!cancelled && (!user || !role || !allowed.includes(role))) {
        navigate('/auth');
      }
    })();
    return () => { cancelled = true; };
  }, [navigate, allowed]);
}
