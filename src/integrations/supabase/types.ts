export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      achievement_progress: {
        Row: {
          current_value: number | null
          id: string
          last_evaluated_at: string | null
          metric_key: string
          user_id: string
        }
        Insert: {
          current_value?: number | null
          id?: string
          last_evaluated_at?: string | null
          metric_key: string
          user_id: string
        }
        Update: {
          current_value?: number | null
          id?: string
          last_evaluated_at?: string | null
          metric_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievement_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievement_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      achievement_unlocks: {
        Row: {
          achievement_id: string
          id: string
          seen: boolean | null
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          seen?: boolean | null
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          seen?: boolean | null
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievement_unlocks_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievement_unlocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievement_unlocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      achievements: {
        Row: {
          category: string
          code: string
          created_at: string | null
          department: string | null
          description: string
          evaluation_type: string
          hint: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_hidden: boolean | null
          metric_key: string
          role_code: string | null
          sort_order: number | null
          threshold: number
          threshold_param: number | null
          title: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          department?: string | null
          description: string
          evaluation_type: string
          hint?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_hidden?: boolean | null
          metric_key: string
          role_code?: string | null
          sort_order?: number | null
          threshold: number
          threshold_param?: number | null
          title: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          department?: string | null
          description?: string
          evaluation_type?: string
          hint?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_hidden?: boolean | null
          metric_key?: string
          role_code?: string | null
          sort_order?: number | null
          threshold?: number
          threshold_param?: number | null
          title?: string
        }
        Relationships: []
      }
      activity_catalog: {
        Row: {
          code: string
          created_at: string
          default_visibility: Database["public"]["Enums"]["activity_visibility"]
          label: string
          severity: string
          template: string | null
          toast_enabled: boolean
        }
        Insert: {
          code: string
          created_at?: string
          default_visibility: Database["public"]["Enums"]["activity_visibility"]
          label: string
          severity?: string
          template?: string | null
          toast_enabled?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          default_visibility?: Database["public"]["Enums"]["activity_visibility"]
          label?: string
          severity?: string
          template?: string | null
          toast_enabled?: boolean
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          actor_id: string
          actor_name: string | null
          code: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          job_id: string | null
          payload: Json | null
          visibility: Database["public"]["Enums"]["activity_visibility"]
        }
        Insert: {
          actor_id: string
          actor_name?: string | null
          code: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          job_id?: string | null
          payload?: Json | null
          visibility: Database["public"]["Enums"]["activity_visibility"]
        }
        Update: {
          actor_id?: string
          actor_name?: string | null
          code?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          job_id?: string | null
          payload?: Json | null
          visibility?: Database["public"]["Enums"]["activity_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "activity_catalog"
            referencedColumns: ["code"]
          },
        ]
      }
      activity_prefs: {
        Row: {
          created_at: string
          mute_toasts: boolean | null
          muted_codes: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          mute_toasts?: boolean | null
          muted_codes?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          mute_toasts?: boolean | null
          muted_codes?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_reads: {
        Row: {
          activity_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_reads_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity_log"
            referencedColumns: ["id"]
          },
        ]
      }
      administrative_job_tasks: {
        Row: {
          assigned_department: string | null
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          completion_source: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          job_id: string | null
          priority: number | null
          progress: number | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          tour_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_department?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_source?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          job_id?: string | null
          priority?: number | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_department?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_source?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          job_id?: string | null
          priority?: number | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type?: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "administrative_job_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administrative_job_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administrative_job_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administrative_job_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administrative_job_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administrative_job_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administrative_job_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administrative_job_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "administrative_job_tasks_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          active: boolean
          created_at: string | null
          created_by: string | null
          id: string
          level: string
          message: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          created_by?: string | null
          id?: string
          level?: string
          message: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          created_by?: string | null
          id?: string
          level?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_changelog: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          last_updated: string
          version: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          last_updated?: string
          version: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          last_updated?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_changelog_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_changelog_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          assignment_id: string | null
          created_at: string | null
          deleted_timesheet_count: number | null
          id: string
          job_id: string
          metadata: Json | null
          new_status: string | null
          previous_status: string | null
          technician_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          assignment_id?: string | null
          created_at?: string | null
          deleted_timesheet_count?: number | null
          id?: string
          job_id: string
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          technician_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          assignment_id?: string | null
          created_at?: string | null
          deleted_timesheet_count?: number | null
          id?: string
          job_id?: string
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          technician_id?: string
        }
        Relationships: []
      }
      assignment_notifications: {
        Row: {
          created_at: string | null
          id: string
          job_id: string | null
          message: string
          read: boolean | null
          technician_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          message: string
          read?: boolean | null
          technician_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          message?: string
          read?: boolean | null
          technician_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_notifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_notifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "assignment_notifications_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_notifications_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_conflicts: {
        Row: {
          conflict_date: string
          created_at: string | null
          department: string
          id: string
          job_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conflict_date: string
          created_at?: string | null
          department: string
          id?: string
          job_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          conflict_date?: string
          created_at?: string | null
          department?: string
          id?: string
          job_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_conflicts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_conflicts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "availability_conflicts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_conflicts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_conflicts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_conflicts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_exceptions: {
        Row: {
          created_at: string | null
          department: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["global_preset_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          department: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["global_preset_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          department?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["global_preset_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_exceptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exceptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_schedules: {
        Row: {
          created_at: string | null
          date: string
          department: string
          id: string
          notes: string | null
          source: string
          source_id: string | null
          status: Database["public"]["Enums"]["global_preset_status"]
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          department: string
          id?: string
          notes?: string | null
          source?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["global_preset_status"]
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          department?: string
          id?: string
          notes?: string | null
          source?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["global_preset_status"]
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          admin_notes: string | null
          app_version: string | null
          console_logs: Json | null
          created_at: string
          created_by: string | null
          description: string
          environment_info: Json | null
          github_issue_number: number | null
          github_issue_url: string | null
          id: string
          reporter_email: string
          reproduction_steps: string | null
          resolved_at: string | null
          resolved_by: string | null
          screenshot_url: string | null
          severity: Database["public"]["Enums"]["bug_severity"]
          status: Database["public"]["Enums"]["bug_status"]
          title: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          app_version?: string | null
          console_logs?: Json | null
          created_at?: string
          created_by?: string | null
          description: string
          environment_info?: Json | null
          github_issue_number?: number | null
          github_issue_url?: string | null
          id?: string
          reporter_email: string
          reproduction_steps?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_url?: string | null
          severity?: Database["public"]["Enums"]["bug_severity"]
          status?: Database["public"]["Enums"]["bug_status"]
          title: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          app_version?: string | null
          console_logs?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string
          environment_info?: Json | null
          github_issue_number?: number | null
          github_issue_url?: string | null
          id?: string
          reporter_email?: string
          reproduction_steps?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_url?: string | null
          severity?: Database["public"]["Enums"]["bug_severity"]
          status?: Database["public"]["Enums"]["bug_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      consumos_components: {
        Row: {
          created_at: string
          created_by: string | null
          department: Database["public"]["Enums"]["department"]
          fixture_type: string | null
          id: string
          legacy_code: number | null
          name: string
          updated_at: string
          watts: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department: Database["public"]["Enums"]["department"]
          fixture_type?: string | null
          id?: string
          legacy_code?: number | null
          name: string
          updated_at?: string
          watts: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: Database["public"]["Enums"]["department"]
          fixture_type?: string | null
          id?: string
          legacy_code?: number | null
          name?: string
          updated_at?: string
          watts?: number
        }
        Relationships: [
          {
            foreignKeyName: "consumos_components_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumos_components_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_email_logs: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string | null
          id: string
          inline_image_cleanup_completed_at: string | null
          inline_image_paths: string[] | null
          inline_image_retention_until: string | null
          recipients: string[] | null
          sender: string | null
          subject: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          id?: string
          inline_image_cleanup_completed_at?: string | null
          inline_image_paths?: string[] | null
          inline_image_retention_until?: string | null
          recipients?: string[] | null
          sender?: string | null
          subject?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          id?: string
          inline_image_cleanup_completed_at?: string | null
          inline_image_paths?: string[] | null
          inline_image_retention_until?: string | null
          recipients?: string[] | null
          sender?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      custom_tech_rates: {
        Row: {
          base_day_especialista_eur: number | null
          base_day_eur: number
          base_day_responsable_eur: number | null
          currency: string
          overtime_hour_especialista_eur: number | null
          overtime_hour_eur: number | null
          overtime_hour_responsable_eur: number | null
          plus_10_12_eur: number | null
          profile_id: string
          rehearsal_day_eur: number | null
          tour_base_especialista_eur: number | null
          tour_base_other_eur: number | null
          tour_base_responsable_eur: number | null
          travel_full_day_eur: number | null
          travel_half_day_eur: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_day_especialista_eur?: number | null
          base_day_eur: number
          base_day_responsable_eur?: number | null
          currency?: string
          overtime_hour_especialista_eur?: number | null
          overtime_hour_eur?: number | null
          overtime_hour_responsable_eur?: number | null
          plus_10_12_eur?: number | null
          profile_id: string
          rehearsal_day_eur?: number | null
          tour_base_especialista_eur?: number | null
          tour_base_other_eur?: number | null
          tour_base_responsable_eur?: number | null
          travel_full_day_eur?: number | null
          travel_half_day_eur?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_day_especialista_eur?: number | null
          base_day_eur?: number
          base_day_responsable_eur?: number | null
          currency?: string
          overtime_hour_especialista_eur?: number | null
          overtime_hour_eur?: number | null
          overtime_hour_responsable_eur?: number | null
          plus_10_12_eur?: number | null
          profile_id?: string
          rehearsal_day_eur?: number | null
          tour_base_especialista_eur?: number | null
          tour_base_other_eur?: number | null
          tour_base_responsable_eur?: number | null
          travel_full_day_eur?: number | null
          travel_half_day_eur?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_tech_rates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_tech_rates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      day_assignments: {
        Row: {
          created_at: string | null
          date: string
          id: string
          preset_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          preset_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          preset_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      day_preset_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string | null
          date: string
          id: string
          order: number | null
          preset_id: string
          source: string | null
          source_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string | null
          date: string
          id?: string
          order?: number | null
          preset_id: string
          source?: string | null
          source_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string | null
          date?: string
          id?: string
          order?: number | null
          preset_id?: string
          source?: string | null
          source_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_preset_assignments_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "presets"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          recipient_id: string
          sender_id: string
          status: Database["public"]["Enums"]["direct_message_status"]
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          recipient_id: string
          sender_id: string
          status?: Database["public"]["Enums"]["direct_message_status"]
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          recipient_id?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["direct_message_status"]
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dryhire_parent_folders: {
        Row: {
          created_at: string | null
          department: string
          element_id: string
          id: string
          month: string
          year: number
        }
        Insert: {
          created_at?: string | null
          department: string
          element_id: string
          id?: string
          month: string
          year: number
        }
        Update: {
          created_at?: string | null
          department?: string
          element_id?: string
          id?: string
          month?: string
          year?: number
        }
        Relationships: []
      }
      dwg_conversion_queue: {
        Row: {
          bucket: string
          created_at: string
          derivative_path: string
          document_id: string
          error: string | null
          id: string
          job_id: string
          source_path: string
          status: string
          updated_at: string
        }
        Insert: {
          bucket: string
          created_at?: string
          derivative_path: string
          document_id: string
          error?: string | null
          id?: string
          job_id: string
          source_path: string
          status?: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          created_at?: string
          derivative_path?: string
          document_id?: string
          error?: string | null
          id?: string
          job_id?: string
          source_path?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dwg_conversion_queue_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "job_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          category: Database["public"]["Enums"]["equipment_category"]
          created_at: string | null
          department: string
          id: string
          image_id: string | null
          manufacturer: string | null
          name: string
          resource_id: string | null
          updated_at: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["equipment_category"]
          created_at?: string | null
          department?: string
          id?: string
          image_id?: string | null
          manufacturer?: string | null
          name: string
          resource_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["equipment_category"]
          created_at?: string | null
          department?: string
          id?: string
          image_id?: string | null
          manufacturer?: string | null
          name?: string
          resource_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      equipment_models_deprecated_20251204: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          default_daily_cap_eur: number | null
          default_total_cap_eur: number | null
          is_active: boolean
          label_es: string
          requires_receipt: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_daily_cap_eur?: number | null
          default_total_cap_eur?: number | null
          is_active?: boolean
          label_es: string
          requires_receipt?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_daily_cap_eur?: number | null
          default_total_cap_eur?: number | null
          is_active?: boolean
          label_es?: string
          requires_receipt?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense_permissions: {
        Row: {
          category_slug: string
          created_at: string
          created_by: string | null
          daily_cap_eur: number | null
          id: string
          job_id: string
          notes: string | null
          technician_id: string
          total_cap_eur: number | null
          updated_at: string
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          category_slug: string
          created_at?: string
          created_by?: string | null
          daily_cap_eur?: number | null
          id?: string
          job_id: string
          notes?: string | null
          technician_id: string
          total_cap_eur?: number | null
          updated_at?: string
          updated_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          category_slug?: string
          created_at?: string
          created_by?: string | null
          daily_cap_eur?: number | null
          id?: string
          job_id?: string
          notes?: string | null
          technician_id?: string
          total_cap_eur?: number | null
          updated_at?: string
          updated_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_permissions_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "expense_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_permissions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_permissions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "expense_permissions_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_permissions_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_requests: {
        Row: {
          admin_notes: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          reporter_email: string
          status: Database["public"]["Enums"]["feature_status"]
          title: string
          updated_at: string
          use_case: string | null
        }
        Insert: {
          admin_notes?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          reporter_email: string
          status?: Database["public"]["Enums"]["feature_status"]
          title: string
          updated_at?: string
          use_case?: string | null
        }
        Update: {
          admin_notes?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          reporter_email?: string
          status?: Database["public"]["Enums"]["feature_status"]
          title?: string
          updated_at?: string
          use_case?: string | null
        }
        Relationships: []
      }
      festival_artist_files: {
        Row: {
          artist_id: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          artist_id?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          artist_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "festival_artist_files_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "festival_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_artist_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_artist_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_artist_form_submissions: {
        Row: {
          artist_id: string | null
          created_at: string | null
          form_data: Json
          form_id: string | null
          id: string
          notes: string | null
          status: string | null
          submitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          artist_id?: string | null
          created_at?: string | null
          form_data: Json
          form_id?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          artist_id?: string | null
          created_at?: string | null
          form_data?: Json
          form_id?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "festival_artist_form_submissions_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "festival_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_artist_form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "festival_artist_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_artist_forms: {
        Row: {
          artist_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          shortened_url: string | null
          status: Database["public"]["Enums"]["form_status"]
          token: string | null
          updated_at: string | null
        }
        Insert: {
          artist_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          shortened_url?: string | null
          status?: Database["public"]["Enums"]["form_status"]
          token?: string | null
          updated_at?: string | null
        }
        Update: {
          artist_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          shortened_url?: string | null
          status?: Database["public"]["Enums"]["form_status"]
          token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "festival_artist_forms_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "festival_artists"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_artists: {
        Row: {
          created_at: string | null
          crew: string | null
          date: string | null
          extras_df: boolean | null
          extras_djbooth: boolean | null
          extras_sf: boolean | null
          extras_wired: string | null
          foh_console: string | null
          foh_console_provided_by:
            | Database["public"]["Enums"]["provider_type"]
            | null
          foh_drive: string | null
          foh_drive_position: string | null
          foh_tech: boolean | null
          foh_waves_models: Json
          foh_waves_provided_by: Database["public"]["Enums"]["provider_type"]
          foh_outboard: string | null
          form_language: string
          id: string
          iem_provided_by: Database["public"]["Enums"]["provider_type"] | null
          iem_systems: Json | null
          infra_analog: number | null
          infra_cat6: boolean | null
          infra_cat6_quantity: number | null
          infra_coax: boolean | null
          infra_coax_quantity: number | null
          infra_hma: boolean | null
          infra_hma_quantity: number | null
          infra_opticalcon_duo: boolean | null
          infra_opticalcon_duo_quantity: number | null
          infrastructure_provided_by:
            | Database["public"]["Enums"]["provider_type"]
            | null
          isaftermidnight: boolean | null
          job_id: string | null
          line_check: boolean
          line_check_end: string | null
          line_check_start: string | null
          load_in_time: string | null
          mic_kit: string | null
          mic_pack: string | null
          mon_console: string | null
          mon_console_provided_by:
            | Database["public"]["Enums"]["provider_type"]
            | null
          mon_position: string | null
          mon_tech: boolean | null
          mon_waves_models: Json
          mon_waves_provided_by: Database["public"]["Enums"]["provider_type"]
          mon_outboard: string | null
          monitors_enabled: boolean | null
          monitors_from_foh: boolean
          monitors_quantity: number | null
          name: string
          notes: string | null
          other_infrastructure: string | null
          rf_festival_mics: number | null
          rf_festival_url: string | null
          rf_festival_wireless: number | null
          rider_missing: boolean | null
          show_end: string | null
          show_start: string | null
          soundcheck: boolean | null
          soundcheck_end: string | null
          soundcheck_start: string | null
          stage: number | null
          stage_plot_file_name: string | null
          stage_plot_file_path: string | null
          stage_plot_file_type: string | null
          stage_plot_uploaded_at: string | null
          timezone: string | null
          updated_at: string | null
          wired_mics: Json | null
          wireless_provided_by:
            | Database["public"]["Enums"]["provider_type"]
            | null
          wireless_quantity: number | null
          wireless_systems: Json | null
        }
        Insert: {
          created_at?: string | null
          crew?: string | null
          date?: string | null
          extras_df?: boolean | null
          extras_djbooth?: boolean | null
          extras_sf?: boolean | null
          extras_wired?: string | null
          foh_console?: string | null
          foh_console_provided_by?:
            | Database["public"]["Enums"]["provider_type"]
            | null
          foh_drive?: string | null
          foh_drive_position?: string | null
          foh_tech?: boolean | null
          foh_waves_models?: Json
          foh_waves_provided_by?: Database["public"]["Enums"]["provider_type"]
          foh_outboard?: string | null
          form_language?: string
          id?: string
          iem_provided_by?: Database["public"]["Enums"]["provider_type"] | null
          iem_systems?: Json | null
          infra_analog?: number | null
          infra_cat6?: boolean | null
          infra_cat6_quantity?: number | null
          infra_coax?: boolean | null
          infra_coax_quantity?: number | null
          infra_hma?: boolean | null
          infra_hma_quantity?: number | null
          infra_opticalcon_duo?: boolean | null
          infra_opticalcon_duo_quantity?: number | null
          infrastructure_provided_by?:
            | Database["public"]["Enums"]["provider_type"]
            | null
          isaftermidnight?: boolean | null
          job_id?: string | null
          line_check?: boolean
          line_check_end?: string | null
          line_check_start?: string | null
          load_in_time?: string | null
          mic_kit?: string | null
          mic_pack?: string | null
          mon_console?: string | null
          mon_console_provided_by?:
            | Database["public"]["Enums"]["provider_type"]
            | null
          mon_position?: string | null
          mon_tech?: boolean | null
          mon_waves_models?: Json
          mon_waves_provided_by?: Database["public"]["Enums"]["provider_type"]
          mon_outboard?: string | null
          monitors_enabled?: boolean | null
          monitors_from_foh?: boolean
          monitors_quantity?: number | null
          name: string
          notes?: string | null
          other_infrastructure?: string | null
          rf_festival_mics?: number | null
          rf_festival_url?: string | null
          rf_festival_wireless?: number | null
          rider_missing?: boolean | null
          show_end?: string | null
          show_start?: string | null
          soundcheck?: boolean | null
          soundcheck_end?: string | null
          soundcheck_start?: string | null
          stage?: number | null
          stage_plot_file_name?: string | null
          stage_plot_file_path?: string | null
          stage_plot_file_type?: string | null
          stage_plot_uploaded_at?: string | null
          timezone?: string | null
          updated_at?: string | null
          wired_mics?: Json | null
          wireless_provided_by?:
            | Database["public"]["Enums"]["provider_type"]
            | null
          wireless_quantity?: number | null
          wireless_systems?: Json | null
        }
        Update: {
          created_at?: string | null
          crew?: string | null
          date?: string | null
          extras_df?: boolean | null
          extras_djbooth?: boolean | null
          extras_sf?: boolean | null
          extras_wired?: string | null
          foh_console?: string | null
          foh_console_provided_by?:
            | Database["public"]["Enums"]["provider_type"]
            | null
          foh_drive?: string | null
          foh_drive_position?: string | null
          foh_tech?: boolean | null
          foh_waves_models?: Json
          foh_waves_provided_by?: Database["public"]["Enums"]["provider_type"]
          foh_outboard?: string | null
          form_language?: string
          id?: string
          iem_provided_by?: Database["public"]["Enums"]["provider_type"] | null
          iem_systems?: Json | null
          infra_analog?: number | null
          infra_cat6?: boolean | null
          infra_cat6_quantity?: number | null
          infra_coax?: boolean | null
          infra_coax_quantity?: number | null
          infra_hma?: boolean | null
          infra_hma_quantity?: number | null
          infra_opticalcon_duo?: boolean | null
          infra_opticalcon_duo_quantity?: number | null
          infrastructure_provided_by?:
            | Database["public"]["Enums"]["provider_type"]
            | null
          isaftermidnight?: boolean | null
          job_id?: string | null
          line_check?: boolean
          line_check_end?: string | null
          line_check_start?: string | null
          load_in_time?: string | null
          mic_kit?: string | null
          mic_pack?: string | null
          mon_console?: string | null
          mon_console_provided_by?:
            | Database["public"]["Enums"]["provider_type"]
            | null
          mon_position?: string | null
          mon_tech?: boolean | null
          mon_waves_models?: Json
          mon_waves_provided_by?: Database["public"]["Enums"]["provider_type"]
          mon_outboard?: string | null
          monitors_enabled?: boolean | null
          monitors_from_foh?: boolean
          monitors_quantity?: number | null
          name?: string
          notes?: string | null
          other_infrastructure?: string | null
          rf_festival_mics?: number | null
          rf_festival_url?: string | null
          rf_festival_wireless?: number | null
          rider_missing?: boolean | null
          show_end?: string | null
          show_start?: string | null
          soundcheck?: boolean | null
          soundcheck_end?: string | null
          soundcheck_start?: string | null
          stage?: number | null
          stage_plot_file_name?: string | null
          stage_plot_file_path?: string | null
          stage_plot_file_type?: string | null
          stage_plot_uploaded_at?: string | null
          timezone?: string | null
          updated_at?: string | null
          wired_mics?: Json | null
          wireless_provided_by?:
            | Database["public"]["Enums"]["provider_type"]
            | null
          wireless_quantity?: number | null
          wireless_systems?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "festival_artists_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_artists_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      festival_gear_setups: {
        Row: {
          available_analog_runs: number | null
          available_cat6_runs: number | null
          available_coax_runs: number | null
          available_hma_runs: number | null
          available_monitors: number | null
          available_opticalcon_duo_runs: number | null
          created_at: string | null
          extras_wired: string | null
          foh_consoles: Json | null
          foh_drive_options: string[]
          foh_drive_positions: string[]
          foh_waves_models: Json
          foh_outboard: string | null
          has_dj_booths: boolean | null
          has_drum_fills: boolean | null
          has_side_fills: boolean | null
          id: string
          iem_systems: Json | null
          job_id: string | null
          max_stages: number | null
          mon_consoles: Json | null
          mon_positions: string[]
          mon_waves_models: Json
          mon_outboard: string | null
          notes: string | null
          other_infrastructure: string | null
          updated_at: string | null
          wired_mics: Json | null
          wireless_systems: Json | null
        }
        Insert: {
          available_analog_runs?: number | null
          available_cat6_runs?: number | null
          available_coax_runs?: number | null
          available_hma_runs?: number | null
          available_monitors?: number | null
          available_opticalcon_duo_runs?: number | null
          created_at?: string | null
          extras_wired?: string | null
          foh_consoles?: Json | null
          foh_drive_options?: string[]
          foh_drive_positions?: string[]
          foh_waves_models?: Json
          foh_outboard?: string | null
          has_dj_booths?: boolean | null
          has_drum_fills?: boolean | null
          has_side_fills?: boolean | null
          id?: string
          iem_systems?: Json | null
          job_id?: string | null
          max_stages?: number | null
          mon_consoles?: Json | null
          mon_positions?: string[]
          mon_waves_models?: Json
          mon_outboard?: string | null
          notes?: string | null
          other_infrastructure?: string | null
          updated_at?: string | null
          wired_mics?: Json | null
          wireless_systems?: Json | null
        }
        Update: {
          available_analog_runs?: number | null
          available_cat6_runs?: number | null
          available_coax_runs?: number | null
          available_hma_runs?: number | null
          available_monitors?: number | null
          available_opticalcon_duo_runs?: number | null
          created_at?: string | null
          extras_wired?: string | null
          foh_consoles?: Json | null
          foh_drive_options?: string[]
          foh_drive_positions?: string[]
          foh_waves_models?: Json
          foh_outboard?: string | null
          has_dj_booths?: boolean | null
          has_drum_fills?: boolean | null
          has_side_fills?: boolean | null
          id?: string
          iem_systems?: Json | null
          job_id?: string | null
          max_stages?: number | null
          mon_consoles?: Json | null
          mon_positions?: string[]
          mon_waves_models?: Json
          mon_outboard?: string | null
          notes?: string | null
          other_infrastructure?: string | null
          updated_at?: string | null
          wired_mics?: Json | null
          wireless_systems?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "festival_gear_setups_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_gear_setups_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      festival_logos: {
        Row: {
          content_type: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          job_id: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          job_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          job_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "festival_logos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_logos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      festival_settings: {
        Row: {
          created_at: string | null
          day_start_time: string
          id: string
          job_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_start_time?: string
          id?: string
          job_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_start_time?: string
          id?: string
          job_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "festival_settings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_settings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      festival_shift_assignments: {
        Row: {
          created_at: string | null
          external_technician_name: string | null
          id: string
          role: string
          shift_id: string | null
          technician_id: string | null
        }
        Insert: {
          created_at?: string | null
          external_technician_name?: string | null
          id?: string
          role: string
          shift_id?: string | null
          technician_id?: string | null
        }
        Update: {
          created_at?: string | null
          external_technician_name?: string | null
          id?: string
          role?: string
          shift_id?: string | null
          technician_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "festival_shift_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "festival_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_shifts: {
        Row: {
          created_at: string | null
          date: string
          department: string | null
          end_time: string
          id: string
          job_id: string | null
          name: string
          notes: string | null
          stage: number | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          department?: string | null
          end_time: string
          id?: string
          job_id?: string | null
          name: string
          notes?: string | null
          stage?: number | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          department?: string | null
          end_time?: string
          id?: string
          job_id?: string | null
          name?: string
          notes?: string | null
          stage?: number | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "festival_shifts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_shifts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      festival_stage_gear_setups: {
        Row: {
          created_at: string | null
          extras_df: boolean | null
          extras_djbooth: boolean | null
          extras_sf: boolean | null
          extras_wired: string | null
          foh_consoles: Json | null
          foh_drive_options: string[]
          foh_drive_positions: string[]
          foh_waves_models: Json
          foh_outboard: string | null
          gear_setup_id: string
          id: string
          iem_systems: Json | null
          infra_analog: number | null
          infra_cat6: boolean | null
          infra_cat6_quantity: number | null
          infra_coax: boolean | null
          infra_coax_quantity: number | null
          infra_hma: boolean | null
          infra_hma_quantity: number | null
          infra_opticalcon_duo: boolean | null
          infra_opticalcon_duo_quantity: number | null
          mon_consoles: Json | null
          mon_positions: string[]
          mon_waves_models: Json
          mon_outboard: string | null
          monitors_enabled: boolean | null
          monitors_quantity: number | null
          notes: string | null
          other_infrastructure: string | null
          stage_number: number
          updated_at: string | null
          wired_mics: Json | null
          wireless_systems: Json | null
        }
        Insert: {
          created_at?: string | null
          extras_df?: boolean | null
          extras_djbooth?: boolean | null
          extras_sf?: boolean | null
          extras_wired?: string | null
          foh_consoles?: Json | null
          foh_drive_options?: string[]
          foh_drive_positions?: string[]
          foh_waves_models?: Json
          foh_outboard?: string | null
          gear_setup_id: string
          id?: string
          iem_systems?: Json | null
          infra_analog?: number | null
          infra_cat6?: boolean | null
          infra_cat6_quantity?: number | null
          infra_coax?: boolean | null
          infra_coax_quantity?: number | null
          infra_hma?: boolean | null
          infra_hma_quantity?: number | null
          infra_opticalcon_duo?: boolean | null
          infra_opticalcon_duo_quantity?: number | null
          mon_consoles?: Json | null
          mon_positions?: string[]
          mon_waves_models?: Json
          mon_outboard?: string | null
          monitors_enabled?: boolean | null
          monitors_quantity?: number | null
          notes?: string | null
          other_infrastructure?: string | null
          stage_number: number
          updated_at?: string | null
          wired_mics?: Json | null
          wireless_systems?: Json | null
        }
        Update: {
          created_at?: string | null
          extras_df?: boolean | null
          extras_djbooth?: boolean | null
          extras_sf?: boolean | null
          extras_wired?: string | null
          foh_consoles?: Json | null
          foh_drive_options?: string[]
          foh_drive_positions?: string[]
          foh_waves_models?: Json
          foh_outboard?: string | null
          gear_setup_id?: string
          id?: string
          iem_systems?: Json | null
          infra_analog?: number | null
          infra_cat6?: boolean | null
          infra_cat6_quantity?: number | null
          infra_coax?: boolean | null
          infra_coax_quantity?: number | null
          infra_hma?: boolean | null
          infra_hma_quantity?: number | null
          infra_opticalcon_duo?: boolean | null
          infra_opticalcon_duo_quantity?: number | null
          mon_consoles?: Json | null
          mon_positions?: string[]
          mon_waves_models?: Json
          mon_outboard?: string | null
          monitors_enabled?: boolean | null
          monitors_quantity?: number | null
          notes?: string | null
          other_infrastructure?: string | null
          stage_number?: number
          updated_at?: string | null
          wired_mics?: Json | null
          wireless_systems?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "festival_stage_gear_setups_gear_setup_id_fkey"
            columns: ["gear_setup_id"]
            isOneToOne: false
            referencedRelation: "festival_gear_setups"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_stages: {
        Row: {
          created_at: string | null
          id: string
          job_id: string | null
          name: string
          number: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          name: string
          number: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          name?: string
          number?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "festival_stages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festival_stages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      flex_crew_assignments: {
        Row: {
          created_at: string | null
          crew_call_id: string
          flex_line_item_id: string
          id: string
          technician_id: string
        }
        Insert: {
          created_at?: string | null
          crew_call_id: string
          flex_line_item_id: string
          id?: string
          technician_id: string
        }
        Update: {
          created_at?: string | null
          crew_call_id?: string
          flex_line_item_id?: string
          id?: string
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flex_crew_assignments_crew_call_id_fkey"
            columns: ["crew_call_id"]
            isOneToOne: false
            referencedRelation: "flex_crew_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_crew_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_crew_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flex_crew_calls: {
        Row: {
          created_at: string | null
          department: string
          flex_element_id: string
          id: string
          job_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department: string
          flex_element_id: string
          id?: string
          job_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string
          flex_element_id?: string
          id?: string
          job_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flex_crew_calls_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_crew_calls_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      flex_folders: {
        Row: {
          created_at: string
          current_status: string | null
          department: string | null
          element_id: string
          folder_type: string
          id: string
          job_id: string | null
          parent_id: string | null
          tour_date_id: string | null
        }
        Insert: {
          created_at?: string
          current_status?: string | null
          department?: string | null
          element_id: string
          folder_type: string
          id?: string
          job_id?: string | null
          parent_id?: string | null
          tour_date_id?: string | null
        }
        Update: {
          created_at?: string
          current_status?: string | null
          department?: string | null
          element_id?: string
          folder_type?: string
          id?: string
          job_id?: string | null
          parent_id?: string | null
          tour_date_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flex_folders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_folders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "flex_folders_tour_date_id_fkey"
            columns: ["tour_date_id"]
            isOneToOne: false
            referencedRelation: "tour_dates"
            referencedColumns: ["id"]
          },
        ]
      }
      flex_status_log: {
        Row: {
          action_type: string | null
          error: string | null
          flex_response: Json | null
          folder_id: string
          id: string
          new_status: string
          previous_status: string | null
          processed_at: string
          processed_by: string | null
          success: boolean
        }
        Insert: {
          action_type?: string | null
          error?: string | null
          flex_response?: Json | null
          folder_id: string
          id?: string
          new_status: string
          previous_status?: string | null
          processed_at?: string
          processed_by?: string | null
          success?: boolean
        }
        Update: {
          action_type?: string | null
          error?: string | null
          flex_response?: Json | null
          folder_id?: string
          id?: string
          new_status?: string
          previous_status?: string | null
          processed_at?: string
          processed_by?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "flex_status_log_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "flex_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_status_log_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_status_log_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flex_work_order_items: {
        Row: {
          created_at: string
          extra_type: Database["public"]["Enums"]["job_extra_type"] | null
          flex_line_item_id: string
          flex_resource_id: string
          id: string
          job_assignment_id: string | null
          job_role: string | null
          metadata: Json
          quantity: number | null
          role_department: string | null
          source_type: Database["public"]["Enums"]["flex_work_order_item_source"]
          updated_at: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          extra_type?: Database["public"]["Enums"]["job_extra_type"] | null
          flex_line_item_id: string
          flex_resource_id: string
          id?: string
          job_assignment_id?: string | null
          job_role?: string | null
          metadata?: Json
          quantity?: number | null
          role_department?: string | null
          source_type: Database["public"]["Enums"]["flex_work_order_item_source"]
          updated_at?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          extra_type?: Database["public"]["Enums"]["job_extra_type"] | null
          flex_line_item_id?: string
          flex_resource_id?: string
          id?: string
          job_assignment_id?: string | null
          job_role?: string | null
          metadata?: Json
          quantity?: number | null
          role_department?: string | null
          source_type?: Database["public"]["Enums"]["flex_work_order_item_source"]
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flex_work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "flex_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      flex_work_orders: {
        Row: {
          created_at: string
          document_name: string | null
          document_number: string | null
          flex_document_id: string
          flex_element_id: string
          flex_vendor_id: string
          folder_element_id: string
          id: string
          job_id: string
          lpo_number: string | null
          technician_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_name?: string | null
          document_number?: string | null
          flex_document_id: string
          flex_element_id: string
          flex_vendor_id: string
          folder_element_id: string
          id?: string
          job_id: string
          lpo_number?: string | null
          technician_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_name?: string | null
          document_number?: string | null
          flex_document_id?: string
          flex_element_id?: string
          flex_vendor_id?: string
          folder_element_id?: string
          id?: string
          job_id?: string
          lpo_number?: string | null
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flex_work_orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_work_orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "flex_work_orders_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_work_orders_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      global_availability_presets: {
        Row: {
          created_at: string | null
          day_of_week: number
          department: string
          id: string
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["global_preset_status"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          department: string
          id?: string
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["global_preset_status"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          department?: string
          id?: string
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["global_preset_status"]
          updated_at?: string | null
        }
        Relationships: []
      }
      global_stock_entries: {
        Row: {
          base_quantity: number
          created_at: string | null
          equipment_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          base_quantity?: number
          created_at?: string | null
          equipment_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          base_quantity?: number
          created_at?: string | null
          equipment_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "global_stock_entries_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: true
            referencedRelation: "current_stock_levels"
            referencedColumns: ["equipment_id"]
          },
          {
            foreignKeyName: "global_stock_entries_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: true
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_stock_entries_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: true
            referencedRelation: "equipment_availability_with_rentals"
            referencedColumns: ["equipment_id"]
          },
        ]
      }
      hoja_de_ruta: {
        Row: {
          alerts: Json | null
          approved_at: string | null
          approved_by: string | null
          aux_machinery_requirements: Json
          aux_staff_dismantle_qty: number
          aux_staff_setup_qty: number
          auxiliary_needs: string | null
          created_at: string | null
          created_by: string | null
          crew_calls: Json | null
          document_version: number | null
          event_dates: string | null
          event_name: string | null
          hotel_info: Json | null
          id: string
          job_id: string | null
          last_modified: string | null
          last_modified_by: string | null
          local_contacts: Json | null
          logistics_info: Json | null
          power_requirements: string | null
          print_excluded_sections: Json
          program_schedule_json: Json | null
          restaurants_info: Json | null
          schedule: string | null
          status: string | null
          tour_date_id: string | null
          updated_at: string | null
          venue_address: string | null
          venue_latitude: number | null
          venue_longitude: number | null
          venue_name: string | null
          venue_technical_specs: Json | null
          weather_data: Json | null
        }
        Insert: {
          alerts?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          aux_machinery_requirements?: Json
          aux_staff_dismantle_qty?: number
          aux_staff_setup_qty?: number
          auxiliary_needs?: string | null
          created_at?: string | null
          created_by?: string | null
          crew_calls?: Json | null
          document_version?: number | null
          event_dates?: string | null
          event_name?: string | null
          hotel_info?: Json | null
          id?: string
          job_id?: string | null
          last_modified?: string | null
          last_modified_by?: string | null
          local_contacts?: Json | null
          logistics_info?: Json | null
          power_requirements?: string | null
          print_excluded_sections?: Json
          program_schedule_json?: Json | null
          restaurants_info?: Json | null
          schedule?: string | null
          status?: string | null
          tour_date_id?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_latitude?: number | null
          venue_longitude?: number | null
          venue_name?: string | null
          venue_technical_specs?: Json | null
          weather_data?: Json | null
        }
        Update: {
          alerts?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          aux_machinery_requirements?: Json
          aux_staff_dismantle_qty?: number
          aux_staff_setup_qty?: number
          auxiliary_needs?: string | null
          created_at?: string | null
          created_by?: string | null
          crew_calls?: Json | null
          document_version?: number | null
          event_dates?: string | null
          event_name?: string | null
          hotel_info?: Json | null
          id?: string
          job_id?: string | null
          last_modified?: string | null
          last_modified_by?: string | null
          local_contacts?: Json | null
          logistics_info?: Json | null
          power_requirements?: string | null
          print_excluded_sections?: Json
          program_schedule_json?: Json | null
          restaurants_info?: Json | null
          schedule?: string | null
          status?: string | null
          tour_date_id?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_latitude?: number | null
          venue_longitude?: number | null
          venue_name?: string | null
          venue_technical_specs?: Json | null
          weather_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "hoja_de_ruta_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_last_modified_by_fkey"
            columns: ["last_modified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_last_modified_by_fkey"
            columns: ["last_modified_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_tour_date_id_fkey"
            columns: ["tour_date_id"]
            isOneToOne: false
            referencedRelation: "tour_dates"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_de_ruta_accommodations: {
        Row: {
          address: string | null
          check_in: string | null
          check_out: string | null
          created_at: string | null
          hoja_de_ruta_id: string | null
          hotel_name: string
          id: string
          latitude: number | null
          longitude: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          hoja_de_ruta_id?: string | null
          hotel_name: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          hoja_de_ruta_id?: string | null
          hotel_name?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoja_de_ruta_accommodations_hoja_de_ruta_id_fkey"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_de_ruta_contacts: {
        Row: {
          hoja_de_ruta_id: string | null
          id: string
          name: string
          phone: string | null
          role: string | null
          technician_id: string | null
        }
        Insert: {
          hoja_de_ruta_id?: string | null
          id?: string
          name: string
          phone?: string | null
          role?: string | null
          technician_id?: string | null
        }
        Update: {
          hoja_de_ruta_id?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
          technician_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_hoja_de_ruta_contacts_main"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_hoja_de_ruta_contacts_technician_id_profiles_id"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_hoja_de_ruta_contacts_technician_id_profiles_id"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_contacts_hoja_de_ruta_id_fkey"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_de_ruta_equipment: {
        Row: {
          created_at: string | null
          equipment_category: string
          equipment_name: string
          hoja_de_ruta_id: string | null
          id: string
          notes: string | null
          quantity: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          equipment_category: string
          equipment_name: string
          hoja_de_ruta_id?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          equipment_category?: string
          equipment_name?: string
          hoja_de_ruta_id?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_hoja_de_ruta_equipment_main"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_equipment_hoja_de_ruta_id_fkey"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_de_ruta_images: {
        Row: {
          hoja_de_ruta_id: string | null
          id: string
          image_path: string
          image_type: string
        }
        Insert: {
          hoja_de_ruta_id?: string | null
          id?: string
          image_path: string
          image_type: string
        }
        Update: {
          hoja_de_ruta_id?: string | null
          id?: string
          image_path?: string
          image_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_hoja_de_ruta_images_main"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_images_hoja_de_ruta_id_fkey"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_de_ruta_logistics: {
        Row: {
          equipment_logistics: string | null
          hoja_de_ruta_id: string | null
          id: string
          loading_details: string | null
          transport: string | null
          unloading_details: string | null
        }
        Insert: {
          equipment_logistics?: string | null
          hoja_de_ruta_id?: string | null
          id?: string
          loading_details?: string | null
          transport?: string | null
          unloading_details?: string | null
        }
        Update: {
          equipment_logistics?: string | null
          hoja_de_ruta_id?: string | null
          id?: string
          loading_details?: string | null
          transport?: string | null
          unloading_details?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_hoja_de_ruta_logistics_main"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: true
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_logistics_hoja_de_ruta_id_fkey"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: true
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_de_ruta_restaurants: {
        Row: {
          address: string | null
          created_at: string
          cuisine: string[] | null
          distance: number | null
          google_place_id: string
          hoja_de_ruta_id: string
          id: string
          is_selected: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          photos: string[] | null
          price_level: number | null
          rating: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          cuisine?: string[] | null
          distance?: number | null
          google_place_id: string
          hoja_de_ruta_id: string
          id?: string
          is_selected?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          photos?: string[] | null
          price_level?: number | null
          rating?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          cuisine?: string[] | null
          distance?: number | null
          google_place_id?: string
          hoja_de_ruta_id?: string
          id?: string
          is_selected?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          photos?: string[] | null
          price_level?: number | null
          rating?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoja_de_ruta_restaurants_hoja_de_ruta_id_fkey"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_de_ruta_room_assignments: {
        Row: {
          accommodation_id: string | null
          created_at: string | null
          id: string
          room_number: string | null
          room_type: string
          staff_member1_id: string | null
          staff_member2_id: string | null
          updated_at: string | null
        }
        Insert: {
          accommodation_id?: string | null
          created_at?: string | null
          id?: string
          room_number?: string | null
          room_type: string
          staff_member1_id?: string | null
          staff_member2_id?: string | null
          updated_at?: string | null
        }
        Update: {
          accommodation_id?: string | null
          created_at?: string | null
          id?: string
          room_number?: string | null
          room_type?: string
          staff_member1_id?: string | null
          staff_member2_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoja_de_ruta_room_assignments_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta_accommodations"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_de_ruta_rooms: {
        Row: {
          hoja_de_ruta_id: string | null
          id: string
          room_number: string | null
          room_type: Database["public"]["Enums"]["room_type"]
          staff_member1_id: string | null
          staff_member2_id: string | null
        }
        Insert: {
          hoja_de_ruta_id?: string | null
          id?: string
          room_number?: string | null
          room_type: Database["public"]["Enums"]["room_type"]
          staff_member1_id?: string | null
          staff_member2_id?: string | null
        }
        Update: {
          hoja_de_ruta_id?: string | null
          id?: string
          room_number?: string | null
          room_type?: Database["public"]["Enums"]["room_type"]
          staff_member1_id?: string | null
          staff_member2_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_hoja_de_ruta_rooms_main"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_rooms_hoja_de_ruta_id_fkey"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_rooms_staff_member1_id_fkey"
            columns: ["staff_member1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_rooms_staff_member1_id_fkey"
            columns: ["staff_member1_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_rooms_staff_member2_id_fkey"
            columns: ["staff_member2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_rooms_staff_member2_id_fkey"
            columns: ["staff_member2_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_de_ruta_staff: {
        Row: {
          dni: string | null
          hoja_de_ruta_id: string | null
          id: string
          name: string
          position: string | null
          surname1: string | null
          surname2: string | null
          technician_id: string | null
        }
        Insert: {
          dni?: string | null
          hoja_de_ruta_id?: string | null
          id?: string
          name: string
          position?: string | null
          surname1?: string | null
          surname2?: string | null
          technician_id?: string | null
        }
        Update: {
          dni?: string | null
          hoja_de_ruta_id?: string | null
          id?: string
          name?: string
          position?: string | null
          surname1?: string | null
          surname2?: string | null
          technician_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_hoja_de_ruta_staff_main"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_hoja_de_ruta_staff_technician_id_profiles_id"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_hoja_de_ruta_staff_technician_id_profiles_id"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_staff_hoja_de_ruta_id_fkey"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_de_ruta_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          event_type: string
          id: string
          is_active: boolean | null
          name: string
          template_data: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_type: string
          id?: string
          is_active?: boolean | null
          name: string
          template_data: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_type?: string
          id?: string
          is_active?: boolean | null
          name?: string
          template_data?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      hoja_de_ruta_transport: {
        Row: {
          company: string | null
          created_at: string | null
          date_time: string | null
          driver_name: string | null
          driver_phone: string | null
          has_return: boolean | null
          hoja_de_ruta_id: string | null
          id: string
          is_hoja_relevant: boolean
          license_plate: string | null
          logistics_categories: Database["public"]["Enums"]["logistics_transport_category"][]
          return_date_time: string | null
          source_logistics_event_id: string | null
          transport_type: string
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          date_time?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          has_return?: boolean | null
          hoja_de_ruta_id?: string | null
          id?: string
          is_hoja_relevant?: boolean
          license_plate?: string | null
          logistics_categories?: Database["public"]["Enums"]["logistics_transport_category"][]
          return_date_time?: string | null
          source_logistics_event_id?: string | null
          transport_type: string
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          date_time?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          has_return?: boolean | null
          hoja_de_ruta_id?: string | null
          id?: string
          is_hoja_relevant?: boolean
          license_plate?: string | null
          logistics_categories?: Database["public"]["Enums"]["logistics_transport_category"][]
          return_date_time?: string | null
          source_logistics_event_id?: string | null
          transport_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoja_de_ruta_transport_hoja_de_ruta_id_fkey"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_transport_source_logistics_event_id_fkey"
            columns: ["source_logistics_event_id"]
            isOneToOne: false
            referencedRelation: "logistics_events"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_de_ruta_travel: {
        Row: {
          arrival_time: string | null
          departure_time: string | null
          flight_train_number: string | null
          hoja_de_ruta_id: string | null
          id: string
          notes: string | null
          pickup_address: string | null
          pickup_time: string | null
          transportation_type: Database["public"]["Enums"]["transportation_type"]
        }
        Insert: {
          arrival_time?: string | null
          departure_time?: string | null
          flight_train_number?: string | null
          hoja_de_ruta_id?: string | null
          id?: string
          notes?: string | null
          pickup_address?: string | null
          pickup_time?: string | null
          transportation_type: Database["public"]["Enums"]["transportation_type"]
        }
        Update: {
          arrival_time?: string | null
          departure_time?: string | null
          flight_train_number?: string | null
          hoja_de_ruta_id?: string | null
          id?: string
          notes?: string | null
          pickup_address?: string | null
          pickup_time?: string | null
          transportation_type?: Database["public"]["Enums"]["transportation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "fk_hoja_de_ruta_travel_main"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_travel_hoja_de_ruta_id_fkey"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_de_ruta_travel_arrangements: {
        Row: {
          arrival_time: string | null
          created_at: string | null
          departure_time: string | null
          driver_name: string | null
          driver_phone: string | null
          flight_train_number: string | null
          hoja_de_ruta_id: string | null
          id: string
          notes: string | null
          pickup_address: string | null
          pickup_time: string | null
          plate_number: string | null
          transportation_type: string
          updated_at: string | null
        }
        Insert: {
          arrival_time?: string | null
          created_at?: string | null
          departure_time?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          flight_train_number?: string | null
          hoja_de_ruta_id?: string | null
          id?: string
          notes?: string | null
          pickup_address?: string | null
          pickup_time?: string | null
          plate_number?: string | null
          transportation_type: string
          updated_at?: string | null
        }
        Update: {
          arrival_time?: string | null
          created_at?: string | null
          departure_time?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          flight_train_number?: string | null
          hoja_de_ruta_id?: string | null
          id?: string
          notes?: string | null
          pickup_address?: string | null
          pickup_time?: string | null
          plate_number?: string | null
          transportation_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoja_de_ruta_travel_arrangements_hoja_de_ruta_id_fkey"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assignment_date: string | null
          assignment_source: string | null
          external_technician_name: string | null
          id: string
          invoice_received_at: string | null
          invoice_received_by: string | null
          job_id: string
          lights_role: string | null
          production_role: string | null
          response_time: string | null
          single_day: boolean
          sound_role: string | null
          status: Database["public"]["Enums"]["assignment_status"] | null
          technician_id: string
          use_tour_multipliers: boolean | null
          video_role: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_date?: string | null
          assignment_source?: string | null
          external_technician_name?: string | null
          id?: string
          invoice_received_at?: string | null
          invoice_received_by?: string | null
          job_id: string
          lights_role?: string | null
          production_role?: string | null
          response_time?: string | null
          single_day?: boolean
          sound_role?: string | null
          status?: Database["public"]["Enums"]["assignment_status"] | null
          technician_id: string
          use_tour_multipliers?: boolean | null
          video_role?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_date?: string | null
          assignment_source?: string | null
          external_technician_name?: string | null
          id?: string
          invoice_received_at?: string | null
          invoice_received_by?: string | null
          job_id?: string
          lights_role?: string | null
          production_role?: string | null
          response_time?: string | null
          single_day?: boolean
          sound_role?: string | null
          status?: Database["public"]["Enums"]["assignment_status"] | null
          technician_id?: string
          use_tour_multipliers?: boolean | null
          video_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_date_types: {
        Row: {
          created_at: string | null
          date: string
          id: string
          job_id: string
          type: Database["public"]["Enums"]["job_date_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          job_id: string
          type: Database["public"]["Enums"]["job_date_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          job_id?: string
          type?: Database["public"]["Enums"]["job_date_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_date_types_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_date_types_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_departments: {
        Row: {
          department: string
          job_id: string
        }
        Insert: {
          department: string
          job_id: string
        }
        Update: {
          department?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_departments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_departments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_documents: {
        Row: {
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          has_preview: boolean
          id: string
          job_id: string
          original_type: string | null
          preview_generated_at: string | null
          preview_url: string | null
          read_only: boolean
          template_type: string | null
          uploaded_at: string
          uploaded_by: string | null
          visible_to_tech: boolean
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          has_preview?: boolean
          id?: string
          job_id: string
          original_type?: string | null
          preview_generated_at?: string | null
          preview_url?: string | null
          read_only?: boolean
          template_type?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          visible_to_tech?: boolean
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          has_preview?: boolean
          id?: string
          job_id?: string
          original_type?: string | null
          preview_generated_at?: string | null
          preview_url?: string | null
          read_only?: boolean
          template_type?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          visible_to_tech?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "job_documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_expenses: {
        Row: {
          amount_eur: number
          amount_original: number
          approved_at: string | null
          approved_by: string | null
          category_slug: string
          created_at: string
          created_by: string | null
          currency_code: string
          description: string | null
          expense_date: string
          fx_rate: number
          id: string
          job_id: string
          permission_id: string | null
          receipt_path: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["expense_status"]
          status_history: Json
          submitted_at: string | null
          submitted_by: string | null
          technician_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_eur: number
          amount_original: number
          approved_at?: string | null
          approved_by?: string | null
          category_slug: string
          created_at?: string
          created_by?: string | null
          currency_code: string
          description?: string | null
          expense_date: string
          fx_rate?: number
          id?: string
          job_id: string
          permission_id?: string | null
          receipt_path?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          status_history?: Json
          submitted_at?: string | null
          submitted_by?: string | null
          technician_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_eur?: number
          amount_original?: number
          approved_at?: string | null
          approved_by?: string | null
          category_slug?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          description?: string | null
          expense_date?: string
          fx_rate?: number
          id?: string
          job_id?: string
          permission_id?: string | null
          receipt_path?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          status_history?: Json
          submitted_at?: string | null
          submitted_by?: string | null
          technician_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "job_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_expenses_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "expense_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_milestone_definitions: {
        Row: {
          category: Database["public"]["Enums"]["milestone_category"]
          created_at: string
          description: string | null
          id: string
          is_preset: boolean | null
          job_id: string | null
          name: string
          offset_days: number
          priority: number | null
        }
        Insert: {
          category: Database["public"]["Enums"]["milestone_category"]
          created_at?: string
          description?: string | null
          id?: string
          is_preset?: boolean | null
          job_id?: string | null
          name: string
          offset_days: number
          priority?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["milestone_category"]
          created_at?: string
          description?: string | null
          id?: string
          is_preset?: boolean | null
          job_id?: string | null
          name?: string
          offset_days?: number
          priority?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_milestone_definitions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_milestone_definitions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_milestones: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          definition_id: string | null
          due_date: string
          id: string
          job_id: string
          name: string
          notes: string | null
          offset_days: number
          updated_at: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          definition_id?: string | null
          due_date: string
          id?: string
          job_id: string
          name: string
          notes?: string | null
          offset_days: number
          updated_at?: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          definition_id?: string | null
          due_date?: string
          id?: string
          job_id?: string
          name?: string
          notes?: string | null
          offset_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_milestones_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_milestones_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_milestones_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "milestone_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_milestones_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_milestones_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_project_notes: {
        Row: {
          created_at: string
          created_by: string | null
          job_id: string
          notes: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          job_id: string
          notes?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          job_id?: string
          notes?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_project_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_project_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_project_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_project_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_project_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_project_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_rate_extras: {
        Row: {
          amount_override_eur: number | null
          extra_type: Database["public"]["Enums"]["job_extra_type"]
          job_id: string
          quantity: number
          status: Database["public"]["Enums"]["job_rate_extras_status"]
          technician_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_override_eur?: number | null
          extra_type: Database["public"]["Enums"]["job_extra_type"]
          job_id: string
          quantity?: number
          status?: Database["public"]["Enums"]["job_rate_extras_status"]
          technician_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_override_eur?: number | null
          extra_type?: Database["public"]["Enums"]["job_extra_type"]
          job_id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["job_rate_extras_status"]
          technician_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_rate_extras_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_rate_extras_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_rate_extras_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_rate_extras_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_rehearsal_dates: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          job_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          job_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_rehearsal_dates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_rehearsal_dates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_rehearsal_dates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_rehearsal_dates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_required_roles: {
        Row: {
          created_at: string
          created_by: string | null
          department: string
          id: string
          job_id: string
          notes: string | null
          quantity: number
          role_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department: string
          id?: string
          job_id: string
          notes?: string | null
          quantity?: number
          role_code: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string
          id?: string
          job_id?: string
          notes?: string | null
          quantity?: number
          role_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_required_roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_required_roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_required_roles_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_required_roles_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_required_roles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_required_roles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_stage_plots: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          job_id: string
          plot_data: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          job_id: string
          plot_data: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          job_id?: string
          plot_data?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_stage_plots_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_stage_plots_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_technician_payout_overrides: {
        Row: {
          job_id: string
          override_amount_eur: number
          set_at: string
          set_by: string | null
          technician_id: string
          updated_at: string
        }
        Insert: {
          job_id: string
          override_amount_eur: number
          set_at?: string
          set_by?: string | null
          technician_id: string
          updated_at?: string
        }
        Update: {
          job_id?: string
          override_amount_eur?: number
          set_at?: string
          set_by?: string | null
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_technician_payout_overrides_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_technician_payout_overrides_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_technician_payout_overrides_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_technician_payout_overrides_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_technician_payout_overrides_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_technician_payout_overrides_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_technician_rate_mode_dates: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          job_id: string
          technician_id: string
          updated_at: string
          updated_by: string | null
          use_rehearsal_rate: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          job_id: string
          technician_id: string
          updated_at?: string
          updated_by?: string | null
          use_rehearsal_rate: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          job_id?: string
          technician_id?: string
          updated_at?: string
          updated_by?: string | null
          use_rehearsal_rate?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "job_technician_rate_mode_dates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_technician_rate_mode_dates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_technician_rate_mode_dates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_technician_rate_mode_dates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_technician_rate_mode_dates_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_technician_rate_mode_dates_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_technician_rate_mode_dates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_technician_rate_mode_dates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_whatsapp_group_requests: {
        Row: {
          created_at: string
          department: string
          id: string
          job_id: string
          stage_number: number
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          job_id: string
          stage_number?: number
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          job_id?: string
          stage_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_whatsapp_group_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_whatsapp_group_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_whatsapp_groups: {
        Row: {
          created_at: string
          department: string
          id: string
          job_id: string
          stage_number: number
          wa_group_id: string
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          job_id: string
          stage_number?: number
          wa_group_id: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          job_id?: string
          stage_number?: number
          wa_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_whatsapp_groups_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_whatsapp_groups_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      jobs: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string
          flex_folders_created: boolean | null
          id: string
          invoicing_company:
            | Database["public"]["Enums"]["invoicing_company"]
            | null
          job_type: Database["public"]["Enums"]["job_type"]
          location_id: string | null
          preventive_resource_assigned_at: string | null
          preventive_resource_assigned_by: string | null
          preventive_resource_technician_id: string | null
          rates_approved: boolean
          rates_approved_at: string | null
          rates_approved_by: string | null
          start_time: string
          status: Database["public"]["Enums"]["job_status"] | null
          time_range: unknown
          timezone: string | null
          title: string
          tour_date_id: string | null
          tour_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time: string
          flex_folders_created?: boolean | null
          id?: string
          invoicing_company?:
            | Database["public"]["Enums"]["invoicing_company"]
            | null
          job_type?: Database["public"]["Enums"]["job_type"]
          location_id?: string | null
          preventive_resource_assigned_at?: string | null
          preventive_resource_assigned_by?: string | null
          preventive_resource_technician_id?: string | null
          rates_approved?: boolean
          rates_approved_at?: string | null
          rates_approved_by?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["job_status"] | null
          time_range?: unknown
          timezone?: string | null
          title: string
          tour_date_id?: string | null
          tour_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string
          flex_folders_created?: boolean | null
          id?: string
          invoicing_company?:
            | Database["public"]["Enums"]["invoicing_company"]
            | null
          job_type?: Database["public"]["Enums"]["job_type"]
          location_id?: string | null
          preventive_resource_assigned_at?: string | null
          preventive_resource_assigned_by?: string | null
          preventive_resource_technician_id?: string | null
          rates_approved?: boolean
          rates_approved_at?: string | null
          rates_approved_by?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["job_status"] | null
          time_range?: unknown
          timezone?: string | null
          title?: string
          tour_date_id?: string | null
          tour_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_preventive_resource_assigned_by_fkey"
            columns: ["preventive_resource_assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_preventive_resource_assigned_by_fkey"
            columns: ["preventive_resource_assigned_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_preventive_resource_technician_id_fkey"
            columns: ["preventive_resource_technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_preventive_resource_technician_id_fkey"
            columns: ["preventive_resource_technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_rates_approved_by_fkey"
            columns: ["rates_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_rates_approved_by_fkey"
            columns: ["rates_approved_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_tour_date_id_fkey"
            columns: ["tour_date_id"]
            isOneToOne: false
            referencedRelation: "tour_dates"
            referencedColumns: ["id"]
          },
        ]
      }
      lights_job_personnel: {
        Row: {
          id: string
          job_id: string | null
          lighting_designers: number | null
          lighting_techs: number | null
          riggers: number | null
          spot_ops: number | null
        }
        Insert: {
          id?: string
          job_id?: string | null
          lighting_designers?: number | null
          lighting_techs?: number | null
          riggers?: number | null
          spot_ops?: number | null
        }
        Update: {
          id?: string
          job_id?: string | null
          lighting_designers?: number | null
          lighting_techs?: number | null
          riggers?: number | null
          spot_ops?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lights_job_personnel_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lights_job_personnel_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      lights_job_tasks: {
        Row: {
          assigned_department: string | null
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          completion_source: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          job_id: string | null
          priority: number | null
          progress: number | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          tour_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_department?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_source?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          job_id?: string | null
          priority?: number | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_department?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_source?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          job_id?: string | null
          priority?: number | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type?: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lights_job_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lights_job_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lights_job_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lights_job_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lights_job_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lights_job_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lights_job_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lights_job_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "lights_job_tasks_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      lights_memoria_tecnica_documents: {
        Row: {
          created_at: string | null
          final_document_url: string | null
          id: string
          job_id: string | null
          logo_url: string | null
          material_list_url: string | null
          memoria_completa_url: string | null
          power_report_url: string | null
          project_name: string
          rigging_plot_url: string | null
          soundvision_report_url: string | null
          updated_at: string | null
          weight_report_url: string | null
        }
        Insert: {
          created_at?: string | null
          final_document_url?: string | null
          id?: string
          job_id?: string | null
          logo_url?: string | null
          material_list_url?: string | null
          memoria_completa_url?: string | null
          power_report_url?: string | null
          project_name: string
          rigging_plot_url?: string | null
          soundvision_report_url?: string | null
          updated_at?: string | null
          weight_report_url?: string | null
        }
        Update: {
          created_at?: string | null
          final_document_url?: string | null
          id?: string
          job_id?: string | null
          logo_url?: string | null
          material_list_url?: string | null
          memoria_completa_url?: string | null
          power_report_url?: string | null
          project_name?: string
          rigging_plot_url?: string | null
          soundvision_report_url?: string | null
          updated_at?: string | null
          weight_report_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lights_memoria_tecnica_documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lights_memoria_tecnica_documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          formatted_address: string | null
          google_place_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          photo_reference: string | null
        }
        Insert: {
          created_at?: string
          formatted_address?: string | null
          google_place_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          photo_reference?: string | null
        }
        Update: {
          created_at?: string
          formatted_address?: string | null
          google_place_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          photo_reference?: string | null
        }
        Relationships: []
      }
      logistics_event_departments: {
        Row: {
          department: string
          event_id: string
        }
        Insert: {
          department: string
          event_id: string
        }
        Update: {
          department?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_event_departments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "logistics_events"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_events: {
        Row: {
          color: string | null
          created_at: string | null
          event_date: string
          event_time: string
          event_type: Database["public"]["Enums"]["logistics_event_type"]
          hoja_categories: Database["public"]["Enums"]["logistics_transport_category"][]
          id: string
          is_hoja_relevant: boolean
          job_id: string | null
          license_plate: string | null
          loading_bay: string | null
          notes: string | null
          timezone: string | null
          title: string | null
          transport_provider:
            | Database["public"]["Enums"]["transport_provider_enum"]
            | null
          transport_type: Database["public"]["Enums"]["transport_type"]
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          event_date: string
          event_time: string
          event_type: Database["public"]["Enums"]["logistics_event_type"]
          hoja_categories?: Database["public"]["Enums"]["logistics_transport_category"][]
          id?: string
          is_hoja_relevant?: boolean
          job_id?: string | null
          license_plate?: string | null
          loading_bay?: string | null
          notes?: string | null
          timezone?: string | null
          title?: string | null
          transport_provider?:
            | Database["public"]["Enums"]["transport_provider_enum"]
            | null
          transport_type: Database["public"]["Enums"]["transport_type"]
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          event_date?: string
          event_time?: string
          event_type?: Database["public"]["Enums"]["logistics_event_type"]
          hoja_categories?: Database["public"]["Enums"]["logistics_transport_category"][]
          id?: string
          is_hoja_relevant?: boolean
          job_id?: string | null
          license_plate?: string | null
          loading_bay?: string | null
          notes?: string | null
          timezone?: string | null
          title?: string | null
          transport_provider?:
            | Database["public"]["Enums"]["transport_provider_enum"]
            | null
          transport_type?: Database["public"]["Enums"]["transport_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logistics_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      madrid_holidays: {
        Row: {
          created_at: string | null
          date: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      memoria_tecnica_documents: {
        Row: {
          cover_page_url: string | null
          created_at: string | null
          final_document_url: string | null
          id: string
          job_id: string | null
          logo_url: string | null
          material_list_url: string | null
          power_report_url: string | null
          project_name: string
          rigging_plot_url: string | null
          soundvision_report_url: string | null
          updated_at: string | null
          weight_report_url: string | null
        }
        Insert: {
          cover_page_url?: string | null
          created_at?: string | null
          final_document_url?: string | null
          id?: string
          job_id?: string | null
          logo_url?: string | null
          material_list_url?: string | null
          power_report_url?: string | null
          project_name: string
          rigging_plot_url?: string | null
          soundvision_report_url?: string | null
          updated_at?: string | null
          weight_report_url?: string | null
        }
        Update: {
          cover_page_url?: string | null
          created_at?: string | null
          final_document_url?: string | null
          id?: string
          job_id?: string | null
          logo_url?: string | null
          material_list_url?: string | null
          power_report_url?: string | null
          project_name?: string
          rigging_plot_url?: string | null
          soundvision_report_url?: string | null
          updated_at?: string | null
          weight_report_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memoria_tecnica_documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memoria_tecnica_documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          department: string
          id: string
          metadata: Json | null
          sender_id: string
          status: Database["public"]["Enums"]["message_status"]
        }
        Insert: {
          content: string
          created_at?: string
          department: string
          id?: string
          metadata?: Json | null
          sender_id: string
          status?: Database["public"]["Enums"]["message_status"]
        }
        Update: {
          content?: string
          created_at?: string
          department?: string
          id?: string
          metadata?: Json | null
          sender_id?: string
          status?: Database["public"]["Enums"]["message_status"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_definitions: {
        Row: {
          category: Database["public"]["Enums"]["milestone_category"]
          created_at: string
          default_offset: number
          department: string[] | null
          description: string | null
          id: string
          name: string
          priority: number | null
        }
        Insert: {
          category: Database["public"]["Enums"]["milestone_category"]
          created_at?: string
          default_offset: number
          department?: string[] | null
          description?: string | null
          id?: string
          name: string
          priority?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["milestone_category"]
          created_at?: string
          default_offset?: number
          department?: string[] | null
          description?: string | null
          id?: string
          name?: string
          priority?: number | null
        }
        Relationships: []
      }
      morning_summary_subscriptions: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          subscribed_departments: string[]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          subscribed_departments?: string[]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          subscribed_departments?: string[]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "morning_summary_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "morning_summary_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          assignments: boolean | null
          created_at: string | null
          form_submissions: boolean | null
          gear_movements: boolean | null
          id: string
          messages: boolean | null
          staffing_scope:
            | Database["public"]["Enums"]["staffing_notification_scope"]
            | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assignments?: boolean | null
          created_at?: string | null
          form_submissions?: boolean | null
          gear_movements?: boolean | null
          id?: string
          messages?: boolean | null
          staffing_scope?:
            | Database["public"]["Enums"]["staffing_notification_scope"]
            | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assignments?: boolean | null
          created_at?: string | null
          form_submissions?: boolean | null
          gear_movements?: boolean | null
          id?: string
          messages?: boolean | null
          staffing_scope?:
            | Database["public"]["Enums"]["staffing_notification_scope"]
            | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_subscriptions: {
        Row: {
          auth_key: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh_key: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auth_key: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh_key: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auth_key?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh_key?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      power_requirement_tables: {
        Row: {
          created_at: string | null
          current_per_phase: number
          custom_pdu_type: string | null
          custom_position: string | null
          department: string | null
          id: string
          includes_hoist: boolean | null
          job_id: string | null
          pdu_type: string
          position: string | null
          stage_name: string | null
          stage_number: number | null
          table_data: Json
          table_name: string
          total_watts: number
        }
        Insert: {
          created_at?: string | null
          current_per_phase: number
          custom_pdu_type?: string | null
          custom_position?: string | null
          department?: string | null
          id?: string
          includes_hoist?: boolean | null
          job_id?: string | null
          pdu_type: string
          position?: string | null
          stage_name?: string | null
          stage_number?: number | null
          table_data?: Json
          table_name: string
          total_watts: number
        }
        Update: {
          created_at?: string | null
          current_per_phase?: number
          custom_pdu_type?: string | null
          custom_position?: string | null
          department?: string | null
          id?: string
          includes_hoist?: boolean | null
          job_id?: string | null
          pdu_type?: string
          position?: string | null
          stage_name?: string | null
          stage_number?: number | null
          table_data?: Json
          table_name?: string
          total_watts?: number
        }
        Relationships: [
          {
            foreignKeyName: "power_requirement_tables_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "power_requirement_tables_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      preset_items: {
        Row: {
          created_at: string | null
          equipment_id: string
          id: string
          notes: string | null
          preset_id: string
          quantity: number
          source: string | null
          subsystem: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          equipment_id: string
          id?: string
          notes?: string | null
          preset_id: string
          quantity?: number
          source?: string | null
          subsystem?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          equipment_id?: string
          id?: string
          notes?: string | null
          preset_id?: string
          quantity?: number
          source?: string | null
          subsystem?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preset_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "current_stock_levels"
            referencedColumns: ["equipment_id"]
          },
          {
            foreignKeyName: "preset_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preset_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_availability_with_rentals"
            referencedColumns: ["equipment_id"]
          },
          {
            foreignKeyName: "preset_items_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "presets"
            referencedColumns: ["id"]
          },
        ]
      }
      presets: {
        Row: {
          created_at: string | null
          created_by: string | null
          department: string
          id: string
          is_template: boolean | null
          job_id: string | null
          name: string
          tour_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          department?: string
          id?: string
          is_template?: boolean | null
          job_id?: string | null
          name: string
          tour_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          department?: string
          id?: string
          is_template?: boolean | null
          job_id?: string | null
          name?: string
          tour_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "presets_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      production_job_tasks: {
        Row: {
          assigned_department: string | null
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          completion_source: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          job_id: string | null
          priority: number | null
          progress: number | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          tour_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_department?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_source?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          job_id?: string | null
          priority?: number | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_department?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_source?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          job_id?: string | null
          priority?: number | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type?: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_job_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_job_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_job_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_job_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_job_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_job_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_job_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_job_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "production_job_tasks_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_skills: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          notes: string | null
          proficiency: number | null
          profile_id: string
          skill_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          proficiency?: number | null
          profile_id: string
          skill_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          proficiency?: number | null
          profile_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assignable_as_tech: boolean
          autonomo: boolean
          bg_color: string | null
          calendar_ics_token: string | null
          created_at: string
          custom_folder_structure: Json | null
          custom_tour_folder_structure: Json | null
          dark_mode: boolean | null
          default_timesheet_category: string | null
          department: string | null
          dni: string | null
          email: string
          first_name: string | null
          flex_id: string | null
          flex_resource_id: string | null
          flex_user_id: string | null
          home_latitude: number | null
          home_longitude: number | null
          id: string
          last_activity: string | null
          last_name: string | null
          nickname: string | null
          phone: string | null
          profile_picture_url: string | null
          push_notifications_enabled: boolean | null
          residencia: string | null
          role: Database["public"]["Enums"]["user_role"]
          selected_job_statuses: string[] | null
          selected_job_types: string[] | null
          soundvision_access_enabled: boolean | null
          time_span: string | null
          timezone: string | null
          tours_expanded: boolean | null
          waha_endpoint: string | null
          warehouse_duty_exempt: boolean
        }
        Insert: {
          assignable_as_tech?: boolean
          autonomo?: boolean
          bg_color?: string | null
          calendar_ics_token?: string | null
          created_at?: string
          custom_folder_structure?: Json | null
          custom_tour_folder_structure?: Json | null
          dark_mode?: boolean | null
          default_timesheet_category?: string | null
          department?: string | null
          dni?: string | null
          email: string
          first_name?: string | null
          flex_id?: string | null
          flex_resource_id?: string | null
          flex_user_id?: string | null
          home_latitude?: number | null
          home_longitude?: number | null
          id: string
          last_activity?: string | null
          last_name?: string | null
          nickname?: string | null
          phone?: string | null
          profile_picture_url?: string | null
          push_notifications_enabled?: boolean | null
          residencia?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          selected_job_statuses?: string[] | null
          selected_job_types?: string[] | null
          soundvision_access_enabled?: boolean | null
          time_span?: string | null
          timezone?: string | null
          tours_expanded?: boolean | null
          waha_endpoint?: string | null
          warehouse_duty_exempt?: boolean
        }
        Update: {
          assignable_as_tech?: boolean
          autonomo?: boolean
          bg_color?: string | null
          calendar_ics_token?: string | null
          created_at?: string
          custom_folder_structure?: Json | null
          custom_tour_folder_structure?: Json | null
          dark_mode?: boolean | null
          default_timesheet_category?: string | null
          department?: string | null
          dni?: string | null
          email?: string
          first_name?: string | null
          flex_id?: string | null
          flex_resource_id?: string | null
          flex_user_id?: string | null
          home_latitude?: number | null
          home_longitude?: number | null
          id?: string
          last_activity?: string | null
          last_name?: string | null
          nickname?: string | null
          phone?: string | null
          profile_picture_url?: string | null
          push_notifications_enabled?: boolean | null
          residencia?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          selected_job_statuses?: string[] | null
          selected_job_types?: string[] | null
          soundvision_access_enabled?: boolean | null
          time_span?: string | null
          timezone?: string | null
          tours_expanded?: boolean | null
          waha_endpoint?: string | null
          warehouse_duty_exempt?: boolean
        }
        Relationships: []
      }
      push_cron_config: {
        Row: {
          id: number
          service_role_key: string | null
          supabase_url: string
          updated_at: string | null
        }
        Insert: {
          id?: number
          service_role_key?: string | null
          supabase_url: string
          updated_at?: string | null
        }
        Update: {
          id?: number
          service_role_key?: string | null
          supabase_url?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      push_cron_execution_log: {
        Row: {
          error_message: string | null
          event_type: string
          executed_at: string | null
          id: number
          request_id: number | null
          success: boolean | null
        }
        Insert: {
          error_message?: string | null
          event_type: string
          executed_at?: string | null
          id?: number
          request_id?: number | null
          success?: boolean | null
        }
        Update: {
          error_message?: string | null
          event_type?: string
          executed_at?: string | null
          id?: number
          request_id?: number | null
          success?: boolean | null
        }
        Relationships: []
      }
      push_device_tokens: {
        Row: {
          created_at: string | null
          device_id: string | null
          device_name: string | null
          device_token: string
          id: string
          last_seen_at: string | null
          platform: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_id?: string | null
          device_name?: string | null
          device_token: string
          id?: string
          last_seen_at?: string | null
          platform: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_id?: string | null
          device_name?: string | null
          device_token?: string
          id?: string
          last_seen_at?: string | null
          platform?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_notification_routes: {
        Row: {
          created_at: string
          event_code: string
          id: string
          include_natural_recipients: boolean
          recipient_type: Database["public"]["Enums"]["push_notification_recipient_type"]
          target_id: string | null
        }
        Insert: {
          created_at?: string
          event_code: string
          id?: string
          include_natural_recipients?: boolean
          recipient_type: Database["public"]["Enums"]["push_notification_recipient_type"]
          target_id?: string | null
        }
        Update: {
          created_at?: string
          event_code?: string
          id?: string
          include_natural_recipients?: boolean
          recipient_type?: Database["public"]["Enums"]["push_notification_recipient_type"]
          target_id?: string | null
        }
        Relationships: []
      }
      push_notification_schedules: {
        Row: {
          created_at: string | null
          days_of_week: number[] | null
          enabled: boolean | null
          event_type: string
          id: string
          last_sent_at: string | null
          schedule_time: string
          timezone: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          days_of_week?: number[] | null
          enabled?: boolean | null
          event_type: string
          id?: string
          last_sent_at?: string | null
          schedule_time?: string
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          days_of_week?: number[] | null
          enabled?: boolean | null
          event_type?: string
          id?: string
          last_sent_at?: string | null
          schedule_time?: string
          timezone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string
          endpoint: string
          expiration_time: number | null
          id: string
          last_seen_at: string
          p256dh: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth?: string | null
          created_at?: string
          endpoint: string
          expiration_time?: number | null
          id?: string
          last_seen_at?: string
          p256dh?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string | null
          created_at?: string
          endpoint?: string
          expiration_time?: number | null
          id?: string
          last_seen_at?: string
          p256dh?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_cards_2025: {
        Row: {
          base_day_eur: number
          base_day_hours: number
          category: string
          id: string
          mid_tier_hours: number
          overtime_hour_eur: number
          plus_10_12_eur: number
        }
        Insert: {
          base_day_eur: number
          base_day_hours?: number
          category: string
          id?: string
          mid_tier_hours?: number
          overtime_hour_eur: number
          plus_10_12_eur: number
        }
        Update: {
          base_day_eur?: number
          base_day_hours?: number
          category?: string
          id?: string
          mid_tier_hours?: number
          overtime_hour_eur?: number
          plus_10_12_eur?: number
        }
        Relationships: []
      }
      rate_cards_tour_2025: {
        Row: {
          base_day_eur: number
          category: string
        }
        Insert: {
          base_day_eur: number
          category: string
        }
        Update: {
          base_day_eur?: number
          category?: string
        }
        Relationships: []
      }
      rate_extras_2025: {
        Row: {
          amount_eur: number
          extra_type: Database["public"]["Enums"]["job_extra_type"]
        }
        Insert: {
          amount_eur: number
          extra_type: Database["public"]["Enums"]["job_extra_type"]
        }
        Update: {
          amount_eur?: number
          extra_type?: Database["public"]["Enums"]["job_extra_type"]
        }
        Relationships: []
      }
      required_docs: {
        Row: {
          department: string
          id: number
          is_required: boolean
          key: string
          label: string
        }
        Insert: {
          department: string
          id?: number
          is_required?: boolean
          key: string
          label: string
        }
        Update: {
          department?: string
          id?: number
          is_required?: boolean
          key?: string
          label?: string
        }
        Relationships: []
      }
      role_skill_mapping: {
        Row: {
          created_at: string
          id: string
          role_prefix: string
          skill_name: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          role_prefix: string
          skill_name: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          role_prefix?: string
          skill_name?: string
          weight?: number
        }
        Relationships: []
      }
      secrets: {
        Row: {
          created_at: string
          id: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json
          resource: string
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          resource: string
          severity: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          resource?: string
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      skills: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      sound_job_personnel: {
        Row: {
          foh_engineers: number | null
          id: string
          job_id: string | null
          mon_engineers: number | null
          pa_techs: number | null
          rf_techs: number | null
        }
        Insert: {
          foh_engineers?: number | null
          id?: string
          job_id?: string | null
          mon_engineers?: number | null
          pa_techs?: number | null
          rf_techs?: number | null
        }
        Update: {
          foh_engineers?: number | null
          id?: string
          job_id?: string | null
          mon_engineers?: number | null
          pa_techs?: number | null
          rf_techs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sound_job_personnel_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sound_job_personnel_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      sound_job_tasks: {
        Row: {
          assigned_department: string | null
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          completion_source: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          job_id: string | null
          priority: number | null
          progress: number | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          tour_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_department?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_source?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          job_id?: string | null
          priority?: number | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_department?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_source?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          job_id?: string | null
          priority?: number | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type?: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sound_job_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sound_job_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sound_job_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sound_job_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sound_job_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sound_job_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sound_job_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sound_job_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "sound_job_tasks_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      soundvision_file_reviews: {
        Row: {
          created_at: string
          file_id: string
          id: string
          is_initial: boolean
          rating: number
          review: string | null
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_id: string
          id?: string
          is_initial?: boolean
          rating: number
          review?: string | null
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_id?: string
          id?: string
          is_initial?: boolean
          rating?: number
          review?: string | null
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "soundvision_file_reviews_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "soundvision_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soundvision_file_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soundvision_file_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      soundvision_files: {
        Row: {
          average_rating: number | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          last_reviewed_at: string | null
          metadata: Json | null
          notes: string | null
          rating_total: number
          ratings_count: number
          uploaded_at: string
          uploaded_by: string | null
          venue_id: string
        }
        Insert: {
          average_rating?: number | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          last_reviewed_at?: string | null
          metadata?: Json | null
          notes?: string | null
          rating_total?: number
          ratings_count?: number
          uploaded_at?: string
          uploaded_by?: string | null
          venue_id: string
        }
        Update: {
          average_rating?: number | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          last_reviewed_at?: string | null
          metadata?: Json | null
          notes?: string | null
          rating_total?: number
          ratings_count?: number
          uploaded_at?: string
          uploaded_by?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "soundvision_files_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_campaign_events: {
        Row: {
          campaign_id: string
          created_at: string | null
          final_score: number | null
          id: string
          phase: string
          profile_id: string | null
          reasons: Json | null
          role_code: string | null
          score_breakdown: Json | null
          wave_number: number | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          final_score?: number | null
          id?: string
          phase: string
          profile_id?: string | null
          reasons?: Json | null
          role_code?: string | null
          score_breakdown?: Json | null
          wave_number?: number | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          final_score?: number | null
          id?: string
          phase?: string
          profile_id?: string | null
          reasons?: Json | null
          role_code?: string | null
          score_breakdown?: Json | null
          wave_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "staffing_campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "staffing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_campaign_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_campaign_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_campaign_roles: {
        Row: {
          accepted_offers: number
          assigned_count: number
          availability_cutoff: string | null
          campaign_id: string
          confirmed_availability: number
          id: string
          last_wave_at: string | null
          offer_cutoff: string | null
          pending_availability: number
          pending_offers: number
          role_code: string
          stage: string
          updated_at: string | null
          wave_number: number | null
        }
        Insert: {
          accepted_offers?: number
          assigned_count?: number
          availability_cutoff?: string | null
          campaign_id: string
          confirmed_availability?: number
          id?: string
          last_wave_at?: string | null
          offer_cutoff?: string | null
          pending_availability?: number
          pending_offers?: number
          role_code: string
          stage?: string
          updated_at?: string | null
          wave_number?: number | null
        }
        Update: {
          accepted_offers?: number
          assigned_count?: number
          availability_cutoff?: string | null
          campaign_id?: string
          confirmed_availability?: number
          id?: string
          last_wave_at?: string | null
          offer_cutoff?: string | null
          pending_availability?: number
          pending_offers?: number
          role_code?: string
          stage?: string
          updated_at?: string | null
          wave_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "staffing_campaign_roles_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "staffing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_campaigns: {
        Row: {
          created_at: string | null
          created_by: string | null
          department: string
          id: string
          job_id: string
          last_run_at: string | null
          mode: string
          next_run_at: string | null
          offer_message: string | null
          policy: Json
          run_lock: string | null
          status: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          department: string
          id?: string
          job_id: string
          last_run_at?: string | null
          mode: string
          next_run_at?: string | null
          offer_message?: string | null
          policy: Json
          run_lock?: string | null
          status?: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          department?: string
          id?: string
          job_id?: string
          last_run_at?: string | null
          mode?: string
          next_run_at?: string | null
          offer_message?: string | null
          policy?: Json
          run_lock?: string | null
          status?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "staffing_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_campaigns_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_campaigns_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      staffing_events: {
        Row: {
          created_at: string
          event: string
          id: string
          meta: Json | null
          staffing_request_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          meta?: Json | null
          staffing_request_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          meta?: Json | null
          staffing_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_events_staffing_request_id_fkey"
            columns: ["staffing_request_id"]
            isOneToOne: false
            referencedRelation: "staffing_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_requests: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          job_id: string
          phase: string
          profile_id: string
          requested_by: string | null
          role_code: string | null
          single_day: boolean
          status: string
          target_date: string | null
          token_expires_at: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          job_id: string
          phase: string
          profile_id: string
          requested_by?: string | null
          role_code?: string | null
          single_day?: boolean
          status: string
          target_date?: string | null
          token_expires_at: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          job_id?: string
          phase?: string
          profile_id?: string
          requested_by?: string | null
          role_code?: string | null
          single_day?: boolean
          status?: string
          target_date?: string | null
          token_expires_at?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_staffing_requests_requested_by"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_staffing_requests_requested_by"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "staffing_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string | null
          equipment_id: string
          id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          equipment_id: string
          id?: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          quantity: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          equipment_id?: string
          id?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "current_stock_levels"
            referencedColumns: ["equipment_id"]
          },
          {
            foreignKeyName: "stock_movements_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_availability_with_rentals"
            referencedColumns: ["equipment_id"]
          },
        ]
      }
      sub_rentals: {
        Row: {
          batch_id: string
          created_at: string | null
          created_by: string | null
          department: string
          end_date: string
          equipment_id: string
          id: string
          is_stock_extension: boolean | null
          job_id: string | null
          notes: string | null
          quantity: number
          start_date: string
          updated_at: string | null
        }
        Insert: {
          batch_id?: string
          created_at?: string | null
          created_by?: string | null
          department?: string
          end_date: string
          equipment_id: string
          id?: string
          is_stock_extension?: boolean | null
          job_id?: string | null
          notes?: string | null
          quantity: number
          start_date: string
          updated_at?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          created_by?: string | null
          department?: string
          end_date?: string
          equipment_id?: string
          id?: string
          is_stock_extension?: boolean | null
          job_id?: string | null
          notes?: string | null
          quantity?: number
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sub_rentals_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "current_stock_levels"
            referencedColumns: ["equipment_id"]
          },
          {
            foreignKeyName: "sub_rentals_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_rentals_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_availability_with_rentals"
            referencedColumns: ["equipment_id"]
          },
          {
            foreignKeyName: "sub_rentals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_rentals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      system_errors: {
        Row: {
          context: Json | null
          created_at: string | null
          error_message: string | null
          error_type: string
          id: string
          system: string
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          error_message?: string | null
          error_type: string
          id?: string
          system: string
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          error_message?: string | null
          error_type?: string
          id?: string
          system?: string
          user_id?: string | null
        }
        Relationships: []
      }
      task_documents: {
        Row: {
          administrative_task_id: string | null
          file_name: string
          file_path: string
          id: string
          lights_task_id: string | null
          production_task_id: string | null
          sound_task_id: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          video_task_id: string | null
        }
        Insert: {
          administrative_task_id?: string | null
          file_name: string
          file_path: string
          id?: string
          lights_task_id?: string | null
          production_task_id?: string | null
          sound_task_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          video_task_id?: string | null
        }
        Update: {
          administrative_task_id?: string | null
          file_name?: string
          file_path?: string
          id?: string
          lights_task_id?: string | null
          production_task_id?: string | null
          sound_task_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          video_task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_documents_administrative_task_id_fkey"
            columns: ["administrative_task_id"]
            isOneToOne: false
            referencedRelation: "administrative_job_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_documents_lights_task_id_fkey"
            columns: ["lights_task_id"]
            isOneToOne: false
            referencedRelation: "lights_job_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_documents_production_task_id_fkey"
            columns: ["production_task_id"]
            isOneToOne: false
            referencedRelation: "production_job_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_documents_sound_task_id_fkey"
            columns: ["sound_task_id"]
            isOneToOne: false
            referencedRelation: "sound_job_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_documents_video_task_id_fkey"
            columns: ["video_task_id"]
            isOneToOne: false
            referencedRelation: "video_job_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_tool_quick_presets: {
        Row: {
          created_at: string
          created_by: string | null
          department: Database["public"]["Enums"]["department"]
          id: string
          name: string
          tables: Json
          tool: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department: Database["public"]["Enums"]["department"]
          id?: string
          name: string
          tables: Json
          tool: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: Database["public"]["Enums"]["department"]
          id?: string
          name?: string
          tables?: Json
          tool?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_tool_quick_presets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_tool_quick_presets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_availability: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          id: number
          status: string
          technician_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          id?: number
          status: string
          technician_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: number
          status?: string
          technician_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      technician_departments: {
        Row: {
          technician_id: string
        }
        Insert: {
          technician_id: string
        }
        Update: {
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_departments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_departments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: true
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_fridge: {
        Row: {
          created_at: string
          created_by: string | null
          in_fridge: boolean
          reason: string | null
          technician_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          in_fridge?: boolean
          reason?: string | null
          technician_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          in_fridge?: boolean
          reason?: string | null
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_fridge_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_fridge_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: true
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_work_records: {
        Row: {
          break_duration: number | null
          created_at: string | null
          end_time: string
          id: string
          job_id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          signature_date: string | null
          signature_url: string | null
          start_time: string
          status: string | null
          technician_id: string
          total_hours: number
          updated_at: string | null
          work_date: string
        }
        Insert: {
          break_duration?: number | null
          created_at?: string | null
          end_time: string
          id?: string
          job_id: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature_date?: string | null
          signature_url?: string | null
          start_time: string
          status?: string | null
          technician_id: string
          total_hours: number
          updated_at?: string | null
          work_date: string
        }
        Update: {
          break_duration?: number | null
          created_at?: string | null
          end_time?: string
          id?: string
          job_id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature_date?: string | null
          signature_url?: string | null
          start_time?: string
          status?: string | null
          technician_id?: string
          total_hours?: number
          updated_at?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_work_records_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_work_records_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      timesheet_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          timesheet_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          timesheet_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          timesheet_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_audit_log_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_reminder_settings: {
        Row: {
          auto_reminders_enabled: boolean
          department: string
          id: string
          reminder_frequency_days: number
          updated_at: string
        }
        Insert: {
          auto_reminders_enabled?: boolean
          department: string
          id?: string
          reminder_frequency_days?: number
          updated_at?: string
        }
        Update: {
          auto_reminders_enabled?: boolean
          department?: string
          id?: string
          reminder_frequency_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      timesheets: {
        Row: {
          amount_breakdown: Json | null
          amount_eur: number | null
          approved_at: string | null
          approved_by: string | null
          approved_by_manager: boolean | null
          auto_reminder_count: number
          break_minutes: number | null
          category: string | null
          created_at: string
          created_by: string | null
          date: string
          end_time: string | null
          ends_next_day: boolean | null
          id: string
          is_active: boolean
          is_schedule_only: boolean | null
          job_id: string
          notes: string | null
          overtime_hours: number | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          reminder_sent_at: string | null
          signature_data: string | null
          signed_at: string | null
          source: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["timesheet_status"]
          technician_id: string
          updated_at: string
          version: number
        }
        Insert: {
          amount_breakdown?: Json | null
          amount_eur?: number | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_manager?: boolean | null
          auto_reminder_count?: number
          break_minutes?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          end_time?: string | null
          ends_next_day?: boolean | null
          id?: string
          is_active?: boolean
          is_schedule_only?: boolean | null
          job_id: string
          notes?: string | null
          overtime_hours?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          reminder_sent_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          source?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["timesheet_status"]
          technician_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          amount_breakdown?: Json | null
          amount_eur?: number | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_manager?: boolean | null
          auto_reminder_count?: number
          break_minutes?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          end_time?: string | null
          ends_next_day?: boolean | null
          id?: string
          is_active?: boolean
          is_schedule_only?: boolean | null
          job_id?: string
          notes?: string | null
          overtime_hours?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          reminder_sent_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          source?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["timesheet_status"]
          technician_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_timesheets_approved_by"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_timesheets_approved_by"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_timesheets_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_timesheets_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_timesheets_job_id"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_timesheets_job_id"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "fk_timesheets_technician_id"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_timesheets_technician_id"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_accommodations: {
        Row: {
          breakfast_included: boolean | null
          check_in_date: string
          check_out_date: string
          confirmation_number: string | null
          created_at: string | null
          created_by: string | null
          hotel_address: string | null
          hotel_email: string | null
          hotel_name: string
          hotel_phone: string | null
          hotel_website: string | null
          id: string
          latitude: number | null
          location_id: string | null
          longitude: number | null
          notes: string | null
          parking_available: boolean | null
          rate_per_room_eur: number | null
          room_allocation: Json | null
          room_type: string | null
          rooms_booked: number | null
          special_requests: string | null
          status: string | null
          total_cost_eur: number | null
          tour_date_id: string | null
          tour_id: string
          updated_at: string | null
          wifi_available: boolean | null
        }
        Insert: {
          breakfast_included?: boolean | null
          check_in_date: string
          check_out_date: string
          confirmation_number?: string | null
          created_at?: string | null
          created_by?: string | null
          hotel_address?: string | null
          hotel_email?: string | null
          hotel_name: string
          hotel_phone?: string | null
          hotel_website?: string | null
          id?: string
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          notes?: string | null
          parking_available?: boolean | null
          rate_per_room_eur?: number | null
          room_allocation?: Json | null
          room_type?: string | null
          rooms_booked?: number | null
          special_requests?: string | null
          status?: string | null
          total_cost_eur?: number | null
          tour_date_id?: string | null
          tour_id: string
          updated_at?: string | null
          wifi_available?: boolean | null
        }
        Update: {
          breakfast_included?: boolean | null
          check_in_date?: string
          check_out_date?: string
          confirmation_number?: string | null
          created_at?: string | null
          created_by?: string | null
          hotel_address?: string | null
          hotel_email?: string | null
          hotel_name?: string
          hotel_phone?: string | null
          hotel_website?: string | null
          id?: string
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          notes?: string | null
          parking_available?: boolean | null
          rate_per_room_eur?: number | null
          room_allocation?: Json | null
          room_type?: string | null
          rooms_booked?: number | null
          special_requests?: string | null
          status?: string | null
          total_cost_eur?: number | null
          tour_date_id?: string | null
          tour_id?: string
          updated_at?: string | null
          wifi_available?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_accommodations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_accommodations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_accommodations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_accommodations_tour_date_id_fkey"
            columns: ["tour_date_id"]
            isOneToOne: false
            referencedRelation: "tour_dates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_accommodations_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          department: string
          external_technician_name: string | null
          id: string
          notes: string | null
          role: string
          technician_id: string | null
          tour_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          department: string
          external_technician_name?: string | null
          id?: string
          notes?: string | null
          role: string
          technician_id?: string | null
          tour_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          department?: string
          external_technician_name?: string | null
          id?: string
          notes?: string | null
          role?: string
          technician_id?: string | null
          tour_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_assignments_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_date_power_overrides: {
        Row: {
          created_at: string | null
          current_per_phase: number
          custom_pdu_type: string | null
          custom_position: string | null
          default_table_id: string | null
          department: string | null
          id: string
          includes_hoist: boolean | null
          override_data: Json | null
          pdu_type: string
          position: string | null
          table_name: string
          total_watts: number
          tour_date_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_per_phase: number
          custom_pdu_type?: string | null
          custom_position?: string | null
          default_table_id?: string | null
          department?: string | null
          id?: string
          includes_hoist?: boolean | null
          override_data?: Json | null
          pdu_type: string
          position?: string | null
          table_name: string
          total_watts: number
          tour_date_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_per_phase?: number
          custom_pdu_type?: string | null
          custom_position?: string | null
          default_table_id?: string | null
          department?: string | null
          id?: string
          includes_hoist?: boolean | null
          override_data?: Json | null
          pdu_type?: string
          position?: string | null
          table_name?: string
          total_watts?: number
          tour_date_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_date_power_overrides_default_table_id_fkey"
            columns: ["default_table_id"]
            isOneToOne: false
            referencedRelation: "tour_default_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_date_power_overrides_tour_date_id_fkey"
            columns: ["tour_date_id"]
            isOneToOne: false
            referencedRelation: "tour_dates"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_date_weight_overrides: {
        Row: {
          category: string | null
          created_at: string | null
          default_table_id: string | null
          department: string | null
          id: string
          item_name: string
          override_data: Json | null
          quantity: number | null
          tour_date_id: string
          updated_at: string | null
          weight_kg: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          default_table_id?: string | null
          department?: string | null
          id?: string
          item_name: string
          override_data?: Json | null
          quantity?: number | null
          tour_date_id: string
          updated_at?: string | null
          weight_kg: number
        }
        Update: {
          category?: string | null
          created_at?: string | null
          default_table_id?: string | null
          department?: string | null
          id?: string
          item_name?: string
          override_data?: Json | null
          quantity?: number | null
          tour_date_id?: string
          updated_at?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "tour_date_weight_overrides_default_table_id_fkey"
            columns: ["default_table_id"]
            isOneToOne: false
            referencedRelation: "tour_default_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_date_weight_overrides_tour_date_id_fkey"
            columns: ["tour_date_id"]
            isOneToOne: false
            referencedRelation: "tour_dates"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_dates: {
        Row: {
          created_at: string
          date: string
          end_date: string
          flex_folders_created: boolean | null
          id: string
          is_tour_pack_only: boolean | null
          lights_default_set_id: string | null
          lights_package_size: "xl" | "l" | "m" | "s" | null
          location_id: string | null
          rehearsal_days: number | null
          sound_default_set_id: string | null
          sound_package_size: "xl" | "l" | "m" | "s" | null
          start_date: string
          tour_date_type: Database["public"]["Enums"]["tour_date_type"] | null
          tour_id: string | null
          video_default_set_id: string | null
          video_package_size: "xl" | "l" | "m" | "s" | null
        }
        Insert: {
          created_at?: string
          date: string
          end_date: string
          flex_folders_created?: boolean | null
          id?: string
          is_tour_pack_only?: boolean | null
          lights_default_set_id?: string | null
          lights_package_size?: "xl" | "l" | "m" | "s" | null
          location_id?: string | null
          rehearsal_days?: number | null
          sound_default_set_id?: string | null
          sound_package_size?: "xl" | "l" | "m" | "s" | null
          start_date: string
          tour_date_type?: Database["public"]["Enums"]["tour_date_type"] | null
          tour_id?: string | null
          video_default_set_id?: string | null
          video_package_size?: "xl" | "l" | "m" | "s" | null
        }
        Update: {
          created_at?: string
          date?: string
          end_date?: string
          flex_folders_created?: boolean | null
          id?: string
          is_tour_pack_only?: boolean | null
          lights_default_set_id?: string | null
          lights_package_size?: "xl" | "l" | "m" | "s" | null
          location_id?: string | null
          rehearsal_days?: number | null
          sound_default_set_id?: string | null
          sound_package_size?: "xl" | "l" | "m" | "s" | null
          start_date?: string
          tour_date_type?: Database["public"]["Enums"]["tour_date_type"] | null
          tour_id?: string | null
          video_default_set_id?: string | null
          video_package_size?: "xl" | "l" | "m" | "s" | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_dates_lights_default_set_id_fkey"
            columns: ["lights_default_set_id"]
            isOneToOne: false
            referencedRelation: "tour_default_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_dates_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_dates_sound_default_set_id_fkey"
            columns: ["sound_default_set_id"]
            isOneToOne: false
            referencedRelation: "tour_default_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_dates_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_dates_video_default_set_id_fkey"
            columns: ["video_default_set_id"]
            isOneToOne: false
            referencedRelation: "tour_default_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_default_sets: {
        Row: {
          created_at: string
          department: string | null
          description: string | null
          id: string
          name: string
          package_size: "xl" | "l" | "m" | "s" | null
          tour_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          name: string
          package_size?: "xl" | "l" | "m" | "s" | null
          tour_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          name?: string
          package_size?: "xl" | "l" | "m" | "s" | null
          tour_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_default_sets_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_default_tables: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          set_id: string
          table_data: Json
          table_name: string
          table_type: string
          total_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          set_id: string
          table_data: Json
          table_name: string
          table_type: string
          total_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          set_id?: string
          table_data?: Json
          table_name?: string
          table_type?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_default_tables_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "tour_default_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_documents: {
        Row: {
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          tour_id: string
          uploaded_at: string
          uploaded_by: string | null
          visible_to_guest: boolean
          visible_to_tech: boolean
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          tour_id: string
          uploaded_at?: string
          uploaded_by?: string | null
          visible_to_guest?: boolean
          visible_to_tech?: boolean
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          tour_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
          visible_to_guest?: boolean
          visible_to_tech?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tour_documents_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_guest_links: {
        Row: {
          access_level: string
          allowed_sections: Json
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string
          revoked_at: string | null
          token: string | null
          token_hash: string
          tour_id: string
          updated_at: string
        }
        Insert: {
          access_level?: string
          allowed_sections?: Json
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string
          revoked_at?: string | null
          token?: string | null
          token_hash: string
          tour_id: string
          updated_at?: string
        }
        Update: {
          access_level?: string
          allowed_sections?: Json
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string
          revoked_at?: string | null
          token?: string | null
          token_hash?: string
          tour_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_guest_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_guest_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_guest_links_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_logos: {
        Row: {
          content_type: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          tour_id: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          tour_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          tour_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_logos_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_power_defaults: {
        Row: {
          created_at: string | null
          current_per_phase: number
          custom_pdu_type: string | null
          custom_position: string | null
          department: string | null
          id: string
          includes_hoist: boolean | null
          pdu_type: string
          position: string | null
          table_name: string
          total_watts: number
          tour_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_per_phase: number
          custom_pdu_type?: string | null
          custom_position?: string | null
          department?: string | null
          id?: string
          includes_hoist?: boolean | null
          pdu_type: string
          position?: string | null
          table_name: string
          total_watts: number
          tour_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_per_phase?: number
          custom_pdu_type?: string | null
          custom_position?: string | null
          department?: string | null
          id?: string
          includes_hoist?: boolean | null
          pdu_type?: string
          position?: string | null
          table_name?: string
          total_watts?: number
          tour_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_power_defaults_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_schedule_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          default_crew_calls: Json | null
          default_schedule: Json
          default_timing: Json | null
          description: string | null
          id: string
          is_global: boolean | null
          name: string
          template_type: string
          tour_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          default_crew_calls?: Json | null
          default_schedule: Json
          default_timing?: Json | null
          description?: string | null
          id?: string
          is_global?: boolean | null
          name: string
          template_type: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          default_crew_calls?: Json | null
          default_schedule?: Json
          default_timing?: Json | null
          description?: string | null
          id?: string
          is_global?: boolean | null
          name?: string
          template_type?: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_schedule_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_schedule_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_schedule_templates_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_timeline_events: {
        Row: {
          all_day: boolean | null
          created_at: string | null
          created_by: string | null
          date: string
          departments: string[] | null
          description: string | null
          end_time: string | null
          event_type: string
          id: string
          location_details: string | null
          location_id: string | null
          metadata: Json | null
          start_time: string | null
          timezone: string | null
          title: string
          tour_id: string
          updated_at: string | null
          visible_to_crew: boolean | null
        }
        Insert: {
          all_day?: boolean | null
          created_at?: string | null
          created_by?: string | null
          date: string
          departments?: string[] | null
          description?: string | null
          end_time?: string | null
          event_type: string
          id?: string
          location_details?: string | null
          location_id?: string | null
          metadata?: Json | null
          start_time?: string | null
          timezone?: string | null
          title: string
          tour_id: string
          updated_at?: string | null
          visible_to_crew?: boolean | null
        }
        Update: {
          all_day?: boolean | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          departments?: string[] | null
          description?: string | null
          end_time?: string | null
          event_type?: string
          id?: string
          location_details?: string | null
          location_id?: string | null
          metadata?: Json | null
          start_time?: string | null
          timezone?: string | null
          title?: string
          tour_id?: string
          updated_at?: string | null
          visible_to_crew?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_timeline_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_timeline_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_timeline_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_timeline_events_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_travel_segments: {
        Row: {
          actual_cost_eur: number | null
          arrival_time: string | null
          carrier_name: string | null
          created_at: string | null
          created_by: string | null
          crew_manifest: Json | null
          departure_time: string | null
          distance_km: number | null
          estimated_cost_eur: number | null
          estimated_duration_minutes: number | null
          from_location_id: string | null
          from_tour_date_id: string | null
          id: string
          luggage_truck: boolean | null
          route_notes: string | null
          status: string | null
          stops: Json | null
          to_location_id: string | null
          to_tour_date_id: string | null
          tour_id: string
          transportation_type: string
          updated_at: string | null
          vehicle_details: Json | null
        }
        Insert: {
          actual_cost_eur?: number | null
          arrival_time?: string | null
          carrier_name?: string | null
          created_at?: string | null
          created_by?: string | null
          crew_manifest?: Json | null
          departure_time?: string | null
          distance_km?: number | null
          estimated_cost_eur?: number | null
          estimated_duration_minutes?: number | null
          from_location_id?: string | null
          from_tour_date_id?: string | null
          id?: string
          luggage_truck?: boolean | null
          route_notes?: string | null
          status?: string | null
          stops?: Json | null
          to_location_id?: string | null
          to_tour_date_id?: string | null
          tour_id: string
          transportation_type: string
          updated_at?: string | null
          vehicle_details?: Json | null
        }
        Update: {
          actual_cost_eur?: number | null
          arrival_time?: string | null
          carrier_name?: string | null
          created_at?: string | null
          created_by?: string | null
          crew_manifest?: Json | null
          departure_time?: string | null
          distance_km?: number | null
          estimated_cost_eur?: number | null
          estimated_duration_minutes?: number | null
          from_location_id?: string | null
          from_tour_date_id?: string | null
          id?: string
          luggage_truck?: boolean | null
          route_notes?: string | null
          status?: string | null
          stops?: Json | null
          to_location_id?: string | null
          to_tour_date_id?: string | null
          tour_id?: string
          transportation_type?: string
          updated_at?: string | null
          vehicle_details?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_travel_segments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_travel_segments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_travel_segments_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_travel_segments_from_tour_date_id_fkey"
            columns: ["from_tour_date_id"]
            isOneToOne: false
            referencedRelation: "tour_dates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_travel_segments_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_travel_segments_to_tour_date_id_fkey"
            columns: ["to_tour_date_id"]
            isOneToOne: false
            referencedRelation: "tour_dates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_travel_segments_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_week_multipliers_2025: {
        Row: {
          max_dates: number
          min_dates: number
          multiplier: number
        }
        Insert: {
          max_dates: number
          min_dates: number
          multiplier: number
        }
        Update: {
          max_dates?: number
          min_dates?: number
          multiplier?: number
        }
        Relationships: []
      }
      tour_weight_defaults: {
        Row: {
          category: string | null
          created_at: string | null
          department: string | null
          id: string
          item_name: string
          quantity: number | null
          tour_id: string
          updated_at: string | null
          weight_kg: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          department?: string | null
          id?: string
          item_name: string
          quantity?: number | null
          tour_id: string
          updated_at?: string | null
          weight_kg: number
        }
        Update: {
          category?: string | null
          created_at?: string | null
          department?: string | null
          id?: string
          item_name?: string
          quantity?: number | null
          tour_id?: string
          updated_at?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "tour_weight_defaults_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tours: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          default_timezone: string | null
          deleted: boolean | null
          description: string | null
          end_date: string | null
          flex_comercial_folder_id: string | null
          flex_comercial_folder_number: string | null
          flex_folders_created: boolean | null
          flex_lights_folder_id: string | null
          flex_lights_folder_number: string | null
          flex_main_folder_id: string | null
          flex_main_folder_number: string | null
          flex_personnel_folder_id: string | null
          flex_personnel_folder_number: string | null
          flex_production_folder_id: string | null
          flex_production_folder_number: string | null
          flex_sound_folder_id: string | null
          flex_sound_folder_number: string | null
          flex_video_folder_id: string | null
          flex_video_folder_number: string | null
          id: string
          invoicing_company: string | null
          name: string
          rates_approved: boolean
          rates_approved_at: string | null
          rates_approved_by: string | null
          scheduling_preferences: Json | null
          start_date: string | null
          status: string
          tour_contacts: Json | null
          tour_settings: Json | null
          travel_plan: Json | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          default_timezone?: string | null
          deleted?: boolean | null
          description?: string | null
          end_date?: string | null
          flex_comercial_folder_id?: string | null
          flex_comercial_folder_number?: string | null
          flex_folders_created?: boolean | null
          flex_lights_folder_id?: string | null
          flex_lights_folder_number?: string | null
          flex_main_folder_id?: string | null
          flex_main_folder_number?: string | null
          flex_personnel_folder_id?: string | null
          flex_personnel_folder_number?: string | null
          flex_production_folder_id?: string | null
          flex_production_folder_number?: string | null
          flex_sound_folder_id?: string | null
          flex_sound_folder_number?: string | null
          flex_video_folder_id?: string | null
          flex_video_folder_number?: string | null
          id?: string
          invoicing_company?: string | null
          name: string
          rates_approved?: boolean
          rates_approved_at?: string | null
          rates_approved_by?: string | null
          scheduling_preferences?: Json | null
          start_date?: string | null
          status?: string
          tour_contacts?: Json | null
          tour_settings?: Json | null
          travel_plan?: Json | null
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          default_timezone?: string | null
          deleted?: boolean | null
          description?: string | null
          end_date?: string | null
          flex_comercial_folder_id?: string | null
          flex_comercial_folder_number?: string | null
          flex_folders_created?: boolean | null
          flex_lights_folder_id?: string | null
          flex_lights_folder_number?: string | null
          flex_main_folder_id?: string | null
          flex_main_folder_number?: string | null
          flex_personnel_folder_id?: string | null
          flex_personnel_folder_number?: string | null
          flex_production_folder_id?: string | null
          flex_production_folder_number?: string | null
          flex_sound_folder_id?: string | null
          flex_sound_folder_number?: string | null
          flex_video_folder_id?: string | null
          flex_video_folder_number?: string | null
          id?: string
          invoicing_company?: string | null
          name?: string
          rates_approved?: boolean
          rates_approved_at?: string | null
          rates_approved_by?: string | null
          scheduling_preferences?: Json | null
          start_date?: string | null
          status?: string
          tour_contacts?: Json | null
          tour_settings?: Json | null
          travel_plan?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tours_rates_approved_by_fkey"
            columns: ["rates_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tours_rates_approved_by_fkey"
            columns: ["rates_approved_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_request_items: {
        Row: {
          created_at: string
          id: string
          leftover_space_meters: number | null
          request_id: string
          transport_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          leftover_space_meters?: number | null
          request_id: string
          transport_type: string
        }
        Update: {
          created_at?: string
          id?: string
          leftover_space_meters?: number | null
          request_id?: string
          transport_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "transport_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_requests: {
        Row: {
          created_at: string
          created_by: string | null
          department: string
          description: string | null
          fulfilled_by: string | null
          id: string
          job_id: string
          note: string | null
          status: string
          transport_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department: string
          description?: string | null
          fulfilled_by?: string | null
          id?: string
          job_id: string
          note?: string | null
          status?: string
          transport_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string
          description?: string | null
          fulfilled_by?: string | null
          id?: string
          job_id?: string
          note?: string | null
          status?: string
          transport_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_fulfilled_by_fkey"
            columns: ["fulfilled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_fulfilled_by_fkey"
            columns: ["fulfilled_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      truck_planner_bundle_rules: {
        Row: {
          bundle_version_id: string
          case_sku_id: string
          created_at: string
          equipment_id: string
          equipment_units_per_case: number
          id: string
          min_cases: number
          rounding_mode: string
          updated_at: string
        }
        Insert: {
          bundle_version_id: string
          case_sku_id: string
          created_at?: string
          equipment_id: string
          equipment_units_per_case: number
          id?: string
          min_cases?: number
          rounding_mode?: string
          updated_at?: string
        }
        Update: {
          bundle_version_id?: string
          case_sku_id?: string
          created_at?: string
          equipment_id?: string
          equipment_units_per_case?: number
          id?: string
          min_cases?: number
          rounding_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_planner_bundle_rules_bundle_version_id_fkey"
            columns: ["bundle_version_id"]
            isOneToOne: false
            referencedRelation: "truck_planner_bundle_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_bundle_rules_case_sku_id_fkey"
            columns: ["case_sku_id"]
            isOneToOne: false
            referencedRelation: "truck_planner_case_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_bundle_rules_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "current_stock_levels"
            referencedColumns: ["equipment_id"]
          },
          {
            foreignKeyName: "truck_planner_bundle_rules_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_bundle_rules_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_availability_with_rentals"
            referencedColumns: ["equipment_id"]
          },
        ]
      }
      truck_planner_bundle_versions: {
        Row: {
          created_at: string
          created_by: string | null
          department: string
          id: string
          is_published: boolean
          updated_at: string
          version_name: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department: string
          id?: string
          is_published?: boolean
          updated_at?: string
          version_name: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string
          id?: string
          is_published?: boolean
          updated_at?: string
          version_name?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "truck_planner_bundle_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_bundle_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_planner_case_skus: {
        Row: {
          allowed_yaw: number[]
          can_be_base: boolean
          color_hex: string | null
          created_at: string
          height_mm: number
          id: string
          is_active: boolean
          is_container: boolean
          length_mm: number
          max_load_above_kg: number
          min_support_ratio: number
          name: string
          sku_id: string
          stack_class: string | null
          tilt_allowed: boolean
          top_contact_allowed: boolean
          updated_at: string
          upright_only: boolean
          weight_kg: number
          width_mm: number
        }
        Insert: {
          allowed_yaw?: number[]
          can_be_base?: boolean
          color_hex?: string | null
          created_at?: string
          height_mm: number
          id?: string
          is_active?: boolean
          is_container?: boolean
          length_mm: number
          max_load_above_kg?: number
          min_support_ratio?: number
          name: string
          sku_id: string
          stack_class?: string | null
          tilt_allowed?: boolean
          top_contact_allowed?: boolean
          updated_at?: string
          upright_only?: boolean
          weight_kg: number
          width_mm: number
        }
        Update: {
          allowed_yaw?: number[]
          can_be_base?: boolean
          color_hex?: string | null
          created_at?: string
          height_mm?: number
          id?: string
          is_active?: boolean
          is_container?: boolean
          length_mm?: number
          max_load_above_kg?: number
          min_support_ratio?: number
          name?: string
          sku_id?: string
          stack_class?: string | null
          tilt_allowed?: boolean
          top_contact_allowed?: boolean
          updated_at?: string
          upright_only?: boolean
          weight_kg?: number
          width_mm?: number
        }
        Relationships: []
      }
      truck_planner_job_plans: {
        Row: {
          created_at: string
          created_by: string | null
          department: string
          id: string
          job_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department: string
          id?: string
          job_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string
          id?: string
          job_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "truck_planner_job_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_job_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_job_plans_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_job_plans_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "truck_planner_job_plans_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_job_plans_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_planner_plan_case_counts: {
        Row: {
          case_sku_id: string
          created_at: string
          id: string
          plan_version_id: string
          quantity: number
          source: string
          source_ref: string | null
          updated_at: string
        }
        Insert: {
          case_sku_id: string
          created_at?: string
          id?: string
          plan_version_id: string
          quantity: number
          source?: string
          source_ref?: string | null
          updated_at?: string
        }
        Update: {
          case_sku_id?: string
          created_at?: string
          id?: string
          plan_version_id?: string
          quantity?: number
          source?: string
          source_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_planner_plan_case_counts_case_sku_id_fkey"
            columns: ["case_sku_id"]
            isOneToOne: false
            referencedRelation: "truck_planner_case_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_plan_case_counts_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "truck_planner_plan_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_plan_case_counts_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "v_truck_planner_technician_published_plans"
            referencedColumns: ["plan_version_id"]
          },
        ]
      }
      truck_planner_plan_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          instances_json: Json
          job_plan_id: string
          label_notes_json: Json
          metrics_json: Json
          published_at: string | null
          published_by: string | null
          status: string
          truck_id: string | null
          updated_at: string
          version_name: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          instances_json?: Json
          job_plan_id: string
          label_notes_json?: Json
          metrics_json?: Json
          published_at?: string | null
          published_by?: string | null
          status?: string
          truck_id?: string | null
          updated_at?: string
          version_name: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          instances_json?: Json
          job_plan_id?: string
          label_notes_json?: Json
          metrics_json?: Json
          published_at?: string | null
          published_by?: string | null
          status?: string
          truck_id?: string | null
          updated_at?: string
          version_name?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "truck_planner_plan_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_plan_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_plan_versions_job_plan_id_fkey"
            columns: ["job_plan_id"]
            isOneToOne: false
            referencedRelation: "truck_planner_job_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_plan_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_plan_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_plan_versions_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "truck_planner_trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_planner_transport_mappings: {
        Row: {
          created_at: string
          id: string
          transport_type: string
          truck_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          transport_type: string
          truck_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          transport_type?: string
          truck_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_planner_transport_mappings_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: true
            referencedRelation: "truck_planner_trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_planner_trucks: {
        Row: {
          axle_front_x_mm: number
          axle_max_front_kg: number
          axle_max_rear_kg: number
          axle_rear_x_mm: number
          created_at: string
          empty_weight_kg: number
          id: string
          inner_height_mm: number
          inner_length_mm: number
          inner_width_mm: number
          is_active: boolean
          max_lr_imbalance_percent: number
          name: string
          obstacles: Json | null
          truck_id: string
          updated_at: string
        }
        Insert: {
          axle_front_x_mm: number
          axle_max_front_kg: number
          axle_max_rear_kg: number
          axle_rear_x_mm: number
          created_at?: string
          empty_weight_kg: number
          id?: string
          inner_height_mm: number
          inner_length_mm: number
          inner_width_mm: number
          is_active?: boolean
          max_lr_imbalance_percent?: number
          name: string
          obstacles?: Json | null
          truck_id: string
          updated_at?: string
        }
        Update: {
          axle_front_x_mm?: number
          axle_max_front_kg?: number
          axle_max_rear_kg?: number
          axle_rear_x_mm?: number
          created_at?: string
          empty_weight_kg?: number
          id?: string
          inner_height_mm?: number
          inner_length_mm?: number
          inner_width_mm?: number
          is_active?: boolean
          max_lr_imbalance_percent?: number
          name?: string
          obstacles?: Json | null
          truck_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      vacation_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          end_date: string
          id: string
          reason: string | null
          rejection_reason: string | null
          start_date: string
          status: string
          technician_id: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          end_date: string
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: string
          technician_id: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          end_date?: string
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: string
          technician_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vacation_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_requests_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_requests_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          capacity: number | null
          city: string
          coordinates: Json | null
          country: string
          created_at: string
          full_address: string | null
          google_place_id: string | null
          id: string
          name: string
          state_region: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          city: string
          coordinates?: Json | null
          country: string
          created_at?: string
          full_address?: string | null
          google_place_id?: string | null
          id?: string
          name: string
          state_region?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          city?: string
          coordinates?: Json | null
          country?: string
          created_at?: string
          full_address?: string | null
          google_place_id?: string | null
          id?: string
          name?: string
          state_region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      video_job_personnel: {
        Row: {
          camera_ops: number | null
          id: string
          job_id: string | null
          playback_techs: number | null
          video_directors: number | null
          video_techs: number | null
        }
        Insert: {
          camera_ops?: number | null
          id?: string
          job_id?: string | null
          playback_techs?: number | null
          video_directors?: number | null
          video_techs?: number | null
        }
        Update: {
          camera_ops?: number | null
          id?: string
          job_id?: string | null
          playback_techs?: number | null
          video_directors?: number | null
          video_techs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_job_personnel_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_job_personnel_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      video_job_tasks: {
        Row: {
          assigned_department: string | null
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          completion_source: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          job_id: string | null
          priority: number | null
          progress: number | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          tour_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_department?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_source?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          job_id?: string | null
          priority?: number | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_department?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_source?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          job_id?: string | null
          priority?: number | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type?: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_job_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_job_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_job_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_job_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_job_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_job_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_job_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_job_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "video_job_tasks_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      video_memoria_tecnica_documents: {
        Row: {
          created_at: string | null
          final_document_url: string | null
          id: string
          job_id: string | null
          logo_url: string | null
          material_list_url: string | null
          pixel_map_url: string | null
          power_report_url: string | null
          project_name: string
          updated_at: string | null
          weight_report_url: string | null
        }
        Insert: {
          created_at?: string | null
          final_document_url?: string | null
          id?: string
          job_id?: string | null
          logo_url?: string | null
          material_list_url?: string | null
          pixel_map_url?: string | null
          power_report_url?: string | null
          project_name: string
          updated_at?: string | null
          weight_report_url?: string | null
        }
        Update: {
          created_at?: string | null
          final_document_url?: string | null
          id?: string
          job_id?: string | null
          logo_url?: string | null
          material_list_url?: string | null
          pixel_map_url?: string | null
          power_report_url?: string | null
          project_name?: string
          updated_at?: string | null
          weight_report_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_memoria_tecnica_documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_memoria_tecnica_documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      wallboard_presets: {
        Row: {
          created_at: string
          description: string | null
          display_url: string
          highlight_ttl_seconds: number
          id: string
          name: string
          panel_durations: Json
          panel_order: string[]
          rotation_fallback_seconds: number
          slug: string
          ticker_poll_interval_seconds: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_url?: string
          highlight_ttl_seconds?: number
          id?: string
          name: string
          panel_durations: Json
          panel_order: string[]
          rotation_fallback_seconds?: number
          slug: string
          ticker_poll_interval_seconds?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_url?: string
          highlight_ttl_seconds?: number
          id?: string
          name?: string
          panel_durations?: Json
          panel_order?: string[]
          rotation_fallback_seconds?: number
          slug?: string
          ticker_poll_interval_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_send_audit: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          job_id: string | null
          kind: string
          recipient_count: number
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          kind: string
          recipient_count?: number
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          kind?: string
          recipient_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_send_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_stock_levels: {
        Row: {
          category: Database["public"]["Enums"]["equipment_category"] | null
          current_quantity: number | null
          department: string | null
          equipment_id: string | null
          equipment_name: string | null
        }
        Relationships: []
      }
      equipment_availability_with_rentals: {
        Row: {
          base_quantity: number | null
          category: Database["public"]["Enums"]["equipment_category"] | null
          department: string | null
          equipment_id: string | null
          equipment_name: string | null
          image_id: string | null
          manufacturer: string | null
          rental_boost: number | null
          total_available: number | null
        }
        Relationships: []
      }
      job_required_roles_summary: {
        Row: {
          department: string | null
          job_id: string | null
          roles: Json | null
          total_required: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_required_roles_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_required_roles_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      pending_tasks_view: {
        Row: {
          assigned_department: string | null
          assigned_to: string | null
          assignee_first_name: string | null
          assignee_last_name: string | null
          assignee_role: Database["public"]["Enums"]["user_role"] | null
          client: string | null
          created_at: string | null
          department: string | null
          description: string | null
          due_at: string | null
          id: string | null
          job_id: string | null
          job_name: string | null
          priority: number | null
          progress: number | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_type: string | null
          tour_id: string | null
          tour_name: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      system_health_assignments: {
        Row: {
          active_jobs: number | null
          assigned_24h: number | null
          assigned_technicians: number | null
          confirmed: number | null
          declined: number | null
          invited: number | null
          missing_assignment_date: number | null
          total_assignments: number | null
        }
        Relationships: []
      }
      system_health_timesheets: {
        Row: {
          approved: number | null
          avg_approval_time_seconds: number | null
          created_24h: number | null
          drafts: number | null
          submitted: number | null
          updated_1h: number | null
        }
        Relationships: []
      }
      v_job_expense_summary: {
        Row: {
          amount_totals: Json | null
          approved_total_eur: number | null
          category_slug: string | null
          draft_total_eur: number | null
          job_id: string | null
          last_receipt_at: string | null
          rejected_total_eur: number | null
          status_counts: Json | null
          submitted_total_eur: number | null
          technician_id: string | null
          total_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_expenses_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "job_expenses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_expenses_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_job_staffing_summary: {
        Row: {
          approved_cost_eur: number | null
          assigned_count: number | null
          job_id: string | null
          job_type: Database["public"]["Enums"]["job_type"] | null
          title: string | null
          total_cost_eur: number | null
          worked_count: number | null
        }
        Relationships: []
      }
      v_job_tech_payout_2025: {
        Row: {
          expenses_breakdown: Json | null
          expenses_total_eur: number | null
          extras_breakdown: Json | null
          extras_total_eur: number | null
          job_id: string | null
          technician_id: string | null
          timesheets_total_eur: number | null
          total_eur: number | null
          vehicle_disclaimer: boolean | null
          vehicle_disclaimer_text: string | null
        }
        Relationships: []
      }
      v_job_tech_payout_2025_base: {
        Row: {
          expenses_breakdown: Json | null
          expenses_total_eur: number | null
          extras_breakdown: Json | null
          extras_total_eur: number | null
          job_id: string | null
          technician_id: string | null
          timesheets_total_eur: number | null
          total_eur: number | null
          vehicle_disclaimer: boolean | null
          vehicle_disclaimer_text: string | null
        }
        Relationships: []
      }
      v_tour_job_rate_quotes_2025: {
        Row: {
          autonomo_discount_eur: number | null
          base_day_eur: number | null
          breakdown: Json | null
          calculated_total_eur: number | null
          category: string | null
          end_time: string | null
          extras: Json | null
          extras_total_eur: number | null
          has_override: boolean | null
          is_house_tech: boolean | null
          is_tour_team_member: boolean | null
          iso_week: number | null
          iso_year: number | null
          job_id: string | null
          job_type: Database["public"]["Enums"]["job_type"] | null
          multiplier: number | null
          override_amount_eur: number | null
          per_job_multiplier: number | null
          start_time: string | null
          technician_id: string | null
          title: string | null
          total_eur: number | null
          total_with_extras_eur: number | null
          tour_id: string | null
          vehicle_disclaimer: boolean | null
          vehicle_disclaimer_text: string | null
          week_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_tour_job_rate_quotes_2025_base: {
        Row: {
          base_day_eur: number | null
          breakdown: Json | null
          category: string | null
          end_time: string | null
          extras: Json | null
          extras_total_eur: number | null
          is_house_tech: boolean | null
          is_tour_team_member: boolean | null
          iso_week: number | null
          iso_year: number | null
          job_id: string | null
          job_type: Database["public"]["Enums"]["job_type"] | null
          multiplier: number | null
          per_job_multiplier: number | null
          start_time: string | null
          technician_id: string | null
          title: string | null
          total_eur: number | null
          total_with_extras_eur: number | null
          tour_id: string | null
          vehicle_disclaimer: boolean | null
          vehicle_disclaimer_text: string | null
          week_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_truck_planner_technician_published_plans: {
        Row: {
          case_counts_json: Json | null
          department: string | null
          instances_json: Json | null
          job_id: string | null
          job_title: string | null
          label_notes_json: Json | null
          metrics_json: Json | null
          plan_version_id: string | null
          published_at: string | null
          truck_id: string | null
          truck_name: string | null
          version_name: string | null
          version_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "truck_planner_job_plans_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_planner_job_plans_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "truck_planner_plan_versions_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "truck_planner_trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      wallboard_doc_counts: {
        Row: {
          department: string | null
          have: number | null
          job_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      wallboard_doc_requirements: {
        Row: {
          department: string | null
          need: number | null
        }
        Relationships: []
      }
      wallboard_profiles: {
        Row: {
          department: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
        }
        Insert: {
          department?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
        }
        Update: {
          department?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
        }
        Relationships: []
      }
      wallboard_timesheet_status: {
        Row: {
          job_id: string | null
          status: string | null
          technician_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_timesheets_job_id"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_timesheets_job_id"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_staffing_summary"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "fk_timesheets_technician_id"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_timesheets_technician_id"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      acquire_assignment_lock: {
        Args: { p_date: string; p_technician_id: string }
        Returns: boolean
      }
      approve_job_expense: {
        Args: {
          p_approved: boolean
          p_expense_id: string
          p_rejection_reason?: string
        }
        Returns: {
          amount_eur: number
          amount_original: number
          approved_at: string | null
          approved_by: string | null
          category_slug: string
          created_at: string
          created_by: string | null
          currency_code: string
          description: string | null
          expense_date: string
          fx_rate: number
          id: string
          job_id: string
          permission_id: string | null
          receipt_path: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["expense_status"]
          status_history: Json
          submitted_at: string | null
          submitted_by: string | null
          technician_id: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "job_expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assert_soundvision_access: { Args: never; Returns: boolean }
      attempt_whatsapp_send: {
        Args: {
          _actor_id: string
          _daily_limit: number
          _job_id?: string
          _kind: string
          _recipient_count?: number
          _units: number
        }
        Returns: {
          allowed: boolean
          used_today: number
        }[]
      }
      auto_complete_past_jobs: { Args: never; Returns: number }
      can_access_department_task: {
        Args: { task_assigned_department: string }
        Returns: boolean
      }
      can_manage_role_skill_mapping: {
        Args: { p_role_prefix: string; p_skill_name: string }
        Returns: boolean
      }
      can_manage_skill_category: {
        Args: { p_category: string }
        Returns: boolean
      }
      can_manage_users: { Args: never; Returns: boolean }
      can_submit_job_expense: {
        Args: {
          p_amount_original: number
          p_category_slug: string
          p_currency_code: string
          p_expense_date: string
          p_fx_rate?: number
          p_job_id: string
          p_technician_id: string
        }
        Returns: {
          allowed: boolean
          permission_id: string
          reason: string
          remaining: number
        }[]
      }
      check_technician_conflicts: {
        Args: {
          _include_pending?: boolean
          _single_day?: boolean
          _target_date?: string
          _target_job_id: string
          _technician_id: string
        }
        Returns: Json
      }
      clear_tour_preset_assignments: {
        Args: { _preset_id: string; _tour_id: string }
        Returns: undefined
      }
      clear_whatsapp_group_request:
        | { Args: { p_department: string; p_job_id: string }; Returns: Json }
        | {
            Args: {
              p_department: string
              p_job_id: string
              p_stage_number: number
            }
            Returns: Json
          }
      compute_timesheet_amount_2025: {
        Args: { _persist?: boolean; _timesheet_id: string }
        Returns: Json
      }
      compute_timesheet_amounts_2025: {
        Args: { _persist?: boolean; _timesheet_ids: string[] }
        Returns: Json[]
      }
      compute_tour_job_rate_quote_2025: {
        Args: { _job_id: string; _tech_id: string }
        Returns: Json
      }
      convert_to_timezone: {
        Args: { target_timezone?: string; timestamp_val: string }
        Returns: string
      }
      create_default_logistics_events_for_job: {
        Args: { job_id: string }
        Returns: undefined
      }
      create_tour_guest_link: {
        Args: {
          p_access_level?: string
          p_allowed_sections?: Json
          p_expires_at?: string
          p_label?: string
          p_tour_id: string
        }
        Returns: {
          access_level: string
          allowed_sections: Json
          created_at: string
          expires_at: string
          id: string
          label: string
          revoked_at: string
          token: string
          tour_id: string
        }[]
      }
      current_user_department: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      deactivate_unassigned_prep_day_timesheet: {
        Args: { _date: string; _job_id: string; _technician_id: string }
        Returns: number
      }
      department_for_role_prefix: {
        Args: { p_role_prefix: string }
        Returns: string
      }
      distance_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      dreamlit_auth_admin_executor: {
        Args: { command: string }
        Returns: undefined
      }
      ensure_prep_day_timesheets_for_job_date: {
        Args: { _date: string; _job_id: string }
        Returns: number
      }
      evaluate_daily_achievements: {
        Args: never
        Returns: {
          new_unlocks: number
          user_id: string
        }[]
      }
      evaluate_user_achievements: {
        Args: { p_user_id: string }
        Returns: number
      }
      extras_total_for_job_tech: {
        Args: { _job_id: string; _technician_id: string }
        Returns: Json
      }
      find_declined_with_active_timesheets: {
        Args: never
        Returns: {
          active_timesheet_count: number
          assignment_status: string
          job_id: string
          technician_id: string
        }[]
      }
      find_double_bookings: {
        Args: never
        Returns: {
          date: string
          job_count: number
          job_ids: string[]
          technician_id: string
        }[]
      }
      find_orphaned_timesheets: {
        Args: never
        Returns: {
          date: string
          job_id: string
          job_title: string
          technician_id: string
          timesheet_count: number
        }[]
      }
      find_policies_to_optimize: {
        Args: never
        Returns: {
          policy_name: string
          table_name: string
        }[]
      }
      get_active_timesheet_counts_by_technician: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          department: string
          technician_id: string
          timesheet_count: number
        }[]
      }
      get_assignment_matrix_staffing: {
        Args: never
        Returns: {
          availability_status: string
          availability_updated_at: string
          job_id: string
          last_change: string
          offer_status: string
          offer_updated_at: string
          profile_id: string
        }[]
      }
      get_assignment_matrix_staffing_filtered: {
        Args: { p_job_ids: string[]; p_profile_ids: string[] }
        Returns: {
          availability_status: string
          availability_updated_at: string
          job_id: string
          last_change: string
          offer_status: string
          offer_updated_at: string
          profile_id: string
        }[]
      }
      get_billable_hours_for_job: {
        Args: { p_actual_hours?: number; p_job_id: string }
        Returns: number
      }
      get_campaigns_to_tick: {
        Args: { p_limit?: number }
        Returns: {
          department: string
          id: string
          job_id: string
          mode: string
          next_run_at: string
          policy: Json
          status: string
        }[]
      }
      get_current_user_role: { Args: never; Returns: string }
      get_job_staffing_summary: {
        Args: { p_job_ids: string[] }
        Returns: {
          approved_cost_eur: number
          assigned_count: number
          job_id: string
          total_cost_eur: number
          worked_count: number
        }[]
      }
      get_job_total_amounts: {
        Args: { _job_id: string }
        Returns: {
          breakdown_by_category: Json
          expenses_breakdown: Json
          expenses_pending_eur: number
          expenses_total_eur: number
          individual_amounts: Json
          job_id: string
          pending_item_count: number
          total_approved_eur: number
          total_pending_eur: number
          user_can_see_all: boolean
        }[]
      }
      get_madrid_holidays: {
        Args: { holiday_year?: number }
        Returns: {
          date: string
          name: string
          year: number
        }[]
      }
      get_profiles_with_skills: {
        Args: never
        Returns: {
          assignable_as_tech: boolean
          bg_color: string
          department: string
          dni: string
          email: string
          first_name: string
          id: string
          last_name: string
          nickname: string
          phone: string
          profile_picture_url: string
          role: string
          skills: Json
        }[]
      }
      get_public_artist_form_context: {
        Args: { p_token: string }
        Returns: Json
      }
      get_rate_for_evento_job: {
        Args: { p_category: string; p_job_id: string }
        Returns: number
      }
      get_staffing_requests_matrix_filtered: {
        Args: { p_job_ids: string[]; p_profile_ids: string[] }
        Returns: {
          created_at: string
          id: string
          job_id: string
          phase: string
          profile_id: string
          requested_by: string
          single_day: boolean
          status: string
          target_date: string
          updated_at: string
        }[]
      }
      get_timesheet_amounts_visible: {
        Args: never
        Returns: {
          amount_breakdown: Json
          amount_breakdown_visible: Json
          amount_eur: number
          amount_eur_visible: number
          approved_at: string
          approved_by: string
          approved_by_manager: boolean
          break_minutes: number
          category: string
          created_at: string
          created_by: string
          date: string
          end_time: string
          ends_next_day: boolean
          id: string
          job_id: string
          notes: string
          overtime_hours: number
          signature_data: string
          signed_at: string
          start_time: string
          status: Database["public"]["Enums"]["timesheet_status"]
          technician_id: string
          updated_at: string
        }[]
      }
      get_timesheet_effective_rate: {
        Args: { _timesheet_id: string }
        Returns: {
          base_day_default: number
          base_day_override: number
          category: string
          overtime_default: number
          overtime_override: number
          plus_10_12_default: number
          plus_10_12_override: number
          technician_id: string
          timesheet_id: string
        }[]
      }
      get_timesheet_with_visible_amounts: {
        Args: { _timesheet_id: string }
        Returns: {
          amount_breakdown: Json
          amount_breakdown_visible: Json
          amount_eur: number
          amount_eur_visible: number
          approved_at: string
          approved_by: string
          approved_by_manager: boolean
          break_minutes: number
          category: string
          created_at: string
          created_by: string
          date: string
          end_time: string
          id: string
          job_id: string
          notes: string
          overtime_hours: number
          signature_data: string
          signed_at: string
          start_time: string
          status: Database["public"]["Enums"]["timesheet_status"]
          technician_id: string
          updated_at: string
        }[]
      }
      get_timesheets_batch: {
        Args: { _timesheet_ids: string[]; _user_id?: string }
        Returns: {
          amount_breakdown: Json
          amount_breakdown_visible: Json
          amount_eur: number
          amount_eur_visible: number
          approved_at: string
          approved_by: string
          approved_by_manager: boolean
          break_minutes: number
          category: string
          created_at: string
          created_by: string
          date: string
          end_time: string
          ends_next_day: boolean
          id: string
          job_id: string
          notes: string
          overtime_hours: number
          signature_data: string
          signed_at: string
          start_time: string
          status: Database["public"]["Enums"]["timesheet_status"]
          technician_id: string
          updated_at: string
        }[]
      }
      get_tour_complete_timeline: {
        Args: { p_tour_id: string }
        Returns: {
          event_data: Json
          event_date: string
          event_type: string
        }[]
      }
      get_tour_date_complete_info: {
        Args: { p_tour_date_id: string }
        Returns: Json
      }
      get_tour_guest_payload: { Args: { p_token: string }; Returns: Json }
      get_user_job_ids: {
        Args: { user_uuid: string }
        Returns: {
          job_id: string
        }[]
      }
      get_waha_config: {
        Args: { base_url: string }
        Returns: {
          api_key: string
          host: string
          session: string
        }[]
      }
      invoke_auto_timesheet_reminders: { Args: never; Returns: undefined }
      invoke_scheduled_push_notification: {
        Args: { event_type: string }
        Returns: undefined
      }
      invoke_staffing_sweeper: { Args: never; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_management: { Args: never; Returns: boolean }
      is_house_tech: { Args: { _profile_id: string }; Returns: boolean }
      is_madrid_working_day: { Args: { check_date: string }; Returns: boolean }
      is_management_or_admin: { Args: { p_user_id: string }; Returns: boolean }
      iso_year_week_madrid: {
        Args: { ts: string }
        Returns: {
          iso_week: number
          iso_year: number
        }[]
      }
      json_diff_public: {
        Args: { _new: Json; _old: Json; allowed: string[] }
        Returns: Json
      }
      log_activity: {
        Args: {
          _code: string
          _entity_id: string
          _entity_type: string
          _job_id: string
          _payload?: Json
          _visibility?: Database["public"]["Enums"]["activity_visibility"]
        }
        Returns: string
      }
      log_activity_as: {
        Args: {
          _actor_id: string
          _code: string
          _entity_id: string
          _entity_type: string
          _job_id: string
          _payload?: Json
          _visibility?: Database["public"]["Enums"]["activity_visibility"]
        }
        Returns: string
      }
      manage_assignment_lifecycle: {
        Args: {
          p_action: string
          p_actor_id?: string
          p_delete_mode?: string
          p_job_id: string
          p_metadata?: Json
          p_technician_id: string
        }
        Returns: Json
      }
      mark_timesheet_auto_reminder_sent: {
        Args: { row_id: string; sent_at: string }
        Returns: boolean
      }
      minutes_to_hours_round_30: { Args: { mins: number }; Returns: number }
      needs_vehicle_disclaimer: {
        Args: { _profile_id: string }
        Returns: boolean
      }
      normalize_text_for_match: { Args: { input: string }; Returns: string }
      rank_staffing_candidates: {
        Args: {
          p_department: string
          p_job_id: string
          p_mode: string
          p_policy: Json
          p_role_code: string
        }
        Returns: {
          department: string
          distance_to_madrid_km: number
          experience_score: number
          fairness_score: number
          final_score: number
          full_name: string
          hard_conflict: boolean
          profile_id: string
          proximity_score: number
          reasons: Json
          reliability_score: number
          skills_score: number
          soft_conflict: boolean
        }[]
      }
      refresh_timesheet_amounts_for_job_date: {
        Args: { _date: string; _job_id: string }
        Returns: undefined
      }
      refresh_v_job_staffing_summary: { Args: never; Returns: undefined }
      remove_assignment_with_timesheets: {
        Args: { p_job_id: string; p_technician_id: string }
        Returns: {
          deleted_assignment: boolean
          deleted_timesheets: number
        }[]
      }
      remove_technician_payout_override: {
        Args: { _job_id: string; _technician_id: string }
        Returns: Json
      }
      replace_hoja_de_ruta_all: {
        Args: {
          p_contact_rows: Json
          p_hoja_de_ruta_id: string
          p_staff_rows: Json
          p_transport_rows: Json
        }
        Returns: undefined
      }
      replace_hoja_de_ruta_contacts: {
        Args: { p_contact_rows: Json; p_hoja_de_ruta_id: string }
        Returns: undefined
      }
      replace_hoja_de_ruta_staff: {
        Args: { p_hoja_de_ruta_id: string; p_staff_rows: Json }
        Returns: undefined
      }
      replace_hoja_de_ruta_transport: {
        Args: { p_hoja_de_ruta_id: string; p_transport_rows: Json }
        Returns: undefined
      }
      replace_job_expense_receipt: {
        Args: {
          p_expense_id: string
          p_new_receipt_path: string
          p_remove?: boolean
        }
        Returns: {
          amount_eur: number
          amount_original: number
          approved_at: string | null
          approved_by: string | null
          category_slug: string
          created_at: string
          created_by: string | null
          currency_code: string
          description: string | null
          expense_date: string
          fx_rate: number
          id: string
          job_id: string
          permission_id: string | null
          receipt_path: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["expense_status"]
          status_history: Json
          submitted_at: string | null
          submitted_by: string | null
          technician_id: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "job_expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_job_required_roles: {
        Args: { p_departments: string[]; p_job_id: string; p_rows: Json }
        Returns: undefined
      }
      replace_transport_request_with_items: {
        Args: {
          p_created_by: string
          p_department: string
          p_items: Json
          p_job_id: string
          p_note: string
          p_request_id: string
          p_status: string
        }
        Returns: string
      }
      resolve_category_for_timesheet: {
        Args: { _job_id: string; _tech_id: string }
        Returns: string
      }
      resolve_visibility: {
        Args: { _actor_id: string; _code: string; _job_id: string }
        Returns: Database["public"]["Enums"]["activity_visibility"]
      }
      revoke_tour_guest_link: {
        Args: { p_link_id: string }
        Returns: undefined
      }
      rotate_my_calendar_ics_token: { Args: never; Returns: string }
      set_expense_permission: {
        Args: {
          p_category_slug: string
          p_daily_cap_eur?: number
          p_job_id: string
          p_notes?: string
          p_technician_id: string
          p_total_cap_eur?: number
          p_valid_from?: string
          p_valid_to?: string
        }
        Returns: {
          category_slug: string
          created_at: string
          created_by: string | null
          daily_cap_eur: number | null
          id: string
          job_id: string
          notes: string | null
          technician_id: string
          total_cap_eur: number | null
          updated_at: string
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        SetofOptions: {
          from: "*"
          to: "expense_permissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_technician_payout_override: {
        Args: { _amount_eur: number; _job_id: string; _technician_id: string }
        Returns: Json
      }
      set_tour_guest_link_access: {
        Args: { p_access_level: string; p_link_id: string }
        Returns: undefined
      }
      staffing_role_prefix: { Args: { p_role_code: string }; Returns: string }
      submit_job_expense: {
        Args: {
          p_amount_original: number
          p_category_slug: string
          p_currency_code: string
          p_description?: string
          p_expense_date: string
          p_fx_rate?: number
          p_job_id: string
          p_receipt_path?: string
          p_technician_id?: string
        }
        Returns: {
          amount_eur: number
          amount_original: number
          approved_at: string | null
          approved_by: string | null
          category_slug: string
          created_at: string
          created_by: string | null
          currency_code: string
          description: string | null
          expense_date: string
          fx_rate: number
          id: string
          job_id: string
          permission_id: string | null
          receipt_path: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["expense_status"]
          status_history: Json
          submitted_at: string | null
          submitted_by: string | null
          technician_id: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "job_expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_public_artist_form: {
        Args: { p_form_data: Json; p_token: string }
        Returns: Json
      }
      sync_preset_assignments_for_tour: {
        Args: { _preset_id: string; _tour_id: string }
        Returns: undefined
      }
      toggle_timesheet_day: {
        Args: {
          p_date: string
          p_job_id: string
          p_present: boolean
          p_source?: string
          p_technician_id: string
        }
        Returns: undefined
      }
      tp_can_edit_department: {
        Args: { p_department: string }
        Returns: boolean
      }
      tp_can_read_job_plan: {
        Args: { p_department: string; p_job_id: string }
        Returns: boolean
      }
      tp_can_read_plan_version: {
        Args: { p_version_id: string }
        Returns: boolean
      }
      tp_get_technician_published_plans: {
        Args: never
        Returns: {
          case_counts_json: Json
          department: string
          instances_json: Json
          job_id: string
          job_title: string
          label_notes_json: Json
          metrics_json: Json
          plan_version_id: string
          published_at: string
          truck_id: string
          truck_name: string
          version_name: string
          version_number: number
        }[]
      }
      tp_is_assigned_job_department: {
        Args: { p_department: string; p_job_id: string }
        Returns: boolean
      }
      tp_is_office_role: { Args: never; Returns: boolean }
      tp_next_plan_version_number: {
        Args: { p_job_plan_id: string }
        Returns: number
      }
      tp_upsert_department_transport_request: {
        Args: {
          p_department: string
          p_description?: string
          p_job_id: string
          p_leftover_space_meters?: number
          p_note?: string
          p_transport_type: string
        }
        Returns: string
      }
      update_tour_dates: { Args: never; Returns: undefined }
      upsert_job_prep_days: {
        Args: { p_dates: string[]; p_job_id: string }
        Returns: undefined
      }
      upsert_venue: {
        Args: {
          p_capacity?: number
          p_city: string
          p_coordinates?: Json
          p_country: string
          p_full_address?: string
          p_google_place_id: string
          p_name: string
          p_state_region: string
        }
        Returns: string
      }
    }
    Enums: {
      activity_visibility:
        | "management"
        | "house_plus_job"
        | "job_participants"
        | "actor_only"
      assignment_status: "invited" | "confirmed" | "declined"
      bug_severity: "low" | "medium" | "high" | "critical"
      bug_status: "open" | "in_progress" | "resolved"
      department:
        | "sound"
        | "lights"
        | "video"
        | "logistics"
        | "production"
        | "administrative"
      direct_message_status: "unread" | "read"
      equipment_category:
        | "convencional"
        | "robotica"
        | "fx"
        | "rigging"
        | "controles"
        | "cuadros"
        | "led"
        | "strobo"
        | "canones"
        | "estructuras"
        | "speakers"
        | "monitors"
        | "foh_console"
        | "mon_console"
        | "wireless"
        | "iem"
        | "wired_mics"
        | "amplificacion"
        | "pa_mains"
        | "pa_outfill"
        | "pa_subs"
        | "pa_frontfill"
        | "pa_delays"
        | "pa_amp"
      expense_status: "draft" | "submitted" | "approved" | "rejected"
      feature_status:
        | "pending"
        | "under_review"
        | "accepted"
        | "rejected"
        | "completed"
      flex_work_order_item_source: "role" | "extra"
      form_status: "pending" | "submitted" | "expired"
      global_preset_status: "available" | "unavailable" | "tentative"
      invoicing_company: "Production Sector" | "Sharecable" | "MFO"
      job_date_type:
        | "travel"
        | "setup"
        | "show"
        | "off"
        | "rehearsal"
        | "rigging"
        | "prep_day"
      job_extra_type: "travel_half" | "travel_full" | "day_off" | "conduccion"
      job_rate_extras_status: "pending" | "approved" | "rejected"
      job_status: "Tentativa" | "Confirmado" | "Completado" | "Cancelado"
      job_type:
        | "single"
        | "tour"
        | "festival"
        | "dryhire"
        | "tourdate"
        | "evento"
        | "ciclo"
      logistics_event_type: "load" | "unload"
      logistics_transport_category:
        | "sonido_madera"
        | "sonido_escenario"
        | "iluminacion_hierro"
        | "iluminacion_aparatos"
        | "video"
        | "rigging_motores"
      message_status: "unread" | "read"
      milestone_category:
        | "planning"
        | "technical"
        | "logistics"
        | "administrative"
        | "production"
      movement_type: "addition" | "subtraction"
      notification_channel:
        | "messages"
        | "assignments"
        | "form_submissions"
        | "gear_movements"
      project_status: "pending" | "in_progress" | "completed" | "cancelled"
      provider_type: "festival" | "band" | "mixed"
      push_notification_recipient_type:
        | "management_user"
        | "department"
        | "broadcast"
        | "natural"
        | "assigned_technicians"
      room_type: "single" | "double"
      staffing_notification_scope: "all_departments" | "own_department"
      task_status: "not_started" | "in_progress" | "completed"
      timesheet_status: "draft" | "submitted" | "approved" | "rejected"
      tour_date_type:
        | "show"
        | "rehearsal"
        | "travel"
        | "setup"
        | "off"
        | "rigging"
      transport_provider_enum:
        | "camionaje"
        | "transluminaria"
        | "the_wild_tour"
        | "pantoja"
        | "crespo"
        | "montabi_dorado"
        | "grupo_sese"
        | "nacex"
        | "sector_pro"
        | "recogida_cliente"
      transport_type: "trailer" | "9m" | "8m" | "6m" | "4m" | "furgoneta" | "rv"
      transportation_type:
        | "van"
        | "sleeper_bus"
        | "train"
        | "plane"
        | "rv"
        | "autobus"
      user_role:
        | "admin"
        | "user"
        | "management"
        | "logistics"
        | "technician"
        | "house_tech"
        | "wallboard"
        | "oscar"
    }
    CompositeTypes: {
      equipment_details: {
        model: string | null
        quantity: number | null
        notes: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_visibility: [
        "management",
        "house_plus_job",
        "job_participants",
        "actor_only",
      ],
      assignment_status: ["invited", "confirmed", "declined"],
      bug_severity: ["low", "medium", "high", "critical"],
      bug_status: ["open", "in_progress", "resolved"],
      department: [
        "sound",
        "lights",
        "video",
        "logistics",
        "production",
        "administrative",
      ],
      direct_message_status: ["unread", "read"],
      equipment_category: [
        "convencional",
        "robotica",
        "fx",
        "rigging",
        "controles",
        "cuadros",
        "led",
        "strobo",
        "canones",
        "estructuras",
        "speakers",
        "monitors",
        "foh_console",
        "mon_console",
        "wireless",
        "iem",
        "wired_mics",
        "amplificacion",
        "pa_mains",
        "pa_outfill",
        "pa_subs",
        "pa_frontfill",
        "pa_delays",
        "pa_amp",
      ],
      expense_status: ["draft", "submitted", "approved", "rejected"],
      feature_status: [
        "pending",
        "under_review",
        "accepted",
        "rejected",
        "completed",
      ],
      flex_work_order_item_source: ["role", "extra"],
      form_status: ["pending", "submitted", "expired"],
      global_preset_status: ["available", "unavailable", "tentative"],
      invoicing_company: ["Production Sector", "Sharecable", "MFO"],
      job_date_type: [
        "travel",
        "setup",
        "show",
        "off",
        "rehearsal",
        "rigging",
        "prep_day",
      ],
      job_extra_type: ["travel_half", "travel_full", "day_off", "conduccion"],
      job_rate_extras_status: ["pending", "approved", "rejected"],
      job_status: ["Tentativa", "Confirmado", "Completado", "Cancelado"],
      job_type: [
        "single",
        "tour",
        "festival",
        "dryhire",
        "tourdate",
        "evento",
        "ciclo",
      ],
      logistics_event_type: ["load", "unload"],
      logistics_transport_category: [
        "sonido_madera",
        "sonido_escenario",
        "iluminacion_hierro",
        "iluminacion_aparatos",
        "video",
        "rigging_motores",
      ],
      message_status: ["unread", "read"],
      milestone_category: [
        "planning",
        "technical",
        "logistics",
        "administrative",
        "production",
      ],
      movement_type: ["addition", "subtraction"],
      notification_channel: [
        "messages",
        "assignments",
        "form_submissions",
        "gear_movements",
      ],
      project_status: ["pending", "in_progress", "completed", "cancelled"],
      provider_type: ["festival", "band", "mixed"],
      push_notification_recipient_type: [
        "management_user",
        "department",
        "broadcast",
        "natural",
        "assigned_technicians",
      ],
      room_type: ["single", "double"],
      staffing_notification_scope: ["all_departments", "own_department"],
      task_status: ["not_started", "in_progress", "completed"],
      timesheet_status: ["draft", "submitted", "approved", "rejected"],
      tour_date_type: [
        "show",
        "rehearsal",
        "travel",
        "setup",
        "off",
        "rigging",
      ],
      transport_provider_enum: [
        "camionaje",
        "transluminaria",
        "the_wild_tour",
        "pantoja",
        "crespo",
        "montabi_dorado",
        "grupo_sese",
        "nacex",
        "sector_pro",
        "recogida_cliente",
      ],
      transport_type: ["trailer", "9m", "8m", "6m", "4m", "furgoneta", "rv"],
      transportation_type: [
        "van",
        "sleeper_bus",
        "train",
        "plane",
        "rv",
        "autobus",
      ],
      user_role: [
        "admin",
        "user",
        "management",
        "logistics",
        "technician",
        "house_tech",
        "wallboard",
        "oscar",
      ],
    },
  },
} as const
