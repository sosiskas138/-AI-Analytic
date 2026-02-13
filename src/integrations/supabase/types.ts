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
      calls: {
        Row: {
          billed_minutes: number
          call_at: string
          call_attempt_number: number
          call_list: string | null
          created_at: string
          duration_seconds: number
          end_reason: string | null
          external_call_id: string
          id: string
          is_first_attempt: boolean
          is_lead: boolean
          phone_normalized: string
          phone_raw: string
          project_id: string
          skill_base: string | null
          status: string
          supplier_number_id: string | null
        }
        Insert: {
          billed_minutes?: number
          call_at: string
          call_attempt_number?: number
          call_list?: string | null
          created_at?: string
          duration_seconds?: number
          end_reason?: string | null
          external_call_id: string
          id?: string
          is_first_attempt?: boolean
          is_lead?: boolean
          phone_normalized: string
          phone_raw: string
          project_id: string
          skill_base?: string | null
          status?: string
          supplier_number_id?: string | null
        }
        Update: {
          billed_minutes?: number
          call_at?: string
          call_attempt_number?: number
          call_list?: string | null
          created_at?: string
          duration_seconds?: number
          end_reason?: string | null
          external_call_id?: string
          id?: string
          is_first_attempt?: boolean
          is_lead?: boolean
          phone_normalized?: string
          phone_raw?: string
          project_id?: string
          skill_base?: string | null
          status?: string
          supplier_number_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_supplier_number_id_fkey"
            columns: ["supplier_number_id"]
            isOneToOne: false
            referencedRelation: "supplier_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          error_rows: number
          filename: string
          id: string
          inserted_rows: number
          project_id: string
          skipped_duplicates: number
          total_rows: number
          type: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          error_rows?: number
          filename?: string
          id?: string
          inserted_rows?: number
          project_id: string
          skipped_duplicates?: number
          total_rows?: number
          type: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          error_rows?: number
          filename?: string
          id?: string
          inserted_rows?: number
          project_id?: string
          skipped_duplicates?: number
          total_rows?: number
          type?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          allowed_tabs: string[]
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          allowed_tabs?: string[]
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          allowed_tabs?: string[]
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_pricing: {
        Row: {
          created_at: string
          id: string
          price_per_call: number
          price_per_contact: number
          price_per_minute: number
          price_per_number: number
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_per_call?: number
          price_per_contact?: number
          price_per_minute?: number
          price_per_number?: number
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          price_per_call?: number
          price_per_contact?: number
          price_per_minute?: number
          price_per_number?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_pricing_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status: {
        Row: {
          analysis_link: string | null
          comment: string | null
          company_activity: string | null
          company_name: string | null
          created_at: string
          id: string
          is_active: boolean
          launched_to_production: boolean | null
          materials_requested: boolean | null
          materials_sent: boolean | null
          project_id: string
          report_day_1: boolean | null
          report_day_2: boolean | null
          report_day_3: boolean | null
          report_day_4: boolean | null
          report_day_5: boolean | null
          report_day_6: boolean | null
          report_day_7: boolean | null
          responsible: string | null
          skillbase_ready: boolean | null
          test_launched: boolean | null
          updated_at: string
          weekly_report: boolean | null
        }
        Insert: {
          analysis_link?: string | null
          comment?: string | null
          company_activity?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          launched_to_production?: boolean | null
          materials_requested?: boolean | null
          materials_sent?: boolean | null
          project_id: string
          report_day_1?: boolean | null
          report_day_2?: boolean | null
          report_day_3?: boolean | null
          report_day_4?: boolean | null
          report_day_5?: boolean | null
          report_day_6?: boolean | null
          report_day_7?: boolean | null
          responsible?: string | null
          skillbase_ready?: boolean | null
          test_launched?: boolean | null
          updated_at?: string
          weekly_report?: boolean | null
        }
        Update: {
          analysis_link?: string | null
          comment?: string | null
          company_activity?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          launched_to_production?: boolean | null
          materials_requested?: boolean | null
          materials_sent?: boolean | null
          project_id?: string
          report_day_1?: boolean | null
          report_day_2?: boolean | null
          report_day_3?: boolean | null
          report_day_4?: boolean | null
          report_day_5?: boolean | null
          report_day_6?: boolean | null
          report_day_7?: boolean | null
          responsible?: string | null
          skillbase_ready?: boolean | null
          test_launched?: boolean | null
          updated_at?: string
          weekly_report?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "project_status_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          has_gck: boolean
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          has_gck?: boolean
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          has_gck?: boolean
          id?: string
          name?: string
        }
        Relationships: []
      }
      reanimation_export_numbers: {
        Row: {
          export_id: string
          id: string
          phone_normalized: string
        }
        Insert: {
          export_id: string
          id?: string
          phone_normalized: string
        }
        Update: {
          export_id?: string
          id?: string
          phone_normalized?: string
        }
        Relationships: [
          {
            foreignKeyName: "reanimation_export_numbers_export_id_fkey"
            columns: ["export_id"]
            isOneToOne: false
            referencedRelation: "reanimation_exports"
            referencedColumns: ["id"]
          },
        ]
      }
      reanimation_exports: {
        Row: {
          date_from: string | null
          date_to: string | null
          duration_filter: string
          exported_at: string
          exported_by: string | null
          filename: string
          id: string
          phone_count: number
          project_id: string
        }
        Insert: {
          date_from?: string | null
          date_to?: string | null
          duration_filter?: string
          exported_at?: string
          exported_by?: string | null
          filename?: string
          id?: string
          phone_count?: number
          project_id: string
        }
        Update: {
          date_from?: string | null
          date_to?: string | null
          duration_filter?: string
          exported_at?: string
          exported_by?: string | null
          filename?: string
          id?: string
          phone_count?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reanimation_exports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_numbers: {
        Row: {
          created_at: string
          id: string
          is_duplicate_in_project: boolean
          phone_normalized: string
          phone_raw: string
          project_id: string
          received_at: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_duplicate_in_project?: boolean
          phone_normalized: string
          phone_raw: string
          project_id: string
          received_at?: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_duplicate_in_project?: boolean
          phone_normalized?: string
          phone_raw?: string
          project_id?: string
          received_at?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_numbers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_numbers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          is_gck: boolean
          name: string
          price_per_contact: number
          project_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_gck?: boolean
          name: string
          price_per_contact?: number
          project_id: string
          tag?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_gck?: boolean
          name?: string
          price_per_contact?: number
          project_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      delete_project: { Args: { _project_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member"
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
      app_role: ["admin", "member"],
    },
  },
} as const
