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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      crm_origins: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_origins_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sub_origins: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          origin_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          origin_id: string
          tipo?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          origin_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_sub_origins_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tab_preferences: {
        Row: {
          created_at: string
          hidden_tabs: string[]
          id: string
          sub_origin_id: string | null
          tab_labels: Json | null
          tab_order: string[]
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          hidden_tabs?: string[]
          id?: string
          sub_origin_id?: string | null
          tab_labels?: Json | null
          tab_order?: string[]
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          hidden_tabs?: string[]
          id?: string
          sub_origin_id?: string | null
          tab_labels?: Json | null
          tab_order?: string[]
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_tab_preferences_sub_origin_id_fkey"
            columns: ["sub_origin_id"]
            isOneToOne: true
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tab_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_webhooks: {
        Row: {
          auto_tag_color: string | null
          auto_tag_name: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          origin_id: string | null
          scope: string
          sub_origin_id: string | null
          trigger: string | null
          trigger_pipeline_id: string | null
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          auto_tag_color?: string | null
          auto_tag_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          origin_id?: string | null
          scope?: string
          sub_origin_id?: string | null
          trigger?: string | null
          trigger_pipeline_id?: string | null
          type: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          auto_tag_color?: string | null
          auto_tag_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          origin_id?: string | null
          scope?: string
          sub_origin_id?: string | null
          trigger?: string | null
          trigger_pipeline_id?: string | null
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_webhooks_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_webhooks_sub_origin_id_fkey"
            columns: ["sub_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_webhooks_trigger_pipeline_id_fkey"
            columns: ["trigger_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_ads_connections: {
        Row: {
          access_token: string
          access_token_expires_at: string | null
          ad_account_id: string
          ad_account_name: string | null
          created_at: string
          id: string
          is_active: boolean
          selected_campaigns: Json | null
          selected_metrics: Json | null
          updated_at: string
        }
        Insert: {
          access_token: string
          access_token_expires_at?: string | null
          ad_account_id: string
          ad_account_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          selected_campaigns?: Json | null
          selected_metrics?: Json | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          access_token_expires_at?: string | null
          ad_account_id?: string
          ad_account_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          selected_campaigns?: Json | null
          selected_metrics?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      facebook_ads_insights: {
        Row: {
          campaign_id: string
          campaign_name: string | null
          clicks: number | null
          connection_id: string
          cpc: number | null
          cpm: number | null
          created_at: string
          date_preset: string | null
          fetched_at: string
          id: string
          impressions: number | null
          spend: number | null
        }
        Insert: {
          campaign_id: string
          campaign_name?: string | null
          clicks?: number | null
          connection_id: string
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          date_preset?: string | null
          fetched_at?: string
          id?: string
          impressions?: number | null
          spend?: number | null
        }
        Update: {
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number | null
          connection_id?: string
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          date_preset?: string | null
          fetched_at?: string
          id?: string
          impressions?: number | null
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "facebook_ads_insights_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "facebook_ads_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      google_tokens: {
        Row: {
          created_at: string | null
          id: string
          refresh_token: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          refresh_token: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          refresh_token?: string
          user_id?: string | null
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          activity_group_id: string | null
          concluida: boolean
          created_at: string
          data: string
          hora: string
          id: string
          lead_id: string
          notas: string | null
          pipeline_id: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          activity_group_id?: string | null
          concluida?: boolean
          created_at?: string
          data: string
          hora?: string
          id?: string
          lead_id: string
          notas?: string | null
          pipeline_id?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          activity_group_id?: string | null
          concluida?: boolean
          created_at?: string
          data?: string
          hora?: string
          id?: string
          lead_id?: string
          notas?: string | null
          pipeline_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_custom_field_responses: {
        Row: {
          created_at: string
          field_id: string
          id: string
          lead_id: string
          response_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          lead_id: string
          response_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          lead_id?: string
          response_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_custom_field_responses_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "sub_origin_custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_custom_field_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          lead_id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          lead_id: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          lead_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tracking: {
        Row: {
          created_at: string
          dados: Json | null
          descricao: string | null
          id: string
          lead_id: string
          origem: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          descricao?: string | null
          id?: string
          lead_id: string
          origem?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          created_at?: string
          dados?: Json | null
          descricao?: string | null
          id?: string
          lead_id?: string
          origem?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tracking_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_analysis: string | null
          analysis_created_at: string | null
          assigned_to: string | null
          average_ticket: number | null
          biggest_difficulty: string | null
          can_afford: string | null
          clinic_name: string | null
          country_code: string | null
          created_at: string
          email: string
          estimated_revenue: number | null
          id: string
          instagram: string | null
          is_mql: boolean | null
          monthly_billing: string
          name: string
          ordem: number | null
          photo_url: string | null
          pipeline_id: string | null
          service_area: string
          sub_origin_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          wants_more_info: boolean | null
          weekly_attendance: string
          whatsapp: string | null
          workspace_id: string | null
          workspace_type: string
          years_experience: string
        }
        Insert: {
          ai_analysis?: string | null
          analysis_created_at?: string | null
          assigned_to?: string | null
          average_ticket?: number | null
          biggest_difficulty?: string | null
          can_afford?: string | null
          clinic_name?: string | null
          country_code?: string | null
          created_at?: string
          email: string
          estimated_revenue?: number | null
          id?: string
          instagram?: string | null
          is_mql?: boolean | null
          monthly_billing: string
          name: string
          ordem?: number | null
          photo_url?: string | null
          pipeline_id?: string | null
          service_area: string
          sub_origin_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          wants_more_info?: boolean | null
          weekly_attendance: string
          whatsapp?: string | null
          workspace_id?: string | null
          workspace_type: string
          years_experience: string
        }
        Update: {
          ai_analysis?: string | null
          analysis_created_at?: string | null
          assigned_to?: string | null
          average_ticket?: number | null
          biggest_difficulty?: string | null
          can_afford?: string | null
          clinic_name?: string | null
          country_code?: string | null
          created_at?: string
          email?: string
          estimated_revenue?: number | null
          id?: string
          instagram?: string | null
          is_mql?: boolean | null
          monthly_billing?: string
          name?: string
          ordem?: number | null
          photo_url?: string | null
          pipeline_id?: string | null
          service_area?: string
          sub_origin_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          wants_more_info?: boolean | null
          weekly_attendance?: string
          whatsapp?: string | null
          workspace_id?: string | null
          workspace_type?: string
          years_experience?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_sub_origin_id_fkey"
            columns: ["sub_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_form_templates: {
        Row: {
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_sequential: boolean
          name: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_sequential?: boolean
          name: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_sequential?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_form_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      origin_settings: {
        Row: {
          agenda_mode: boolean
          created_at: string
          id: string
          origin_id: string
          updated_at: string
        }
        Insert: {
          agenda_mode?: boolean
          created_at?: string
          id?: string
          origin_id: string
          updated_at?: string
        }
        Update: {
          agenda_mode?: boolean
          created_at?: string
          id?: string
          origin_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          page_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_path?: string
        }
        Update: {
          created_at?: string
          id?: string
          page_path?: string
        }
        Relationships: []
      }
      pipeline_automations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          pipeline_id: string | null
          sub_origin_id: string | null
          target_origin_id: string | null
          target_pipeline_id: string | null
          target_sub_origin_id: string | null
          target_type: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          pipeline_id?: string | null
          sub_origin_id?: string | null
          target_origin_id?: string | null
          target_pipeline_id?: string | null
          target_sub_origin_id?: string | null
          target_type: string
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          pipeline_id?: string | null
          sub_origin_id?: string | null
          target_origin_id?: string | null
          target_pipeline_id?: string | null
          target_sub_origin_id?: string | null
          target_type?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_automations_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_automations_sub_origin_id_fkey"
            columns: ["sub_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_automations_target_origin_id_fkey"
            columns: ["target_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_automations_target_pipeline_id_fkey"
            columns: ["target_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_automations_target_sub_origin_id_fkey"
            columns: ["target_sub_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
          ordem: number
          sub_origin_id: string | null
          workspace_id: string | null
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          sub_origin_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          sub_origin_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_sub_origin_id_fkey"
            columns: ["sub_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipelines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          amount: number
          created_at: string
          customer_name: string | null
          description: string | null
          id: string
          workspace_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_name?: string | null
          description?: string | null
          id?: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_name?: string | null
          description?: string | null
          id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_origin_custom_fields: {
        Row: {
          created_at: string
          field_key: string
          field_label: string
          field_type: string
          id: string
          is_required: boolean
          options: Json | null
          ordem: number
          sub_origin_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_label: string
          field_type?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          ordem?: number
          sub_origin_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          ordem?: number
          sub_origin_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_origin_custom_fields_sub_origin_id_fkey"
            columns: ["sub_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_sub_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          allowed_origin_ids: string[] | null
          allowed_sub_origin_ids: string[] | null
          can_create_origins: boolean
          can_create_sub_origins: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_origin_ids?: string[] | null
          allowed_sub_origin_ids?: string[] | null
          can_create_origins?: boolean
          can_create_sub_origins?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_origin_ids?: string[] | null
          allowed_sub_origin_ids?: string[] | null
          can_create_origins?: boolean
          can_create_sub_origins?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_session: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      get_csv_list_workspace_id: { Args: { _list_id: string }; Returns: string }
      get_dispatch_conversation_workspace_id: {
        Args: { _conversation_id: string }
        Returns: string
      }
      get_form_lead_workspace_id: {
        Args: { _form_id: string }
        Returns: string
      }
      get_lead_workspace_id: { Args: { _lead_id: string }; Returns: string }
      get_pipeline_automation_workspace_id: {
        Args: { _target_sub_origin_id: string }
        Returns: string
      }
      get_scheduled_email_workspace_id: {
        Args: { _scheduled_email_id: string }
        Returns: string
      }
      get_sent_email_workspace_id: {
        Args: { _sent_email_id: string }
        Returns: string
      }
      get_sub_origin_workspace_id: {
        Args: { _sub_origin_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_unread_count: {
        Args: { chat_uuid: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "suporte" | "gestor_trafego" | "closer" | "sdr"
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
      app_role: ["admin", "suporte", "gestor_trafego", "closer", "sdr"],
    },
  },
} as const
