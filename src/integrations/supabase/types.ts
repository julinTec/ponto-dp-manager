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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          company_id: string
          cpf: string | null
          created_at: string
          funcao: string | null
          id: string
          jornada_padrao_horas: number | null
          nome: string
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          cpf?: string | null
          created_at?: string
          funcao?: string | null
          id?: string
          jornada_padrao_horas?: number | null
          nome: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          cpf?: string | null
          created_at?: string
          funcao?: string | null
          id?: string
          jornada_padrao_horas?: number | null
          nome?: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_logs: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          mensagem: string
          nivel: string
          payload: Json | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          mensagem: string
          nivel?: string
          payload?: Json | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          mensagem?: string
          nivel?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "processing_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "timesheet_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          batch_id: string
          confianca: number | null
          cpf_lido: string | null
          created_at: string
          data: string | null
          dia_semana: string | null
          employee_id: string | null
          entrada: string | null
          funcao_lida: string | null
          id: string
          nome_lido: string | null
          observacoes: string | null
          page_id: string | null
          retorno_intervalo: string | null
          revisado: boolean
          revisado_em: string | null
          revisado_por: string | null
          saida_final: string | null
          saida_intervalo: string | null
          status: Database["public"]["Enums"]["entry_status"]
          updated_at: string
        }
        Insert: {
          batch_id: string
          confianca?: number | null
          cpf_lido?: string | null
          created_at?: string
          data?: string | null
          dia_semana?: string | null
          employee_id?: string | null
          entrada?: string | null
          funcao_lida?: string | null
          id?: string
          nome_lido?: string | null
          observacoes?: string | null
          page_id?: string | null
          retorno_intervalo?: string | null
          revisado?: boolean
          revisado_em?: string | null
          revisado_por?: string | null
          saida_final?: string | null
          saida_intervalo?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          updated_at?: string
        }
        Update: {
          batch_id?: string
          confianca?: number | null
          cpf_lido?: string | null
          created_at?: string
          data?: string | null
          dia_semana?: string | null
          employee_id?: string | null
          entrada?: string | null
          funcao_lida?: string | null
          id?: string
          nome_lido?: string | null
          observacoes?: string | null
          page_id?: string | null
          retorno_intervalo?: string | null
          revisado?: boolean
          revisado_em?: string | null
          revisado_por?: string | null
          saida_final?: string | null
          saida_intervalo?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "timesheet_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "timesheet_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_batches: {
        Row: {
          ano_referencia: number | null
          company_id: string
          created_at: string
          criado_por: string | null
          id: string
          mes_referencia: number | null
          nome: string
          observacoes: string | null
          status: Database["public"]["Enums"]["batch_status"]
          total_marcacoes: number | null
          total_paginas: number | null
          updated_at: string
        }
        Insert: {
          ano_referencia?: number | null
          company_id: string
          created_at?: string
          criado_por?: string | null
          id?: string
          mes_referencia?: number | null
          nome: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          total_marcacoes?: number | null
          total_paginas?: number | null
          updated_at?: string
        }
        Update: {
          ano_referencia?: number | null
          company_id?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          mes_referencia?: number | null
          nome?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          total_marcacoes?: number | null
          total_paginas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_files: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          mime_type: string | null
          original_name: string | null
          storage_path: string
          tamanho_bytes: number | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          mime_type?: string | null
          original_name?: string | null
          storage_path: string
          tamanho_bytes?: number | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          original_name?: string | null
          storage_path?: string
          tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_files_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "timesheet_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_pages: {
        Row: {
          batch_id: string
          confianca_media: number | null
          created_at: string
          erro: string | null
          file_id: string
          id: string
          image_path: string | null
          numero_pagina: number
          ocr_status: Database["public"]["Enums"]["ocr_status"]
        }
        Insert: {
          batch_id: string
          confianca_media?: number | null
          created_at?: string
          erro?: string | null
          file_id: string
          id?: string
          image_path?: string | null
          numero_pagina: number
          ocr_status?: Database["public"]["Enums"]["ocr_status"]
        }
        Update: {
          batch_id?: string
          confianca_media?: number | null
          created_at?: string
          erro?: string | null
          file_id?: string
          id?: string
          image_path?: string | null
          numero_pagina?: number
          ocr_status?: Database["public"]["Enums"]["ocr_status"]
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_pages_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "timesheet_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_pages_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "timesheet_files"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_company: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "revisor"
      batch_status:
        | "enviado"
        | "processando"
        | "aguardando_revisao"
        | "revisado"
        | "exportado"
      employee_status: "ativo" | "pendente_validacao" | "inativo"
      entry_status: "ok" | "inconsistente" | "falta" | "folga" | "feriado"
      ocr_status: "pendente" | "processando" | "concluido" | "falhou"
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
      app_role: ["super_admin", "admin", "revisor"],
      batch_status: [
        "enviado",
        "processando",
        "aguardando_revisao",
        "revisado",
        "exportado",
      ],
      employee_status: ["ativo", "pendente_validacao", "inativo"],
      entry_status: ["ok", "inconsistente", "falta", "folga", "feriado"],
      ocr_status: ["pendente", "processando", "concluido", "falhou"],
    },
  },
} as const
