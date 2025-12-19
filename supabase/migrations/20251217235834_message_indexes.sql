-- =============================================================================
-- TARGETED PERFORMANCE INDEXES (PROD)
-- =============================================================================
-- Focus: chat/message workloads (list + unread counts)
-- =============================================================================

-- Department messages (management inbox): filter by department, order by created_at desc
CREATE INDEX IF NOT EXISTS idx_messages_department_created_at
  ON public.messages (department, created_at DESC);

-- Sent messages (technician inbox): filter by sender_id, order by created_at desc
CREATE INDEX IF NOT EXISTS idx_messages_sender_created_at
  ON public.messages (sender_id, created_at DESC);

-- Direct messages: received list
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_created_at
  ON public.direct_messages (recipient_id, created_at DESC);

-- Direct messages: sent list
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_created_at
  ON public.direct_messages (sender_id, created_at DESC);

-- Unread badge counts (partial indexes)
CREATE INDEX IF NOT EXISTS idx_messages_unread_department
  ON public.messages (department)
  WHERE status = 'unread'::message_status;

CREATE INDEX IF NOT EXISTS idx_messages_unread_sender
  ON public.messages (sender_id)
  WHERE status = 'unread'::message_status;

CREATE INDEX IF NOT EXISTS idx_direct_messages_unread_recipient
  ON public.direct_messages (recipient_id)
  WHERE status = 'unread'::direct_message_status;
