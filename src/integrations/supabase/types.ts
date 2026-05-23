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
      admission_documents: {
        Row: {
          admission_id: string
          checklist_status: Database["public"]["Enums"]["checklist_status"]
          confianca: number | null
          created_at: string
          dados_extraidos: Json
          erro: string | null
          id: string
          mime_type: string | null
          ocr_status: Database["public"]["Enums"]["ocr_status"]
          original_name: string | null
          storage_path: string
          tamanho_bytes: number | null
          tipo: Database["public"]["Enums"]["admission_doc_type"]
        }
        Insert: {
          admission_id: string
          checklist_status?: Database["public"]["Enums"]["checklist_status"]
          confianca?: number | null
          created_at?: string
          dados_extraidos?: Json
          erro?: string | null
          id?: string
          mime_type?: string | null
          ocr_status?: Database["public"]["Enums"]["ocr_status"]
          original_name?: string | null
          storage_path: string
          tamanho_bytes?: number | null
          tipo: Database["public"]["Enums"]["admission_doc_type"]
        }
        Update: {
          admission_id?: string
          checklist_status?: Database["public"]["Enums"]["checklist_status"]
          confianca?: number | null
          created_at?: string
          dados_extraidos?: Json
          erro?: string | null
          id?: string
          mime_type?: string | null
          ocr_status?: Database["public"]["Enums"]["ocr_status"]
          original_name?: string | null
          storage_path?: string
          tamanho_bytes?: number | null
          tipo?: Database["public"]["Enums"]["admission_doc_type"]
        }
        Relationships: [
          {
            foreignKeyName: "admission_documents_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "employee_admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          endereco: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          raio_ponto_metros: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          raio_ponto_metros?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          raio_ponto_metros?: number
          updated_at?: string
        }
        Relationships: []
      }
      employee_admissions: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          dados_extraidos: Json
          employee_id: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["admission_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          dados_extraidos?: Json
          employee_id?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["admission_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          dados_extraidos?: Json
          employee_id?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["admission_status"]
          updated_at?: string
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          ai_extracted_data: Json
          company_id: string
          confianca: number | null
          created_at: string
          created_by: string | null
          document_date: string | null
          document_type: Database["public"]["Enums"]["employee_doc_type"]
          employee_id: string | null
          end_date: string | null
          id: string
          mime_type: string | null
          needs_review: boolean
          notes: string | null
          original_name: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["employee_doc_status"]
          storage_path: string
          tamanho_bytes: number | null
          updated_at: string
        }
        Insert: {
          ai_extracted_data?: Json
          company_id: string
          confianca?: number | null
          created_at?: string
          created_by?: string | null
          document_date?: string | null
          document_type: Database["public"]["Enums"]["employee_doc_type"]
          employee_id?: string | null
          end_date?: string | null
          id?: string
          mime_type?: string | null
          needs_review?: boolean
          notes?: string | null
          original_name?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["employee_doc_status"]
          storage_path: string
          tamanho_bytes?: number | null
          updated_at?: string
        }
        Update: {
          ai_extracted_data?: Json
          company_id?: string
          confianca?: number | null
          created_at?: string
          created_by?: string | null
          document_date?: string | null
          document_type?: Database["public"]["Enums"]["employee_doc_type"]
          employee_id?: string | null
          end_date?: string | null
          id?: string
          mime_type?: string | null
          needs_review?: boolean
          notes?: string | null
          original_name?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["employee_doc_status"]
          storage_path?: string
          tamanho_bytes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          admission_date: string | null
          cargo: string | null
          company_id: string
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          funcao: string | null
          id: string
          jornada_padrao_horas: number | null
          nome: string
          rg: string | null
          salario: number | null
          status: Database["public"]["Enums"]["employee_status"]
          telefone: string | null
          updated_at: string
          user_id: string | null
          work_schedule_type:
            | Database["public"]["Enums"]["work_schedule_type"]
            | null
        }
        Insert: {
          admission_date?: string | null
          cargo?: string | null
          company_id: string
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          funcao?: string | null
          id?: string
          jornada_padrao_horas?: number | null
          nome: string
          rg?: string | null
          salario?: number | null
          status?: Database["public"]["Enums"]["employee_status"]
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          work_schedule_type?:
            | Database["public"]["Enums"]["work_schedule_type"]
            | null
        }
        Update: {
          admission_date?: string | null
          cargo?: string | null
          company_id?: string
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          funcao?: string | null
          id?: string
          jornada_padrao_horas?: number | null
          nome?: string
          rg?: string | null
          salario?: number | null
          status?: Database["public"]["Enums"]["employee_status"]
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
          work_schedule_type?:
            | Database["public"]["Enums"]["work_schedule_type"]
            | null
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
      monthly_closures: {
        Row: {
          ano: number
          company_id: string
          created_at: string
          employee_id: string
          fechado_em: string | null
          fechado_por: string | null
          id: string
          mes: number
          observacoes: string | null
          status: string
          totais: Json
          updated_at: string
        }
        Insert: {
          ano: number
          company_id: string
          created_at?: string
          employee_id: string
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          mes: number
          observacoes?: string | null
          status?: string
          totais?: Json
          updated_at?: string
        }
        Update: {
          ano?: number
          company_id?: string
          created_at?: string
          employee_id?: string
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          mes?: number
          observacoes?: string | null
          status?: string
          totais?: Json
          updated_at?: string
        }
        Relationships: []
      }
      payroll_adjustments: {
        Row: {
          batch_id: string | null
          company_id: string
          created_at: string
          data: string | null
          employee_id: string
          id: string
          notes: string | null
          origem_documento_id: string | null
          tipo: Database["public"]["Enums"]["payroll_adj_type"]
          valor_horas: number
          valor_monetario: number | null
        }
        Insert: {
          batch_id?: string | null
          company_id: string
          created_at?: string
          data?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          origem_documento_id?: string | null
          tipo: Database["public"]["Enums"]["payroll_adj_type"]
          valor_horas?: number
          valor_monetario?: number | null
        }
        Update: {
          batch_id?: string | null
          company_id?: string
          created_at?: string
          data?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          origem_documento_id?: string | null
          tipo?: Database["public"]["Enums"]["payroll_adj_type"]
          valor_horas?: number
          valor_monetario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_adjustments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "timesheet_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
      punch_records: {
        Row: {
          accuracy: number | null
          company_id: string
          created_at: string
          dentro_do_raio: boolean
          distancia_metros: number | null
          employee_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          origem: string
          registrado_em: string
          tipo: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          company_id: string
          created_at?: string
          dentro_do_raio?: boolean
          distancia_metros?: number | null
          employee_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          origem?: string
          registrado_em?: string
          tipo: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          company_id?: string
          created_at?: string
          dentro_do_raio?: boolean
          distancia_metros?: number | null
          employee_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          origem?: string
          registrado_em?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          absence_type: string | null
          batch_id: string
          confianca: number | null
          cpf_lido: string | null
          created_at: string
          data: string | null
          dia_semana: string | null
          dsr_discount_applicable: boolean
          employee_id: string | null
          entrada: string | null
          funcao_lida: string | null
          has_medical_certificate: boolean
          id: string
          is_absence: boolean
          is_justified: boolean
          missing_hours: number
          night_hours: number
          nome_lido: string | null
          observacoes: string | null
          overtime_hours: number
          page_id: string | null
          retorno_intervalo: string | null
          revisado: boolean
          revisado_em: string | null
          revisado_por: string | null
          saida_final: string | null
          saida_intervalo: string | null
          source_document_id: string | null
          status: Database["public"]["Enums"]["entry_status"]
          updated_at: string
          worked_hours: number
        }
        Insert: {
          absence_type?: string | null
          batch_id: string
          confianca?: number | null
          cpf_lido?: string | null
          created_at?: string
          data?: string | null
          dia_semana?: string | null
          dsr_discount_applicable?: boolean
          employee_id?: string | null
          entrada?: string | null
          funcao_lida?: string | null
          has_medical_certificate?: boolean
          id?: string
          is_absence?: boolean
          is_justified?: boolean
          missing_hours?: number
          night_hours?: number
          nome_lido?: string | null
          observacoes?: string | null
          overtime_hours?: number
          page_id?: string | null
          retorno_intervalo?: string | null
          revisado?: boolean
          revisado_em?: string | null
          revisado_por?: string | null
          saida_final?: string | null
          saida_intervalo?: string | null
          source_document_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          updated_at?: string
          worked_hours?: number
        }
        Update: {
          absence_type?: string | null
          batch_id?: string
          confianca?: number | null
          cpf_lido?: string | null
          created_at?: string
          data?: string | null
          dia_semana?: string | null
          dsr_discount_applicable?: boolean
          employee_id?: string | null
          entrada?: string | null
          funcao_lida?: string | null
          has_medical_certificate?: boolean
          id?: string
          is_absence?: boolean
          is_justified?: boolean
          missing_hours?: number
          night_hours?: number
          nome_lido?: string | null
          observacoes?: string | null
          overtime_hours?: number
          page_id?: string | null
          retorno_intervalo?: string | null
          revisado?: boolean
          revisado_em?: string | null
          revisado_por?: string | null
          saida_final?: string | null
          saida_intervalo?: string | null
          source_document_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          updated_at?: string
          worked_hours?: number
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
      apply_medical_certificate: {
        Args: {
          _document_id?: string
          _employee_id: string
          _end: string
          _start: string
        }
        Returns: number
      }
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
      is_dp_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      recompute_dsr_for_employee_month: {
        Args: { _ano: number; _employee_id: string; _mes: number }
        Returns: number
      }
    }
    Enums: {
      admission_doc_type:
        | "ficha"
        | "rg"
        | "cpf"
        | "comprovante_residencia"
        | "ctps"
        | "contrato"
        | "exame_admissional"
        | "outro"
      admission_status: "em_analise" | "aprovado" | "rejeitado"
      app_role:
        | "super_admin"
        | "admin"
        | "revisor"
        | "funcionario"
        | "dp"
        | "gestor"
      batch_status:
        | "enviado"
        | "processando"
        | "aguardando_revisao"
        | "revisado"
        | "exportado"
      checklist_status: "recebido" | "pendente" | "rejeitado" | "em_analise"
      employee_doc_status: "pendente_revisao" | "validado" | "rejeitado"
      employee_doc_type:
        | "atestado"
        | "advertencia"
        | "suspensao"
        | "declaracao"
        | "justificativa"
        | "outro"
        | "ferias"
        | "aviso_previo"
        | "rescisao"
        | "comprovante_pagamento"
      employee_status: "ativo" | "pendente_validacao" | "inativo"
      entry_status: "ok" | "inconsistente" | "falta" | "folga" | "feriado"
      ocr_status: "pendente" | "processando" | "concluido" | "falhou"
      payroll_adj_type: "dsr_desconto" | "he_extra" | "outro"
      work_schedule_type: "5x2" | "6x1" | "12x36" | "escala" | "outro"
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
      admission_doc_type: [
        "ficha",
        "rg",
        "cpf",
        "comprovante_residencia",
        "ctps",
        "contrato",
        "exame_admissional",
        "outro",
      ],
      admission_status: ["em_analise", "aprovado", "rejeitado"],
      app_role: [
        "super_admin",
        "admin",
        "revisor",
        "funcionario",
        "dp",
        "gestor",
      ],
      batch_status: [
        "enviado",
        "processando",
        "aguardando_revisao",
        "revisado",
        "exportado",
      ],
      checklist_status: ["recebido", "pendente", "rejeitado", "em_analise"],
      employee_doc_status: ["pendente_revisao", "validado", "rejeitado"],
      employee_doc_type: [
        "atestado",
        "advertencia",
        "suspensao",
        "declaracao",
        "justificativa",
        "outro",
        "ferias",
        "aviso_previo",
        "rescisao",
        "comprovante_pagamento",
      ],
      employee_status: ["ativo", "pendente_validacao", "inativo"],
      entry_status: ["ok", "inconsistente", "falta", "folga", "feriado"],
      ocr_status: ["pendente", "processando", "concluido", "falhou"],
      payroll_adj_type: ["dsr_desconto", "he_extra", "outro"],
      work_schedule_type: ["5x2", "6x1", "12x36", "escala", "outro"],
    },
  },
} as const
