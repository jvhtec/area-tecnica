-- Enable RLS on push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own push subscriptions
CREATE POLICY "Users can view own push subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own push subscriptions
CREATE POLICY "Users can insert own push subscriptions"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own push subscriptions
CREATE POLICY "Users can update own push subscriptions"
ON public.push_subscriptions
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own push subscriptions
CREATE POLICY "Users can delete own push subscriptions"
ON public.push_subscriptions
FOR DELETE
USING (user_id = auth.uid());

-- Management can manage all push subscriptions
CREATE POLICY "Management can manage all push subscriptions"
ON public.push_subscriptions
FOR ALL
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

-- Enable RLS on dwg_conversion_queue
ALTER TABLE public.dwg_conversion_queue ENABLE ROW LEVEL SECURITY;

-- Management can manage conversion queue
CREATE POLICY "Management can manage conversion queue"
ON public.dwg_conversion_queue
FOR ALL
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));