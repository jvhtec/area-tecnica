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
            referencedRelation: "v_job_tech_payout_2025"
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
            referencedRelation: "v_job_tech_payout_2025"
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
      equipment: {
        Row: {
          category: Database["public"]["Enums"]["equipment_category"]
          created_at: string | null
          department: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["equipment_category"]
          created_at?: string | null
          department?: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["equipment_category"]
          created_at?: string | null
          department?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      equipment_models: {
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
          foh_tech: boolean | null
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
          mic_kit: string | null
          mic_pack: string | null
          mon_console: string | null
          mon_console_provided_by:
            | Database["public"]["Enums"]["provider_type"]
            | null
          mon_tech: boolean | null
          monitors_enabled: boolean | null
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
          foh_tech?: boolean | null
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
          mic_kit?: string | null
          mic_pack?: string | null
          mon_console?: string | null
          mon_console_provided_by?:
            | Database["public"]["Enums"]["provider_type"]
            | null
          mon_tech?: boolean | null
          monitors_enabled?: boolean | null
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
          foh_tech?: boolean | null
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
          mic_kit?: string | null
          mic_pack?: string | null
          mon_console?: string | null
          mon_console_provided_by?:
            | Database["public"]["Enums"]["provider_type"]
            | null
          mon_tech?: boolean | null
          monitors_enabled?: boolean | null
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
            referencedRelation: "v_job_tech_payout_2025"
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
          has_dj_booths: boolean | null
          has_drum_fills: boolean | null
          has_side_fills: boolean | null
          id: string
          iem_systems: Json | null
          job_id: string | null
          max_stages: number | null
          mon_consoles: Json | null
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
          has_dj_booths?: boolean | null
          has_drum_fills?: boolean | null
          has_side_fills?: boolean | null
          id?: string
          iem_systems?: Json | null
          job_id?: string | null
          max_stages?: number | null
          mon_consoles?: Json | null
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
          has_dj_booths?: boolean | null
          has_drum_fills?: boolean | null
          has_side_fills?: boolean | null
          id?: string
          iem_systems?: Json | null
          job_id?: string | null
          max_stages?: number | null
          mon_consoles?: Json | null
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
            referencedRelation: "v_job_tech_payout_2025"
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
            referencedRelation: "v_job_tech_payout_2025"
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
            referencedRelation: "v_job_tech_payout_2025"
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
            referencedRelation: "v_job_tech_payout_2025"
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
            referencedRelation: "v_job_tech_payout_2025"
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
            referencedRelation: "v_job_tech_payout_2025"
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
            referencedRelation: "v_job_tech_payout_2025"
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
            isOneToOne: false
            referencedRelation: "current_stock_levels"
            referencedColumns: ["equipment_id"]
          },
          {
            foreignKeyName: "global_stock_entries_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_stock_entries_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_availability_with_rentals"
            referencedColumns: ["equipment_id"]
          },
        ]
      }
      hoja_de_ruta: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          auxiliary_needs: string | null
          created_at: string | null
          created_by: string | null
          document_version: number | null
          event_dates: string | null
          event_name: string | null
          id: string
          job_id: string | null
          last_modified: string | null
          last_modified_by: string | null
          power_requirements: string | null
          program_schedule_json: Json | null
          schedule: string | null
          status: string | null
          updated_at: string | null
          venue_address: string | null
          venue_latitude: number | null
          venue_longitude: number | null
          venue_name: string | null
          weather_data: Json | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          auxiliary_needs?: string | null
          created_at?: string | null
          created_by?: string | null
          document_version?: number | null
          event_dates?: string | null
          event_name?: string | null
          id?: string
          job_id?: string | null
          last_modified?: string | null
          last_modified_by?: string | null
          power_requirements?: string | null
          program_schedule_json?: Json | null
          schedule?: string | null
          status?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_latitude?: number | null
          venue_longitude?: number | null
          venue_name?: string | null
          weather_data?: Json | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          auxiliary_needs?: string | null
          created_at?: string | null
          created_by?: string | null
          document_version?: number | null
          event_dates?: string | null
          event_name?: string | null
          id?: string
          job_id?: string | null
          last_modified?: string | null
          last_modified_by?: string | null
          power_requirements?: string | null
          program_schedule_json?: Json | null
          schedule?: string | null
          status?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_latitude?: number | null
          venue_longitude?: number | null
          venue_name?: string | null
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
            referencedRelation: "v_job_tech_payout_2025"
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
        }
        Insert: {
          hoja_de_ruta_id?: string | null
          id?: string
          name: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          hoja_de_ruta_id?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
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
        }
        Insert: {
          dni?: string | null
          hoja_de_ruta_id?: string | null
          id?: string
          name: string
          position?: string | null
          surname1?: string | null
          surname2?: string | null
        }
        Update: {
          dni?: string | null
          hoja_de_ruta_id?: string | null
          id?: string
          name?: string
          position?: string | null
          surname1?: string | null
          surname2?: string | null
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
          license_plate: string | null
          return_date_time: string | null
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
          license_plate?: string | null
          return_date_time?: string | null
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
          license_plate?: string | null
          return_date_time?: string | null
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
      house_tech_rates: {
        Row: {
          base_day_eur: number
          currency: string
          overtime_hour_eur: number | null
          plus_10_12_eur: number | null
          profile_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_day_eur: number
          currency?: string
          overtime_hour_eur?: number | null
          plus_10_12_eur?: number | null
          profile_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_day_eur?: number
          currency?: string
          overtime_hour_eur?: number | null
          plus_10_12_eur?: number | null
          profile_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "house_tech_rates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "house_tech_rates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "wallboard_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assignment_source: string | null
          job_id: string
          lights_role: string | null
          response_time: string | null
          sound_role: string | null
          status: Database["public"]["Enums"]["assignment_status"] | null
          technician_id: string
          video_role: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_source?: string | null
          job_id: string
          lights_role?: string | null
          response_time?: string | null
          sound_role?: string | null
          status?: Database["public"]["Enums"]["assignment_status"] | null
          technician_id: string
          video_role?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_source?: string | null
          job_id?: string
          lights_role?: string | null
          response_time?: string | null
          sound_role?: string | null
          status?: Database["public"]["Enums"]["assignment_status"] | null
          technician_id?: string
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
            referencedRelation: "v_job_tech_payout_2025"
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
            referencedRelation: "v_job_tech_payout_2025"
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
            referencedRelation: "v_job_tech_payout_2025"
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
          id: string
          job_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          job_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          job_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
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
            referencedRelation: "v_job_tech_payout_2025"
            referencedColumns: ["job_id"]
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
            referencedRelation: "v_job_tech_payout_2025"
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
            referencedRelation: "v_job_tech_payout_2025"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_rate_extras: {
        Row: {
          amount_override_eur: number | null
          extra_type: Database["public"]["Enums"]["job_extra_type"]
          job_id: string
          quantity: number
          technician_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_override_eur?: number | null
          extra_type: Database["public"]["Enums"]["job_extra_type"]
          job_id: string
          quantity?: number
          technician_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_override_eur?: number | null
          extra_type?: Database["public"]["Enums"]["job_extra_type"]
          job_id?: string
          quantity?: number
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
            referencedRelation: "v_job_tech_payout_2025"
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
      job_whatsapp_group_requests: {
        Row: {
          created_at: string
          department: string
          id: string
          job_id: string
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          job_id: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          job_id?: string
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
            referencedRelation: "v_job_tech_payout_2025"
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
          wa_group_id: string
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          job_id: string
          wa_group_id: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          job_id?: string
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
            referencedRelation: "v_job_tech_payout_2025"
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
          job_type: Database["public"]["Enums"]["job_type"]
          location_id: string | null
          rates_approved: boolean
          rates_approved_at: string | null
          rates_approved_by: string | null
          start_time: string
          status: Database["public"]["Enums"]["job_status"] | null
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
          job_type?: Database["public"]["Enums"]["job_type"]
          location_id?: string | null
          rates_approved?: boolean
          rates_approved_at?: string | null
          rates_approved_by?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["job_status"] | null
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
          job_type?: Database["public"]["Enums"]["job_type"]
          location_id?: string | null
          rates_approved?: boolean
          rates_approved_at?: string | null
          rates_approved_by?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["job_status"] | null
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
            referencedRelation: "v_job_tech_payout_2025"
            referencedColumns: ["job_id"]
          },
        ]
      }
      lights_job_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          id: string
          job_id: string | null
          progress: number | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type?: string
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
            referencedRelation: "v_job_tech_payout_2025"
            referencedColumns: ["job_id"]
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
            referencedRelation: "v_job_tech_payout_2025"
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
          id: string
          job_id: string | null
          license_plate: string | null
          loading_bay: string | null
          notes: string | null
          timezone: string | null
          title: string | null
          transport_type: Database["public"]["Enums"]["transport_type"]
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          event_date: string
          event_time: string
          event_type: Database["public"]["Enums"]["logistics_event_type"]
          id?: string
          job_id?: string | null
          license_plate?: string | null
          loading_bay?: string | null
          notes?: string | null
          timezone?: string | null
          title?: string | null
          transport_type: Database["public"]["Enums"]["transport_type"]
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          event_date?: string
          event_time?: string
          event_type?: Database["public"]["Enums"]["logistics_event_type"]
          id?: string
          job_id?: string | null
          license_plate?: string | null
          loading_bay?: string | null
          notes?: string | null
          timezone?: string | null
          title?: string | null
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
            referencedRelation: "v_job_tech_payout_2025"
            referencedColumns: ["job_id"]
          },
        ]
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
            referencedRelation: "v_job_tech_payout_2025"
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
          sender_id: string
          status: Database["public"]["Enums"]["message_status"]
        }
        Insert: {
          content: string
          created_at?: string
          department: string
          id?: string
          sender_id: string
          status?: Database["public"]["Enums"]["message_status"]
        }
        Update: {
          content?: string
          created_at?: string
          department?: string
          id?: string
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
      notification_preferences: {
        Row: {
          assignments: boolean | null
          created_at: string | null
          form_submissions: boolean | null
          gear_movements: boolean | null
          id: string
          messages: boolean | null
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
          department: string | null
          id: string
          includes_hoist: boolean | null
          job_id: string | null
          pdu_type: string
          table_name: string
          total_watts: number
        }
        Insert: {
          created_at?: string | null
          current_per_phase: number
          custom_pdu_type?: string | null
          department?: string | null
          id?: string
          includes_hoist?: boolean | null
          job_id?: string | null
          pdu_type: string
          table_name: string
          total_watts: number
        }
        Update: {
          created_at?: string | null
          current_per_phase?: number
          custom_pdu_type?: string | null
          department?: string | null
          id?: string
          includes_hoist?: boolean | null
          job_id?: string | null
          pdu_type?: string
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
            referencedRelation: "v_job_tech_payout_2025"
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
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          equipment_id: string
          id?: string
          notes?: string | null
          preset_id: string
          quantity?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          equipment_id?: string
          id?: string
          notes?: string | null
          preset_id?: string
          quantity?: number
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
            referencedRelation: "v_job_tech_payout_2025"
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
          id: string
          last_activity: string | null
          last_name: string | null
          nickname: string | null
          phone: string | null
          residencia: string | null
          role: Database["public"]["Enums"]["user_role"]
          selected_job_statuses: string[] | null
          selected_job_types: string[] | null
          time_span: string | null
          timezone: string | null
          tours_expanded: boolean | null
          waha_endpoint: string | null
        }
        Insert: {
          assignable_as_tech?: boolean
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
          id: string
          last_activity?: string | null
          last_name?: string | null
          nickname?: string | null
          phone?: string | null
          residencia?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          selected_job_statuses?: string[] | null
          selected_job_types?: string[] | null
          time_span?: string | null
          timezone?: string | null
          tours_expanded?: boolean | null
          waha_endpoint?: string | null
        }
        Update: {
          assignable_as_tech?: boolean
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
          id?: string
          last_activity?: string | null
          last_name?: string | null
          nickname?: string | null
          phone?: string | null
          residencia?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          selected_job_statuses?: string[] | null
          selected_job_types?: string[] | null
          time_span?: string | null
          timezone?: string | null
          tours_expanded?: boolean | null
          waha_endpoint?: string | null
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
            referencedRelation: "v_job_tech_payout_2025"
            referencedColumns: ["job_id"]
          },
        ]
      }
      sound_job_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          id: string
          job_id: string | null
          progress: number | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type?: string
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
            referencedRelation: "v_job_tech_payout_2025"
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
          created_at: string
          id: string
          job_id: string
          phase: string
          profile_id: string
          status: string
          token_expires_at: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          phase: string
          profile_id: string
          status: string
          token_expires_at: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          phase?: string
          profile_id?: string
          status?: string
          token_expires_at?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
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
            referencedRelation: "v_job_tech_payout_2025"
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
        ]
      }
      task_documents: {
        Row: {
          file_name: string
          file_path: string
          id: string
          lights_task_id: string | null
          sound_task_id: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          video_task_id: string | null
        }
        Insert: {
          file_name: string
          file_path: string
          id?: string
          lights_task_id?: string | null
          sound_task_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          video_task_id?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string
          id?: string
          lights_task_id?: string | null
          sound_task_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          video_task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_documents_lights_task_id_fkey"
            columns: ["lights_task_id"]
            isOneToOne: false
            referencedRelation: "lights_job_tasks"
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
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_departments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
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
            referencedRelation: "v_job_tech_payout_2025"
            referencedColumns: ["job_id"]
          },
        ]
      }
      timesheets: {
        Row: {
          amount_breakdown: Json | null
          amount_eur: number | null
          approved_at: string | null
          approved_by: string | null
          approved_by_manager: boolean | null
          break_minutes: number | null
          category: string | null
          created_at: string
          created_by: string | null
          date: string
          end_time: string | null
          ends_next_day: boolean | null
          id: string
          job_id: string
          notes: string | null
          overtime_hours: number | null
          signature_data: string | null
          signed_at: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["timesheet_status"]
          technician_id: string
          updated_at: string
        }
        Insert: {
          amount_breakdown?: Json | null
          amount_eur?: number | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_manager?: boolean | null
          break_minutes?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          end_time?: string | null
          ends_next_day?: boolean | null
          id?: string
          job_id: string
          notes?: string | null
          overtime_hours?: number | null
          signature_data?: string | null
          signed_at?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["timesheet_status"]
          technician_id: string
          updated_at?: string
        }
        Update: {
          amount_breakdown?: Json | null
          amount_eur?: number | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_manager?: boolean | null
          break_minutes?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          end_time?: string | null
          ends_next_day?: boolean | null
          id?: string
          job_id?: string
          notes?: string | null
          overtime_hours?: number | null
          signature_data?: string | null
          signed_at?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["timesheet_status"]
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
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
          default_table_id: string | null
          department: string | null
          id: string
          includes_hoist: boolean | null
          override_data: Json | null
          pdu_type: string
          table_name: string
          total_watts: number
          tour_date_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_per_phase: number
          custom_pdu_type?: string | null
          default_table_id?: string | null
          department?: string | null
          id?: string
          includes_hoist?: boolean | null
          override_data?: Json | null
          pdu_type: string
          table_name: string
          total_watts: number
          tour_date_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_per_phase?: number
          custom_pdu_type?: string | null
          default_table_id?: string | null
          department?: string | null
          id?: string
          includes_hoist?: boolean | null
          override_data?: Json | null
          pdu_type?: string
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
          location_id: string | null
          rehearsal_days: number | null
          start_date: string
          tour_date_type: Database["public"]["Enums"]["tour_date_type"] | null
          tour_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          end_date: string
          flex_folders_created?: boolean | null
          id?: string
          is_tour_pack_only?: boolean | null
          location_id?: string | null
          rehearsal_days?: number | null
          start_date: string
          tour_date_type?: Database["public"]["Enums"]["tour_date_type"] | null
          tour_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          end_date?: string
          flex_folders_created?: boolean | null
          id?: string
          is_tour_pack_only?: boolean | null
          location_id?: string | null
          rehearsal_days?: number | null
          start_date?: string
          tour_date_type?: Database["public"]["Enums"]["tour_date_type"] | null
          tour_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_dates_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_dates_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
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
          tour_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          name: string
          tour_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          name?: string
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
          department: string | null
          id: string
          includes_hoist: boolean | null
          pdu_type: string
          table_name: string
          total_watts: number
          tour_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_per_phase: number
          custom_pdu_type?: string | null
          department?: string | null
          id?: string
          includes_hoist?: boolean | null
          pdu_type: string
          table_name: string
          total_watts: number
          tour_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_per_phase?: number
          custom_pdu_type?: string | null
          department?: string | null
          id?: string
          includes_hoist?: boolean | null
          pdu_type?: string
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
          name: string
          rates_approved: boolean
          rates_approved_at: string | null
          rates_approved_by: string | null
          start_date: string | null
          status: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
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
          name: string
          rates_approved?: boolean
          rates_approved_at?: string | null
          rates_approved_by?: string | null
          start_date?: string | null
          status?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
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
          name?: string
          rates_approved?: boolean
          rates_approved_at?: string | null
          rates_approved_by?: string | null
          start_date?: string | null
          status?: string
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
          created_by: string
          department: string
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
          created_by: string
          department: string
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
          created_by?: string
          department?: string
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
            referencedRelation: "v_job_tech_payout_2025"
            referencedColumns: ["job_id"]
          },
        ]
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
            referencedRelation: "v_job_tech_payout_2025"
            referencedColumns: ["job_id"]
          },
        ]
      }
      video_job_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          id: string
          job_id: string | null
          progress: number | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          progress?: number | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type?: string
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
            referencedRelation: "v_job_tech_payout_2025"
            referencedColumns: ["job_id"]
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
            referencedRelation: "v_job_tech_payout_2025"
            referencedColumns: ["job_id"]
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
          rental_boost: number | null
          total_available: number | null
        }
        Relationships: []
      }
      v_job_tech_payout_2025: {
        Row: {
          extras_breakdown: Json | null
          extras_total_eur: number | null
          job_id: string | null
          technician_id: string | null
          timesheets_total_eur: number | null
          total_eur: number | null
          vehicle_disclaimer: boolean | null
          vehicle_disclaimer_text: string | null
        }
        Relationships: [
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
      v_tour_job_rate_quotes_2025: {
        Row: {
          base_day_eur: number | null
          breakdown: Json | null
          category: string | null
          end_time: string | null
          extras_total_eur: number | null
          is_house_tech: boolean | null
          is_tour_team_member: boolean | null
          iso_week: number | null
          iso_year: number | null
          job_id: string | null
          job_type: Database["public"]["Enums"]["job_type"] | null
          multiplier: number | null
          start_time: string | null
          technician_id: string | null
          title: string | null
          total_eur: number | null
          total_with_extras_eur: number | null
          tour_id: string | null
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
            referencedRelation: "v_job_tech_payout_2025"
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
            referencedRelation: "v_job_tech_payout_2025"
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
      auto_complete_past_jobs: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      can_manage_users: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      clear_tour_preset_assignments: {
        Args: { _preset_id: string; _tour_id: string }
        Returns: undefined
      }
      compute_timesheet_amount_2025: {
        Args: { _persist?: boolean; _timesheet_id: string }
        Returns: Json
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
      extras_total_for_job_tech: {
        Args: { _job_id: string; _tech_id: string }
        Returns: Json
      }
      get_assignment_matrix_staffing: {
        Args: Record<PropertyKey, never>
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
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_job_total_amounts: {
        Args: { _job_id: string; _user_role?: string }
        Returns: {
          breakdown_by_category: Json
          individual_amounts: Json
          job_id: string
          total_approved_eur: number
          total_pending_eur: number
          user_can_see_all: boolean
        }[]
      }
      get_profiles_with_skills: {
        Args: Record<PropertyKey, never>
        Returns: {
          assignable_as_tech: boolean
          department: string
          dni: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
          residencia: string
          role: Database["public"]["Enums"]["user_role"]
          skills: Json
        }[]
      }
      get_timesheet_amounts_visible: {
        Args: Record<PropertyKey, never>
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
      get_user_job_ids: {
        Args: { user_uuid: string }
        Returns: {
          job_id: string
        }[]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_house_tech: {
        Args: { _profile_id: string }
        Returns: boolean
      }
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
      minutes_to_hours_round_30: {
        Args: { mins: number }
        Returns: number
      }
      needs_vehicle_disclaimer: {
        Args: { _profile_id: string }
        Returns: boolean
      }
      resolve_category_for_timesheet: {
        Args: { _job_id: string; _tech_id: string }
        Returns: string
      }
      resolve_visibility: {
        Args: { _actor_id: string; _code: string; _job_id: string }
        Returns: Database["public"]["Enums"]["activity_visibility"]
      }
      sync_preset_assignments_for_tour: {
        Args: { _preset_id: string; _tour_id: string }
        Returns: undefined
      }
      update_tour_dates: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      activity_visibility:
        | "management"
        | "house_plus_job"
        | "job_participants"
        | "actor_only"
      assignment_status: "invited" | "confirmed" | "declined"
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
      form_status: "pending" | "submitted" | "expired"
      global_preset_status: "available" | "unavailable" | "tentative"
      job_date_type: "travel" | "setup" | "show" | "off" | "rehearsal"
      job_extra_type: "travel_half" | "travel_full" | "day_off"
      job_status: "Tentativa" | "Confirmado" | "Completado" | "Cancelado"
      job_type: "single" | "tour" | "festival" | "dryhire" | "tourdate"
      logistics_event_type: "load" | "unload"
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
      room_type: "single" | "double"
      task_status: "not_started" | "in_progress" | "completed"
      timesheet_status: "draft" | "submitted" | "approved"
      tour_date_type: "show" | "rehearsal" | "travel"
      transport_type: "trailer" | "9m" | "8m" | "6m" | "4m" | "furgoneta" | "rv"
      transportation_type: "van" | "sleeper_bus" | "train" | "plane" | "rv"
      user_role:
        | "admin"
        | "user"
        | "management"
        | "logistics"
        | "technician"
        | "house_tech"
        | "wallboard"
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
      ],
      form_status: ["pending", "submitted", "expired"],
      global_preset_status: ["available", "unavailable", "tentative"],
      job_date_type: ["travel", "setup", "show", "off", "rehearsal"],
      job_extra_type: ["travel_half", "travel_full", "day_off"],
      job_status: ["Tentativa", "Confirmado", "Completado", "Cancelado"],
      job_type: ["single", "tour", "festival", "dryhire", "tourdate"],
      logistics_event_type: ["load", "unload"],
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
      room_type: ["single", "double"],
      task_status: ["not_started", "in_progress", "completed"],
      timesheet_status: ["draft", "submitted", "approved"],
      tour_date_type: ["show", "rehearsal", "travel"],
      transport_type: ["trailer", "9m", "8m", "6m", "4m", "furgoneta", "rv"],
      transportation_type: ["van", "sleeper_bus", "train", "plane", "rv"],
      user_role: [
        "admin",
        "user",
        "management",
        "logistics",
        "technician",
        "house_tech",
        "wallboard",
      ],
    },
  },
} as const
