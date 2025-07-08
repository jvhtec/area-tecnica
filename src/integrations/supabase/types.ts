export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
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
            foreignKeyName: "assignment_notifications_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "availability_conflicts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_conflicts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
        ]
      }
      availability_schedules: {
        Row: {
          created_at: string | null
          date: string
          department: string
          id: string
          notes: string | null
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
          created_at: string | null
          date: string
          id: string
          order: number | null
          preset_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          order?: number | null
          preset_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          order?: number | null
          preset_id?: string
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
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          category: Database["public"]["Enums"]["equipment_category"]
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["equipment_category"]
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["equipment_category"]
          created_at?: string | null
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
        ]
      }
      flex_folders: {
        Row: {
          created_at: string
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
            foreignKeyName: "flex_folders_tour_date_id_fkey"
            columns: ["tour_date_id"]
            isOneToOne: false
            referencedRelation: "tour_dates"
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
        ]
      }
      hoja_de_ruta: {
        Row: {
          auxiliary_needs: string | null
          created_at: string | null
          event_dates: string | null
          event_name: string | null
          id: string
          job_id: string | null
          last_modified: string | null
          last_modified_by: string | null
          power_requirements: string | null
          schedule: string | null
          updated_at: string | null
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          auxiliary_needs?: string | null
          created_at?: string | null
          event_dates?: string | null
          event_name?: string | null
          id?: string
          job_id?: string | null
          last_modified?: string | null
          last_modified_by?: string | null
          power_requirements?: string | null
          schedule?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          auxiliary_needs?: string | null
          created_at?: string | null
          event_dates?: string | null
          event_name?: string | null
          id?: string
          job_id?: string | null
          last_modified?: string | null
          last_modified_by?: string | null
          power_requirements?: string | null
          schedule?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoja_de_ruta_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_de_ruta_last_modified_by_fkey"
            columns: ["last_modified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "hoja_de_ruta_contacts_hoja_de_ruta_id_fkey"
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
            foreignKeyName: "hoja_de_ruta_logistics_hoja_de_ruta_id_fkey"
            columns: ["hoja_de_ruta_id"]
            isOneToOne: false
            referencedRelation: "hoja_de_ruta"
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
            foreignKeyName: "hoja_de_ruta_rooms_staff_member2_id_fkey"
            columns: ["staff_member2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_de_ruta_staff: {
        Row: {
          hoja_de_ruta_id: string | null
          id: string
          name: string
          position: string | null
          surname1: string | null
          surname2: string | null
        }
        Insert: {
          hoja_de_ruta_id?: string | null
          id?: string
          name: string
          position?: string | null
          surname1?: string | null
          surname2?: string | null
        }
        Update: {
          hoja_de_ruta_id?: string | null
          id?: string
          name?: string
          position?: string | null
          surname1?: string | null
          surname2?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoja_de_ruta_staff_hoja_de_ruta_id_fkey"
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
            foreignKeyName: "hoja_de_ruta_travel_hoja_de_ruta_id_fkey"
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
            foreignKeyName: "job_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "lights_job_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
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
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          dark_mode: boolean | null
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
          phone: string | null
          residencia: string | null
          role: Database["public"]["Enums"]["user_role"]
          selected_job_types: string[] | null
          time_span: string | null
          timezone: string | null
          tours_expanded: boolean | null
        }
        Insert: {
          created_at?: string
          dark_mode?: boolean | null
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
          phone?: string | null
          residencia?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          selected_job_types?: string[] | null
          time_span?: string | null
          timezone?: string | null
          tours_expanded?: boolean | null
        }
        Update: {
          created_at?: string
          dark_mode?: boolean | null
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
          phone?: string | null
          residencia?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          selected_job_types?: string[] | null
          time_span?: string | null
          timezone?: string | null
          tours_expanded?: boolean | null
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
            foreignKeyName: "sound_job_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
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
            foreignKeyName: "tour_assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          flex_folders_created: boolean | null
          id: string
          is_tour_pack_only: boolean | null
          location_id: string | null
          tour_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          flex_folders_created?: boolean | null
          id?: string
          is_tour_pack_only?: boolean | null
          location_id?: string | null
          tour_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          flex_folders_created?: boolean | null
          id?: string
          is_tour_pack_only?: boolean | null
          location_id?: string | null
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
          start_date: string | null
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
          start_date?: string | null
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
          start_date?: string | null
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
            foreignKeyName: "vacation_requests_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "video_job_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
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
        ]
      }
    }
    Views: {
      current_stock_levels: {
        Row: {
          category: Database["public"]["Enums"]["equipment_category"] | null
          current_quantity: number | null
          equipment_id: string | null
          equipment_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_manage_users: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      convert_to_timezone: {
        Args: { timestamp_val: string; target_timezone?: string }
        Returns: string
      }
      create_default_logistics_events_for_job: {
        Args: { job_id: string }
        Returns: undefined
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
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
      form_status: "pending" | "submitted" | "expired"
      global_preset_status: "available" | "unavailable" | "tentative"
      job_date_type: "travel" | "setup" | "show" | "off" | "rehearsal"
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
      transport_type: "trailer" | "9m" | "8m" | "6m" | "4m" | "furgoneta" | "rv"
      transportation_type: "van" | "sleeper_bus" | "train" | "plane" | "rv"
      user_role:
        | "admin"
        | "user"
        | "management"
        | "logistics"
        | "technician"
        | "house_tech"
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
      ],
      form_status: ["pending", "submitted", "expired"],
      global_preset_status: ["available", "unavailable", "tentative"],
      job_date_type: ["travel", "setup", "show", "off", "rehearsal"],
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
      transport_type: ["trailer", "9m", "8m", "6m", "4m", "furgoneta", "rv"],
      transportation_type: ["van", "sleeper_bus", "train", "plane", "rv"],
      user_role: [
        "admin",
        "user",
        "management",
        "logistics",
        "technician",
        "house_tech",
      ],
    },
  },
} as const
