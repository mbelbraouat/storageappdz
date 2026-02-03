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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      archive_boxes: {
        Row: {
          box_number: number | null
          column_position: string
          created_at: string
          current_count: number
          id: string
          is_active: boolean
          max_capacity: number
          name: string
          qr_code: string | null
          shelf: string
          side: string
          status: string
          updated_at: string
        }
        Insert: {
          box_number?: number | null
          column_position: string
          created_at?: string
          current_count?: number
          id?: string
          is_active?: boolean
          max_capacity?: number
          name: string
          qr_code?: string | null
          shelf: string
          side: string
          status?: string
          updated_at?: string
        }
        Update: {
          box_number?: number | null
          column_position?: string
          created_at?: string
          current_count?: number
          id?: string
          is_active?: boolean
          max_capacity?: number
          name?: string
          qr_code?: string | null
          shelf?: string
          side?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      archive_files: {
        Row: {
          archive_id: string
          created_at: string
          file_name: string | null
          file_type_id: string
          file_url: string | null
          id: string
          is_attached: boolean
        }
        Insert: {
          archive_id: string
          created_at?: string
          file_name?: string | null
          file_type_id: string
          file_url?: string | null
          id?: string
          is_attached?: boolean
        }
        Update: {
          archive_id?: string
          created_at?: string
          file_name?: string | null
          file_type_id?: string
          file_url?: string | null
          id?: string
          is_attached?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "archive_files_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "archives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_files_file_type_id_fkey"
            columns: ["file_type_id"]
            isOneToOne: false
            referencedRelation: "file_types"
            referencedColumns: ["id"]
          },
        ]
      }
      archives: {
        Row: {
          admission_id: string
          archive_number: number | null
          box_id: string
          created_at: string
          created_by: string
          doctor_id: string
          id: string
          is_archived: boolean
          notes: string | null
          operation_acte_id: string
          patient_full_name: string
          patient_id: string
          updated_at: string
          year: number
        }
        Insert: {
          admission_id: string
          archive_number?: number | null
          box_id: string
          created_at?: string
          created_by: string
          doctor_id: string
          id?: string
          is_archived?: boolean
          notes?: string | null
          operation_acte_id: string
          patient_full_name: string
          patient_id: string
          updated_at?: string
          year?: number
        }
        Update: {
          admission_id?: string
          archive_number?: number | null
          box_id?: string
          created_at?: string
          created_by?: string
          doctor_id?: string
          id?: string
          is_archived?: boolean
          notes?: string | null
          operation_acte_id?: string
          patient_full_name?: string
          patient_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "archives_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "archive_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archives_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archives_operation_acte_id_fkey"
            columns: ["operation_acte_id"]
            isOneToOne: false
            referencedRelation: "operation_actes"
            referencedColumns: ["id"]
          },
        ]
      }
      box_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          bloc_operatoire: string | null
          box_id: string
          id: string
          notes: string | null
          requested_at: string
          returned_at: string | null
          service_id: string
          status: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          bloc_operatoire?: string | null
          box_id: string
          id?: string
          notes?: string | null
          requested_at?: string
          returned_at?: string | null
          service_id: string
          status?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          bloc_operatoire?: string | null
          box_id?: string
          id?: string
          notes?: string | null
          requested_at?: string
          returned_at?: string | null
          service_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "box_assignments_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "instrument_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "box_assignments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      box_movements: {
        Row: {
          action: string
          box_id: string
          created_at: string
          from_location: string | null
          id: string
          notes: string | null
          performed_by: string
          to_location: string | null
        }
        Insert: {
          action: string
          box_id: string
          created_at?: string
          from_location?: string | null
          id?: string
          notes?: string | null
          performed_by: string
          to_location?: string | null
        }
        Update: {
          action?: string
          box_id?: string
          created_at?: string
          from_location?: string | null
          id?: string
          notes?: string | null
          performed_by?: string
          to_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "box_movements_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "archive_boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          local_archive: boolean
          specialty: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          local_archive?: boolean
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          local_archive?: boolean
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      file_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_required: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      instrument_boxes: {
        Row: {
          assigned_bloc: string | null
          assigned_service_id: string | null
          box_code: string
          created_at: string
          current_step: Database["public"]["Enums"]["sterilization_step"] | null
          description: string | null
          id: string
          is_active: boolean
          last_sterilized_at: string | null
          name: string
          next_sterilization_due: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["sterilization_status"]
          sterilization_type:
            | Database["public"]["Enums"]["sterilization_type"]
            | null
          technique_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_bloc?: string | null
          assigned_service_id?: string | null
          box_code: string
          created_at?: string
          current_step?:
            | Database["public"]["Enums"]["sterilization_step"]
            | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_sterilized_at?: string | null
          name: string
          next_sterilization_due?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["sterilization_status"]
          sterilization_type?:
            | Database["public"]["Enums"]["sterilization_type"]
            | null
          technique_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_bloc?: string | null
          assigned_service_id?: string | null
          box_code?: string
          created_at?: string
          current_step?:
            | Database["public"]["Enums"]["sterilization_step"]
            | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_sterilized_at?: string | null
          name?: string
          next_sterilization_due?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["sterilization_status"]
          sterilization_type?:
            | Database["public"]["Enums"]["sterilization_type"]
            | null
          technique_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instrument_boxes_assigned_service_id_fkey"
            columns: ["assigned_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrument_boxes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrument_boxes_technique_id_fkey"
            columns: ["technique_id"]
            isOneToOne: false
            referencedRelation: "sterilization_techniques"
            referencedColumns: ["id"]
          },
        ]
      }
      instrument_movements: {
        Row: {
          action: string
          box_id: string | null
          created_at: string
          from_status:
            | Database["public"]["Enums"]["sterilization_status"]
            | null
          id: string
          instrument_id: string | null
          notes: string | null
          performed_by: string
          to_status: Database["public"]["Enums"]["sterilization_status"] | null
        }
        Insert: {
          action: string
          box_id?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["sterilization_status"]
            | null
          id?: string
          instrument_id?: string | null
          notes?: string | null
          performed_by: string
          to_status?: Database["public"]["Enums"]["sterilization_status"] | null
        }
        Update: {
          action?: string
          box_id?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["sterilization_status"]
            | null
          id?: string
          instrument_id?: string | null
          notes?: string | null
          performed_by?: string
          to_status?: Database["public"]["Enums"]["sterilization_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "instrument_movements_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "instrument_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrument_movements_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          box_id: string | null
          condition: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          instrument_code: string
          is_active: boolean
          name: string
          status: Database["public"]["Enums"]["sterilization_status"]
          updated_at: string
        }
        Insert: {
          box_id?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          instrument_code: string
          is_active?: boolean
          name: string
          status?: Database["public"]["Enums"]["sterilization_status"]
          updated_at?: string
        }
        Update: {
          box_id?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          instrument_code?: string
          is_active?: boolean
          name?: string
          status?: Database["public"]["Enums"]["sterilization_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instruments_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "instrument_boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message: string
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      operation_actes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          is_allowed: boolean
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_allowed?: boolean
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_allowed?: boolean
          permission_key?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sterilization_cycle_boxes: {
        Row: {
          box_id: string
          created_at: string
          cycle_id: string
          id: string
          result: string | null
        }
        Insert: {
          box_id: string
          created_at?: string
          cycle_id: string
          id?: string
          result?: string | null
        }
        Update: {
          box_id?: string
          created_at?: string
          cycle_id?: string
          id?: string
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sterilization_cycle_boxes_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "instrument_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sterilization_cycle_boxes_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "sterilization_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      sterilization_cycles: {
        Row: {
          completed_at: string | null
          created_at: string
          cycle_number: number
          duration_minutes: number | null
          id: string
          machine_id: string | null
          notes: string | null
          operator_id: string
          pressure: number | null
          started_at: string
          status: string
          temperature: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          cycle_number: number
          duration_minutes?: number | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          operator_id: string
          pressure?: number | null
          started_at?: string
          status?: string
          temperature?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          cycle_number?: number
          duration_minutes?: number | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          operator_id?: string
          pressure?: number | null
          started_at?: string
          status?: string
          temperature?: number | null
        }
        Relationships: []
      }
      sterilization_techniques: {
        Row: {
          code: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean
          name: string
          pressure: number | null
          temperature: number | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name: string
          pressure?: number | null
          temperature?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name?: string
          pressure?: number | null
          temperature?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sterilization_workflow_log: {
        Row: {
          box_id: string
          created_at: string
          from_step: Database["public"]["Enums"]["sterilization_step"] | null
          id: string
          notes: string | null
          performed_by: string
          sterilization_type:
            | Database["public"]["Enums"]["sterilization_type"]
            | null
          to_step: Database["public"]["Enums"]["sterilization_step"]
          validation_result: string | null
        }
        Insert: {
          box_id: string
          created_at?: string
          from_step?: Database["public"]["Enums"]["sterilization_step"] | null
          id?: string
          notes?: string | null
          performed_by: string
          sterilization_type?:
            | Database["public"]["Enums"]["sterilization_type"]
            | null
          to_step: Database["public"]["Enums"]["sterilization_step"]
          validation_result?: string | null
        }
        Update: {
          box_id?: string
          created_at?: string
          from_step?: Database["public"]["Enums"]["sterilization_step"] | null
          id?: string
          notes?: string | null
          performed_by?: string
          sterilization_type?:
            | Database["public"]["Enums"]["sterilization_type"]
            | null
          to_step?: Database["public"]["Enums"]["sterilization_step"]
          validation_result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sterilization_workflow_log_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "instrument_boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_sterilization: { Args: { _user_id: string }; Returns: boolean }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "instrumentiste"
      sterilization_status:
        | "dirty"
        | "cleaning"
        | "ready_for_sterilization"
        | "sterilizing"
        | "sterile"
        | "in_use"
      sterilization_step:
        | "reception"
        | "pre_disinfection"
        | "cleaning"
        | "conditioning"
        | "sterilization"
        | "control"
        | "storage"
        | "distribution"
      sterilization_type: "vapeur" | "plasma" | "oxyde_ethylene" | "radiation"
    }
    CompositeTypes: {
      [_ in never]: never
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
      app_role: ["admin", "user", "instrumentiste"],
      sterilization_status: [
        "dirty",
        "cleaning",
        "ready_for_sterilization",
        "sterilizing",
        "sterile",
        "in_use",
      ],
      sterilization_step: [
        "reception",
        "pre_disinfection",
        "cleaning",
        "conditioning",
        "sterilization",
        "control",
        "storage",
        "distribution",
      ],
      sterilization_type: ["vapeur", "plasma", "oxyde_ethylene", "radiation"],
    },
  },
} as const
