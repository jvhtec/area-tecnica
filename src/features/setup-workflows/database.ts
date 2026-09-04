import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import type { SetupWorkflow, SetupWorkflowTask } from './types';

// Manual additive extension, following the consumos-components precedent.
// Keep generated types.ts untouched until it can be regenerated from the schema.
type ReadOnlyTable<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] };
export type SetupWorkflowDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Functions'> & {
    Tables: Database['public']['Tables'] & {
      setup_workflows: ReadOnlyTable<SetupWorkflow>;
      setup_workflow_tasks: ReadOnlyTable<SetupWorkflowTask>;
    };
    Functions: Database['public']['Functions'] & {
      mutate_setup_workflow: {
        Args: { p_action: string; p_payload: Json; p_workflow_id?: string };
        Returns: SetupWorkflow[];
      };
    };
  };
};

export const workflowClient = supabase as unknown as SupabaseClient<SetupWorkflowDatabase>;
