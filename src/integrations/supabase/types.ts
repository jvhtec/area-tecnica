export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          foh_tech: boolean | null
          id: string
          iem_band: string | null
          iem_model: string | null
          iem_quantity: number | null
          infra_analog: number | null
          infra_cat6: boolean | null
          infra_coax: boolean | null
          infra_hma: boolean | null
          job_id: string | null
          mic_pack: string | null
          mon_console: string | null
          mon_tech: boolean | null
          monitors_enabled: boolean | null
          monitors_quantity: number | null
          name: string
          notes: string | null
          rf_festival_mics: number | null
          rf_festival_url: string | null
          rf_festival_wireless: number | null
          show_end: string | null
          show_start: string | null
          soundcheck: boolean | null
          soundcheck_end: string | null
          soundcheck_start: string | null
          stage: string | null
          updated_at: string | null
          wireless_band: string | null
          wireless_model: string | null
          wireless_quantity: number | null
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
          foh_tech?: boolean | null
          id?: string
          iem_band?: string | null
          iem_model?: string | null
          iem_quantity?: number | null
          infra_analog?: number | null
          infra_cat6?: boolean | null
          infra_coax?: boolean | null
          infra_hma?: boolean | null
          job_id?: string | null
          mic_pack?: string | null
          mon_console?: string | null
          mon_tech?: boolean | null
          monitors_enabled?: boolean | null
          monitors_quantity?: number | null
          name: string
          notes?: string | null
          rf_festival_mics?: number | null
          rf_festival_url?: string | null
          rf_festival_wireless?: number | null
          show_end?: string | null
          show_start?: string | null
          soundcheck?: boolean | null
          soundcheck_end?: string | null
          soundcheck_start?: string | null
          stage?: string | null
          updated_at?: string | null
          wireless_band?: string | null
          wireless_model?: string | null
          wireless_quantity?: number | null
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
          foh_tech?: boolean | null
          id?: string
          iem_band?: string | null
          iem_model?: string | null
          iem_quantity?: number | null
          infra_analog?: number | null
          infra_cat6?: boolean | null
          infra_coax?: boolean | null
          infra_hma?: boolean | null
          job_id?: string | null
          mic_pack?: string | null
          mon_console?: string | null
          mon_tech?: boolean | null
          monitors_enabled?: boolean | null
          monitors_quantity?: number | null
          name?: string
          notes?: string | null
          rf_festival_mics?: number | null
          rf_festival_url?: string | null
          rf_festival_wireless?: number | null
          show_end?: string | null
          show_start?: string | null
          soundcheck?: boolean | null
          soundcheck_end?: string | null
          soundcheck_start?: string | null
          stage?: string | null
          updated_at?: string | null
          wireless_band?: string | null
          wireless_model?: string | null
          wireless_quantity?: number | null
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
      hoja_de_ruta: {
        Row: {
          auxiliary_needs: string | null
          created_at: string | null
          event_dates: string | null
          event_name: string | null
          id: string
          job_id: string | null
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
          hoja_de_ruta_id: string | null
          id: string
          loading_details: string | null
          transport: string | null
          unloading_details: string | null
        }
        Insert: {
          hoja_de_ruta_id?: string | null
          id?: string
          loading_details?: string | null
          transport?: string | null
          unloading_details?: string | null
        }
        Update: {
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
          created_at: string | null
          event_date: string
          event_time: string
          event_type: Database["public"]["Enums"]["logistics_event_type"]
          id: string
          job_id: string | null
          license_plate: string | null
          loading_bay: string | null
          notes: string | null
          title: string | null
          transport_type: Database["public"]["Enums"]["transport_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_date: string
          event_time: string
          event_type: Database["public"]["Enums"]["logistics_event_type"]
          id?: string
          job_id?: string | null
          license_plate?: string | null
          loading_bay?: string | null
          notes?: string | null
          title?: string | null
          transport_type: Database["public"]["Enums"]["transport_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_date?: string
          event_time?: string
          event_type?: Database["public"]["Enums"]["logistics_event_type"]
          id?: string
          job_id?: string | null
          license_plate?: string | null
          loading_bay?: string | null
          notes?: string | null
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
      profiles: {
        Row: {
          created_at: string
          dark_mode: boolean | null
          department: string | null
          dni: string | null
          email: string
          first_name: string | null
          id: string
          last_activity: string | null
          last_name: string | null
          phone: string | null
          residencia: string | null
          role: Database["public"]["Enums"]["user_role"]
          selected_job_types: string[] | null
          time_span: string | null
          tours_expanded: boolean | null
        }
        Insert: {
          created_at?: string
          dark_mode?: boolean | null
          department?: string | null
          dni?: string | null
          email: string
          first_name?: string | null
          id: string
          last_activity?: string | null
          last_name?: string | null
          phone?: string | null
          residencia?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          selected_job_types?: string[] | null
          time_span?: string | null
          tours_expanded?: boolean | null
        }
        Update: {
          created_at?: string
          dark_mode?: boolean | null
          department?: string | null
          dni?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_activity?: string | null
          last_name?: string | null
          phone?: string | null
          residencia?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          selected_job_types?: string[] | null
          time_span?: string | null
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
      tour_dates: {
        Row: {
          created_at: string
          date: string
          flex_folders_created: boolean | null
          id: string
          location_id: string | null
          tour_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          flex_folders_created?: boolean | null
          id?: string
          location_id?: string | null
          tour_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          flex_folders_created?: boolean | null
          id?: string
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
      tours: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          deleted: boolean | null
          description: string | null
          end_date: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_default_logistics_events_for_job: {
        Args: {
          job_id: string
        }
        Returns: undefined
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
      job_date_type: "travel" | "setup" | "show" | "off" | "rehearsal"
      job_status: "pending" | "in_progress" | "completed" | "cancelled"
      job_type: "single" | "tour" | "festival" | "dryhire" | "tourdate"
      logistics_event_type: "load" | "unload"
      message_status: "unread" | "read"
      milestone_category:
        | "planning"
        | "technical"
        | "logistics"
        | "administrative"
        | "production"
      project_status: "pending" | "in_progress" | "completed" | "cancelled"
      room_type: "single" | "double"
      task_status: "not_started" | "in_progress" | "completed"
      transport_type: "trailer" | "9m" | "8m" | "6m" | "4m" | "furgoneta" | "rv"
      transportation_type: "van" | "sleeper_bus" | "train" | "plane" | "rv"
      user_role: "admin" | "user" | "management" | "logistics" | "technician"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
