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
      accounting_dimensions: {
        Row: {
          code: string
          cooperative_id: string
          created_at: string
          created_by: string | null
          dimension_type: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          dimension_type: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          dimension_type?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_dimensions_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_exceptions: {
        Row: {
          amount: number | null
          cooperative_id: string
          created_at: string
          details: Json | null
          event_code: string
          id: string
          journal_id: string | null
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["accounting_exception_status"]
          updated_at: string
        }
        Insert: {
          amount?: number | null
          cooperative_id: string
          created_at?: string
          details?: Json | null
          event_code: string
          id?: string
          journal_id?: string | null
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["accounting_exception_status"]
          updated_at?: string
        }
        Update: {
          amount?: number | null
          cooperative_id?: string
          created_at?: string
          details?: Json | null
          event_code?: string
          id?: string
          journal_id?: string | null
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["accounting_exception_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_exceptions_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_exceptions_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_mappings: {
        Row: {
          cooperative_id: string
          created_at: string
          created_by: string | null
          credit_account_id: string | null
          debit_account_id: string | null
          description: string | null
          event_code: string
          id: string
          is_active: boolean
          loan_product_id: string | null
          priority: number
          savings_product_id: string | null
          source_channel: string | null
          updated_at: string
          updated_by: string | null
          withdrawal_type_id: string | null
        }
        Insert: {
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          credit_account_id?: string | null
          debit_account_id?: string | null
          description?: string | null
          event_code: string
          id?: string
          is_active?: boolean
          loan_product_id?: string | null
          priority?: number
          savings_product_id?: string | null
          source_channel?: string | null
          updated_at?: string
          updated_by?: string | null
          withdrawal_type_id?: string | null
        }
        Update: {
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          credit_account_id?: string | null
          debit_account_id?: string | null
          description?: string | null
          event_code?: string
          id?: string
          is_active?: boolean
          loan_product_id?: string | null
          priority?: number
          savings_product_id?: string | null
          source_channel?: string | null
          updated_at?: string
          updated_by?: string | null
          withdrawal_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_mappings_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_mappings_credit_account_id_fkey"
            columns: ["credit_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_mappings_debit_account_id_fkey"
            columns: ["debit_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_mappings_loan_product_id_fkey"
            columns: ["loan_product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_mappings_savings_product_id_fkey"
            columns: ["savings_product_id"]
            isOneToOne: false
            referencedRelation: "savings_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_mappings_withdrawal_type_id_fkey"
            columns: ["withdrawal_type_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_types"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          name: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["period_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          name: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["period_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          name?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["period_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      accruals: {
        Row: {
          accrual_date: string
          accrual_type: string
          amount: number
          cooperative_id: string
          created_at: string
          created_by: string | null
          description: string
          expense_account_id: string | null
          id: string
          journal_id: string | null
          liability_account_id: string | null
          settlement_journal_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accrual_date: string
          accrual_type: string
          amount: number
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_account_id?: string | null
          id?: string
          journal_id?: string | null
          liability_account_id?: string | null
          settlement_journal_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accrual_date?: string
          accrual_type?: string
          amount?: number
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_account_id?: string | null
          id?: string
          journal_id?: string | null
          liability_account_id?: string | null
          settlement_journal_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accruals_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accruals_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accruals_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accruals_liability_account_id_fkey"
            columns: ["liability_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accruals_settlement_journal_id_fkey"
            columns: ["settlement_journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_actions: {
        Row: {
          acted_by: string
          action: Database["public"]["Enums"]["approval_action_type"]
          comment: string | null
          created_at: string
          id: string
          request_id: string
          step_order: number | null
        }
        Insert: {
          acted_by: string
          action: Database["public"]["Enums"]["approval_action_type"]
          comment?: string | null
          created_at?: string
          id?: string
          request_id: string
          step_order?: number | null
        }
        Update: {
          acted_by?: string
          action?: Database["public"]["Enums"]["approval_action_type"]
          comment?: string | null
          created_at?: string
          id?: string
          request_id?: string
          step_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_actions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          amount: number | null
          cooperative_id: string
          created_at: string
          current_step: number
          entity_id: string
          entity_type: string
          id: string
          requested_by: string
          status: Database["public"]["Enums"]["transaction_status"]
          updated_at: string
          updated_by: string | null
          workflow_id: string | null
        }
        Insert: {
          amount?: number | null
          cooperative_id: string
          created_at?: string
          current_step?: number
          entity_id: string
          entity_type: string
          id?: string
          requested_by: string
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
          updated_by?: string | null
          workflow_id?: string | null
        }
        Update: {
          amount?: number | null
          cooperative_id?: string
          created_at?: string
          current_step?: number
          entity_id?: string
          entity_type?: string
          id?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
          updated_by?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_steps: {
        Row: {
          created_at: string
          id: string
          required_role: Database["public"]["Enums"]["app_role"]
          step_order: number
          step_type: Database["public"]["Enums"]["approval_action_type"]
          workflow_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          required_role: Database["public"]["Enums"]["app_role"]
          step_order: number
          step_type: Database["public"]["Enums"]["approval_action_type"]
          workflow_id: string
        }
        Update: {
          created_at?: string
          id?: string
          required_role?: Database["public"]["Enums"]["app_role"]
          step_order?: number
          step_type?: Database["public"]["Enums"]["approval_action_type"]
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflows: {
        Row: {
          active: boolean
          cooperative_id: string
          created_at: string
          created_by: string | null
          entity_type: string
          id: string
          max_amount: number | null
          min_amount: number | null
          module: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          entity_type: string
          id?: string
          max_amount?: number | null
          min_amount?: number | null
          module: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          entity_type?: string
          id?: string
          max_amount?: number | null
          min_amount?: number | null
          module?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflows_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          cooperative_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          module: string | null
          new_values: Json | null
          old_values: Json | null
          reason: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          cooperative_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          cooperative_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          code: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          name: string
          phone: string | null
          state: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          code?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          name: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          code?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      category_contribution_defaults: {
        Row: {
          category_id: string
          cooperative_id: string
          created_at: string
          created_by: string | null
          due_day: number | null
          effective_from: string
          effective_to: string | null
          expected_amount: number
          frequency: Database["public"]["Enums"]["contribution_frequency"]
          id: string
          savings_product_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_id: string
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          due_day?: number | null
          effective_from?: string
          effective_to?: string | null
          expected_amount: number
          frequency?: Database["public"]["Enums"]["contribution_frequency"]
          id?: string
          savings_product_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_id?: string
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          due_day?: number | null
          effective_from?: string
          effective_to?: string | null
          expected_amount?: number
          frequency?: Database["public"]["Enums"]["contribution_frequency"]
          id?: string
          savings_product_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_contribution_defaults_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "membership_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_contribution_defaults_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_contribution_defaults_savings_product_id_fkey"
            columns: ["savings_product_id"]
            isOneToOne: false
            referencedRelation: "savings_products"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_subtype: string | null
          account_type: Database["public"]["Enums"]["account_type"]
          allow_manual_posting: boolean
          code: string
          cooperative_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          normal_balance: Database["public"]["Enums"]["normal_balance"]
          parent_id: string | null
          requires_bank_account: boolean
          requires_cost_centre: boolean
          requires_department: boolean
          requires_loan: boolean
          requires_member: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_subtype?: string | null
          account_type: Database["public"]["Enums"]["account_type"]
          allow_manual_posting?: boolean
          code: string
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          normal_balance: Database["public"]["Enums"]["normal_balance"]
          parent_id?: string | null
          requires_bank_account?: boolean
          requires_cost_centre?: boolean
          requires_department?: boolean
          requires_loan?: boolean
          requires_member?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_subtype?: string | null
          account_type?: Database["public"]["Enums"]["account_type"]
          allow_manual_posting?: boolean
          code?: string
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          normal_balance?: Database["public"]["Enums"]["normal_balance"]
          parent_id?: string | null
          requires_bank_account?: boolean
          requires_cost_centre?: boolean
          requires_department?: boolean
          requires_loan?: boolean
          requires_member?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      checkoff_batch_lines: {
        Row: {
          allocation_id: string | null
          allocation_status: string
          batch_id: string
          compliance_status:
            | Database["public"]["Enums"]["contribution_compliance_status"]
            | null
          cooperative_id: string
          created_at: string
          deduction_amount: number
          deduction_type: Database["public"]["Enums"]["checkoff_deduction_type"]
          department: string | null
          employee_id: string | null
          employee_name: string | null
          exception_status: string
          expected_amount: number | null
          id: string
          line_number: number
          manual_match_reason: string | null
          match_basis: string | null
          match_confidence: number
          match_status: Database["public"]["Enums"]["checkoff_match_status"]
          matched_at: string | null
          matched_by: string | null
          matched_member_id: string | null
          matched_savings_account_id: string | null
          member_number: string | null
          payroll_date: string | null
          posting_status: Database["public"]["Enums"]["checkoff_line_posting_status"]
          savings_product_id: string | null
          savings_transaction_id: string | null
          source_reference: string | null
          staff_number: string | null
          updated_at: string
          variance_amount: number | null
        }
        Insert: {
          allocation_id?: string | null
          allocation_status?: string
          batch_id: string
          compliance_status?:
            | Database["public"]["Enums"]["contribution_compliance_status"]
            | null
          cooperative_id: string
          created_at?: string
          deduction_amount?: number
          deduction_type?: Database["public"]["Enums"]["checkoff_deduction_type"]
          department?: string | null
          employee_id?: string | null
          employee_name?: string | null
          exception_status?: string
          expected_amount?: number | null
          id?: string
          line_number: number
          manual_match_reason?: string | null
          match_basis?: string | null
          match_confidence?: number
          match_status?: Database["public"]["Enums"]["checkoff_match_status"]
          matched_at?: string | null
          matched_by?: string | null
          matched_member_id?: string | null
          matched_savings_account_id?: string | null
          member_number?: string | null
          payroll_date?: string | null
          posting_status?: Database["public"]["Enums"]["checkoff_line_posting_status"]
          savings_product_id?: string | null
          savings_transaction_id?: string | null
          source_reference?: string | null
          staff_number?: string | null
          updated_at?: string
          variance_amount?: number | null
        }
        Update: {
          allocation_id?: string | null
          allocation_status?: string
          batch_id?: string
          compliance_status?:
            | Database["public"]["Enums"]["contribution_compliance_status"]
            | null
          cooperative_id?: string
          created_at?: string
          deduction_amount?: number
          deduction_type?: Database["public"]["Enums"]["checkoff_deduction_type"]
          department?: string | null
          employee_id?: string | null
          employee_name?: string | null
          exception_status?: string
          expected_amount?: number | null
          id?: string
          line_number?: number
          manual_match_reason?: string | null
          match_basis?: string | null
          match_confidence?: number
          match_status?: Database["public"]["Enums"]["checkoff_match_status"]
          matched_at?: string | null
          matched_by?: string | null
          matched_member_id?: string | null
          matched_savings_account_id?: string | null
          member_number?: string | null
          payroll_date?: string | null
          posting_status?: Database["public"]["Enums"]["checkoff_line_posting_status"]
          savings_product_id?: string | null
          savings_transaction_id?: string | null
          source_reference?: string | null
          staff_number?: string | null
          updated_at?: string
          variance_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checkoff_batch_lines_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "contribution_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_batch_lines_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "checkoff_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_batch_lines_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_batch_lines_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_batch_lines_matched_savings_account_id_fkey"
            columns: ["matched_savings_account_id"]
            isOneToOne: false
            referencedRelation: "member_savings_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_batch_lines_savings_product_id_fkey"
            columns: ["savings_product_id"]
            isOneToOne: false
            referencedRelation: "savings_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_batch_lines_savings_transaction_id_fkey"
            columns: ["savings_transaction_id"]
            isOneToOne: false
            referencedRelation: "savings_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      checkoff_batches: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          batch_number: string
          checked_by: string | null
          checkoff_profile_id: string | null
          cooperative_id: string
          corrects_batch_id: string | null
          created_at: string
          created_by: string | null
          deduction_date: string
          file_fingerprint: string | null
          file_name: string | null
          id: string
          notes: string | null
          payroll_end_date: string | null
          payroll_period: string
          payroll_start_date: string | null
          period_id: string | null
          posted_at: string | null
          posted_by: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          reviewed_by: string | null
          source_type: Database["public"]["Enums"]["checkoff_source_type"]
          status: Database["public"]["Enums"]["checkoff_batch_status"]
          total_exception_amount: number
          total_gross_amount: number
          total_matched_amount: number
          total_posted_amount: number
          total_records: number
          total_unmatched_amount: number
          total_valid_amount: number
          unapplied_amount: number
          updated_at: string
          updated_by: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          batch_number: string
          checked_by?: string | null
          checkoff_profile_id?: string | null
          cooperative_id: string
          corrects_batch_id?: string | null
          created_at?: string
          created_by?: string | null
          deduction_date?: string
          file_fingerprint?: string | null
          file_name?: string | null
          id?: string
          notes?: string | null
          payroll_end_date?: string | null
          payroll_period: string
          payroll_start_date?: string | null
          period_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          reviewed_by?: string | null
          source_type?: Database["public"]["Enums"]["checkoff_source_type"]
          status?: Database["public"]["Enums"]["checkoff_batch_status"]
          total_exception_amount?: number
          total_gross_amount?: number
          total_matched_amount?: number
          total_posted_amount?: number
          total_records?: number
          total_unmatched_amount?: number
          total_valid_amount?: number
          unapplied_amount?: number
          updated_at?: string
          updated_by?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          batch_number?: string
          checked_by?: string | null
          checkoff_profile_id?: string | null
          cooperative_id?: string
          corrects_batch_id?: string | null
          created_at?: string
          created_by?: string | null
          deduction_date?: string
          file_fingerprint?: string | null
          file_name?: string | null
          id?: string
          notes?: string | null
          payroll_end_date?: string | null
          payroll_period?: string
          payroll_start_date?: string | null
          period_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          reviewed_by?: string | null
          source_type?: Database["public"]["Enums"]["checkoff_source_type"]
          status?: Database["public"]["Enums"]["checkoff_batch_status"]
          total_exception_amount?: number
          total_gross_amount?: number
          total_matched_amount?: number
          total_posted_amount?: number
          total_records?: number
          total_unmatched_amount?: number
          total_valid_amount?: number
          unapplied_amount?: number
          updated_at?: string
          updated_by?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkoff_batches_checkoff_profile_id_fkey"
            columns: ["checkoff_profile_id"]
            isOneToOne: false
            referencedRelation: "checkoff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_batches_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_batches_corrects_batch_id_fkey"
            columns: ["corrects_batch_id"]
            isOneToOne: false
            referencedRelation: "checkoff_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_batches_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "contribution_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      checkoff_column_mappings: {
        Row: {
          checkoff_profile_id: string
          cooperative_id: string
          created_at: string
          created_by: string | null
          id: string
          source_column: string
          target_field: string
          transform: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          checkoff_profile_id: string
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          source_column: string
          target_field: string
          transform?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          checkoff_profile_id?: string
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          source_column?: string
          target_field?: string
          transform?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkoff_column_mappings_checkoff_profile_id_fkey"
            columns: ["checkoff_profile_id"]
            isOneToOne: false
            referencedRelation: "checkoff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_column_mappings_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      checkoff_corrections: {
        Row: {
          cooperative_id: string
          correction_batch_id: string | null
          created_at: string
          created_by: string | null
          difference_amount: number
          id: string
          original_batch_id: string
          reason: string
        }
        Insert: {
          cooperative_id: string
          correction_batch_id?: string | null
          created_at?: string
          created_by?: string | null
          difference_amount?: number
          id?: string
          original_batch_id: string
          reason: string
        }
        Update: {
          cooperative_id?: string
          correction_batch_id?: string | null
          created_at?: string
          created_by?: string | null
          difference_amount?: number
          id?: string
          original_batch_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkoff_corrections_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_corrections_correction_batch_id_fkey"
            columns: ["correction_batch_id"]
            isOneToOne: false
            referencedRelation: "checkoff_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_corrections_original_batch_id_fkey"
            columns: ["original_batch_id"]
            isOneToOne: false
            referencedRelation: "checkoff_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      checkoff_exceptions: {
        Row: {
          batch_id: string
          batch_line_id: string | null
          cooperative_id: string
          created_at: string
          exception_type: string
          id: string
          message: string
          resolution: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["checkoff_exception_severity"]
          suggested_action: string | null
          updated_at: string
        }
        Insert: {
          batch_id: string
          batch_line_id?: string | null
          cooperative_id: string
          created_at?: string
          exception_type: string
          id?: string
          message: string
          resolution?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["checkoff_exception_severity"]
          suggested_action?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string
          batch_line_id?: string | null
          cooperative_id?: string
          created_at?: string
          exception_type?: string
          id?: string
          message?: string
          resolution?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["checkoff_exception_severity"]
          suggested_action?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkoff_exceptions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "checkoff_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_exceptions_batch_line_id_fkey"
            columns: ["batch_line_id"]
            isOneToOne: false
            referencedRelation: "checkoff_batch_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_exceptions_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      checkoff_profiles: {
        Row: {
          active: boolean
          auto_match_threshold: number
          contribution_rule_id: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          default_savings_product_id: string | null
          effective_from: string
          effective_to: string | null
          employer_code: string | null
          employer_name: string
          expected_columns: Json
          file_format: string
          file_type: string | null
          id: string
          member_matching_method: string
          payroll_frequency: Database["public"]["Enums"]["contribution_frequency"]
          payroll_provider: string | null
          profile_name: string
          review_threshold: number
          updated_at: string
          updated_by: string | null
          variance_tolerance: number
        }
        Insert: {
          active?: boolean
          auto_match_threshold?: number
          contribution_rule_id?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          default_savings_product_id?: string | null
          effective_from?: string
          effective_to?: string | null
          employer_code?: string | null
          employer_name: string
          expected_columns?: Json
          file_format?: string
          file_type?: string | null
          id?: string
          member_matching_method?: string
          payroll_frequency?: Database["public"]["Enums"]["contribution_frequency"]
          payroll_provider?: string | null
          profile_name: string
          review_threshold?: number
          updated_at?: string
          updated_by?: string | null
          variance_tolerance?: number
        }
        Update: {
          active?: boolean
          auto_match_threshold?: number
          contribution_rule_id?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          default_savings_product_id?: string | null
          effective_from?: string
          effective_to?: string | null
          employer_code?: string | null
          employer_name?: string
          expected_columns?: Json
          file_format?: string
          file_type?: string | null
          id?: string
          member_matching_method?: string
          payroll_frequency?: Database["public"]["Enums"]["contribution_frequency"]
          payroll_provider?: string | null
          profile_name?: string
          review_threshold?: number
          updated_at?: string
          updated_by?: string | null
          variance_tolerance?: number
        }
        Relationships: [
          {
            foreignKeyName: "checkoff_profiles_contribution_rule_id_fkey"
            columns: ["contribution_rule_id"]
            isOneToOne: false
            referencedRelation: "cooperative_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_profiles_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_profiles_default_savings_product_id_fkey"
            columns: ["default_savings_product_id"]
            isOneToOne: false
            referencedRelation: "savings_products"
            referencedColumns: ["id"]
          },
        ]
      }
      checkoff_reversals: {
        Row: {
          batch_id: string
          batch_line_id: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          id: string
          reason: string
          reversed_amount: number
        }
        Insert: {
          batch_id: string
          batch_line_id?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason: string
          reversed_amount?: number
        }
        Update: {
          batch_id?: string
          batch_line_id?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          reversed_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "checkoff_reversals_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "checkoff_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_reversals_batch_line_id_fkey"
            columns: ["batch_line_id"]
            isOneToOne: false
            referencedRelation: "checkoff_batch_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_reversals_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      checkoff_settlements: {
        Row: {
          actual_amount: number | null
          actual_settlement_date: string | null
          bank_account: string | null
          bank_reference: string | null
          batch_id: string
          cooperative_id: string
          created_at: string
          created_by: string | null
          expected_amount: number
          expected_settlement_date: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["checkoff_settlement_status"]
          updated_at: string
          updated_by: string | null
          variance: number | null
        }
        Insert: {
          actual_amount?: number | null
          actual_settlement_date?: string | null
          bank_account?: string | null
          bank_reference?: string | null
          batch_id: string
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          expected_amount?: number
          expected_settlement_date?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["checkoff_settlement_status"]
          updated_at?: string
          updated_by?: string | null
          variance?: number | null
        }
        Update: {
          actual_amount?: number | null
          actual_settlement_date?: string | null
          bank_account?: string | null
          bank_reference?: string | null
          batch_id?: string
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          expected_amount?: number
          expected_settlement_date?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["checkoff_settlement_status"]
          updated_at?: string
          updated_by?: string | null
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checkoff_settlements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "checkoff_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkoff_settlements_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_actions: {
        Row: {
          action_date: string
          action_type: Database["public"]["Enums"]["collection_action_type"]
          case_id: string
          cooperative_id: string
          created_at: string
          created_by: string | null
          id: string
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          officer: string | null
          outcome: string | null
        }
        Insert: {
          action_date?: string
          action_type: Database["public"]["Enums"]["collection_action_type"]
          case_id: string
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          officer?: string | null
          outcome?: string | null
        }
        Update: {
          action_date?: string
          action_type?: Database["public"]["Enums"]["collection_action_type"]
          case_id?: string
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          officer?: string | null
          outcome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_actions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "collection_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_actions_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_cases: {
        Row: {
          arrears_amount: number
          assigned_officer: string | null
          case_number: string
          closed_date: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          days_past_due: number
          delinquency_stage: string | null
          id: string
          last_action_date: string | null
          loan_id: string
          member_id: string | null
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          opened_date: string
          outstanding_amount: number
          priority: Database["public"]["Enums"]["collection_priority"]
          resolution: string | null
          status: Database["public"]["Enums"]["collection_case_status"]
          updated_at: string
        }
        Insert: {
          arrears_amount?: number
          assigned_officer?: string | null
          case_number: string
          closed_date?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          days_past_due?: number
          delinquency_stage?: string | null
          id?: string
          last_action_date?: string | null
          loan_id: string
          member_id?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          opened_date?: string
          outstanding_amount?: number
          priority?: Database["public"]["Enums"]["collection_priority"]
          resolution?: string | null
          status?: Database["public"]["Enums"]["collection_case_status"]
          updated_at?: string
        }
        Update: {
          arrears_amount?: number
          assigned_officer?: string | null
          case_number?: string
          closed_date?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          days_past_due?: number
          delinquency_stage?: string | null
          id?: string
          last_action_date?: string | null
          loan_id?: string
          member_id?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          opened_date?: string
          outstanding_amount?: number
          priority?: Database["public"]["Enums"]["collection_priority"]
          resolution?: string | null
          status?: Database["public"]["Enums"]["collection_case_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_cases_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_cases_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_cases_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_allocations: {
        Row: {
          allocation_period: string | null
          amount: number
          cooperative_id: string
          created_at: string
          created_by: string | null
          id: string
          member_id: string
          period_id: string | null
          receipt_amount: number | null
          receipt_reference: string | null
          savings_product_id: string
          savings_transaction_id: string | null
          status: string
        }
        Insert: {
          allocation_period?: string | null
          amount: number
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id: string
          period_id?: string | null
          receipt_amount?: number | null
          receipt_reference?: string | null
          savings_product_id: string
          savings_transaction_id?: string | null
          status?: string
        }
        Update: {
          allocation_period?: string | null
          amount?: number
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string
          period_id?: string | null
          receipt_amount?: number | null
          receipt_reference?: string | null
          savings_product_id?: string
          savings_transaction_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_allocations_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_allocations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_allocations_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "contribution_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_allocations_savings_product_id_fkey"
            columns: ["savings_product_id"]
            isOneToOne: false
            referencedRelation: "savings_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_allocations_savings_transaction_id_fkey"
            columns: ["savings_transaction_id"]
            isOneToOne: false
            referencedRelation: "savings_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_periods: {
        Row: {
          closed_at: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          end_date: string
          id: string
          name: string
          start_date: string
          status: Database["public"]["Enums"]["contribution_period_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          closed_at?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["contribution_period_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          closed_at?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["contribution_period_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contribution_periods_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperative_rules: {
        Row: {
          active: boolean
          approved_by: string | null
          boolean_value: boolean | null
          category: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          description: string | null
          effective_from: string
          effective_to: string | null
          id: string
          json_value: Json | null
          numeric_value: number | null
          rule_key: string
          rule_name: string
          text_value: string | null
          updated_at: string
          updated_by: string | null
          value_type: Database["public"]["Enums"]["rule_value_type"]
        }
        Insert: {
          active?: boolean
          approved_by?: string | null
          boolean_value?: boolean | null
          category?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          json_value?: Json | null
          numeric_value?: number | null
          rule_key: string
          rule_name: string
          text_value?: string | null
          updated_at?: string
          updated_by?: string | null
          value_type: Database["public"]["Enums"]["rule_value_type"]
        }
        Update: {
          active?: boolean
          approved_by?: string | null
          boolean_value?: boolean | null
          category?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          json_value?: Json | null
          numeric_value?: number | null
          rule_key?: string
          rule_name?: string
          text_value?: string | null
          updated_at?: string
          updated_by?: string | null
          value_type?: Database["public"]["Enums"]["rule_value_type"]
        }
        Relationships: [
          {
            foreignKeyName: "cooperative_rules_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperatives: {
        Row: {
          address: string | null
          agm_date: string | null
          cooperative_type: Database["public"]["Enums"]["cooperative_type"]
          created_at: string
          created_by: string | null
          currency: string
          email: string | null
          financial_year_start: string | null
          id: string
          is_demo: boolean
          legal_name: string
          lga: string | null
          logo_url: string | null
          phone: string | null
          primary_contact: string | null
          registration_number: string | null
          state: string | null
          status: Database["public"]["Enums"]["cooperative_status"]
          trading_name: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          agm_date?: string | null
          cooperative_type?: Database["public"]["Enums"]["cooperative_type"]
          created_at?: string
          created_by?: string | null
          currency?: string
          email?: string | null
          financial_year_start?: string | null
          id?: string
          is_demo?: boolean
          legal_name: string
          lga?: string | null
          logo_url?: string | null
          phone?: string | null
          primary_contact?: string | null
          registration_number?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["cooperative_status"]
          trading_name?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          agm_date?: string | null
          cooperative_type?: Database["public"]["Enums"]["cooperative_type"]
          created_at?: string
          created_by?: string | null
          currency?: string
          email?: string | null
          financial_year_start?: string | null
          id?: string
          is_demo?: boolean
          legal_name?: string
          lga?: string | null
          logo_url?: string | null
          phone?: string | null
          primary_contact?: string | null
          registration_number?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["cooperative_status"]
          trading_name?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      exit_settlements: {
        Row: {
          approved_by: string | null
          calculation_snapshot: Json | null
          checked_by: string | null
          cooperative_id: string
          created_at: string
          decision_notes: string | null
          effective_date: string | null
          exit_fee: number
          exit_reason: string | null
          exit_type: string
          gross_entitlement: number
          id: string
          member_id: string
          net_settlement: number
          notice_date: string | null
          notice_required_days: number
          notice_satisfied: boolean
          offset_applied: boolean
          other_balances: number
          other_obligations: number
          outstanding_fees: number
          outstanding_interest: number
          outstanding_loan_principal: number
          outstanding_penalties: number
          regular_savings: number
          requested_by: string | null
          settled_at: string | null
          settlement_number: string
          special_savings: number
          status: Database["public"]["Enums"]["exit_settlement_status"]
          updated_at: string
          withdrawal_request_id: string | null
        }
        Insert: {
          approved_by?: string | null
          calculation_snapshot?: Json | null
          checked_by?: string | null
          cooperative_id: string
          created_at?: string
          decision_notes?: string | null
          effective_date?: string | null
          exit_fee?: number
          exit_reason?: string | null
          exit_type?: string
          gross_entitlement?: number
          id?: string
          member_id: string
          net_settlement?: number
          notice_date?: string | null
          notice_required_days?: number
          notice_satisfied?: boolean
          offset_applied?: boolean
          other_balances?: number
          other_obligations?: number
          outstanding_fees?: number
          outstanding_interest?: number
          outstanding_loan_principal?: number
          outstanding_penalties?: number
          regular_savings?: number
          requested_by?: string | null
          settled_at?: string | null
          settlement_number: string
          special_savings?: number
          status?: Database["public"]["Enums"]["exit_settlement_status"]
          updated_at?: string
          withdrawal_request_id?: string | null
        }
        Update: {
          approved_by?: string | null
          calculation_snapshot?: Json | null
          checked_by?: string | null
          cooperative_id?: string
          created_at?: string
          decision_notes?: string | null
          effective_date?: string | null
          exit_fee?: number
          exit_reason?: string | null
          exit_type?: string
          gross_entitlement?: number
          id?: string
          member_id?: string
          net_settlement?: number
          notice_date?: string | null
          notice_required_days?: number
          notice_satisfied?: boolean
          offset_applied?: boolean
          other_balances?: number
          other_obligations?: number
          outstanding_fees?: number
          outstanding_interest?: number
          outstanding_loan_principal?: number
          outstanding_penalties?: number
          regular_savings?: number
          requested_by?: string | null
          settled_at?: string | null
          settlement_number?: string
          special_savings?: number
          status?: Database["public"]["Enums"]["exit_settlement_status"]
          updated_at?: string
          withdrawal_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exit_settlements_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exit_settlements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exit_settlements_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_assets: {
        Row: {
          accumulated_depreciation: number
          accumulated_depreciation_account_id: string | null
          acquisition_date: string
          asset_account_id: string | null
          asset_name: string
          asset_number: string
          category: string | null
          cooperative_id: string
          cost: number
          created_at: string
          created_by: string | null
          depreciation_expense_account_id: string | null
          depreciation_method: string
          disposal_date: string | null
          id: string
          residual_value: number
          status: string
          updated_at: string
          useful_life_months: number
        }
        Insert: {
          accumulated_depreciation?: number
          accumulated_depreciation_account_id?: string | null
          acquisition_date: string
          asset_account_id?: string | null
          asset_name: string
          asset_number: string
          category?: string | null
          cooperative_id: string
          cost: number
          created_at?: string
          created_by?: string | null
          depreciation_expense_account_id?: string | null
          depreciation_method?: string
          disposal_date?: string | null
          id?: string
          residual_value?: number
          status?: string
          updated_at?: string
          useful_life_months: number
        }
        Update: {
          accumulated_depreciation?: number
          accumulated_depreciation_account_id?: string | null
          acquisition_date?: string
          asset_account_id?: string | null
          asset_name?: string
          asset_number?: string
          category?: string | null
          cooperative_id?: string
          cost?: number
          created_at?: string
          created_by?: string | null
          depreciation_expense_account_id?: string | null
          depreciation_method?: string
          disposal_date?: string | null
          id?: string
          residual_value?: number
          status?: string
          updated_at?: string
          useful_life_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_accumulated_depreciation_account_id_fkey"
            columns: ["accumulated_depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_depreciation_expense_account_id_fkey"
            columns: ["depreciation_expense_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          checked_at: string | null
          checked_by: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          is_demo: boolean
          journal_number: string | null
          journal_type: string
          period_id: string | null
          posted_at: string | null
          posted_by: string | null
          posting_date: string
          reference: string | null
          reversal_of_id: string | null
          reversal_reason: string | null
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["journal_status"]
          total_credit: number
          total_debit: number
          transaction_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          checked_at?: string | null
          checked_by?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          journal_number?: string | null
          journal_type?: string
          period_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          posting_date?: string
          reference?: string | null
          reversal_of_id?: string | null
          reversal_reason?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["journal_status"]
          total_credit?: number
          total_debit?: number
          transaction_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          checked_at?: string | null
          checked_by?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          journal_number?: string | null
          journal_type?: string
          period_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          posting_date?: string
          reference?: string | null
          reversal_of_id?: string | null
          reversal_reason?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["journal_status"]
          total_credit?: number
          total_debit?: number
          transaction_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          bank_account_id: string | null
          cost_centre_id: string | null
          created_at: string
          credit: number
          debit: number
          department_id: string | null
          description: string | null
          id: string
          journal_id: string
          line_sequence: number
          loan_id: string | null
          member_id: string | null
          project_id: string | null
          reference: string | null
        }
        Insert: {
          account_id: string
          bank_account_id?: string | null
          cost_centre_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          department_id?: string | null
          description?: string | null
          id?: string
          journal_id: string
          line_sequence?: number
          loan_id?: string | null
          member_id?: string | null
          project_id?: string | null
          reference?: string | null
        }
        Update: {
          account_id?: string
          bank_account_id?: string | null
          cost_centre_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          department_id?: string | null
          description?: string | null
          id?: string
          journal_id?: string
          line_sequence?: number
          loan_id?: string | null
          member_id?: string | null
          project_id?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_templates: {
        Row: {
          auto_post: boolean
          cooperative_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          journal_type: string
          lines: Json
          name: string
          updated_at: string
        }
        Insert: {
          auto_post?: boolean
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          journal_type?: string
          lines?: Json
          name: string
          updated_at?: string
        }
        Update: {
          auto_post?: boolean
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          journal_type?: string
          lines?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_templates_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_application_status_history: {
        Row: {
          changed_by: string | null
          cooperative_id: string
          created_at: string
          from_status:
            | Database["public"]["Enums"]["loan_application_status"]
            | null
          id: string
          loan_application_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["loan_application_status"]
        }
        Insert: {
          changed_by?: string | null
          cooperative_id: string
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["loan_application_status"]
            | null
          id?: string
          loan_application_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["loan_application_status"]
        }
        Update: {
          changed_by?: string | null
          cooperative_id?: string
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["loan_application_status"]
            | null
          id?: string
          loan_application_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["loan_application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "loan_application_status_history_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_application_status_history_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_applications: {
        Row: {
          application_date: string
          application_number: string
          application_status: Database["public"]["Enums"]["loan_application_status"]
          approval_status: string
          approved_amount: number | null
          approved_at: string | null
          approved_by: string | null
          approved_tenure: number | null
          calculated_affordable_amount: number | null
          calculated_credit_limit: number | null
          calculated_maximum_amount: number | null
          checked_at: string | null
          checked_by: string | null
          committee_override_amount: number | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          credit_status: string
          disbursement_status: string
          eligibility_status: Database["public"]["Enums"]["loan_eligibility_status"]
          id: string
          loan_product_id: string
          member_id: string
          notes: string | null
          override_reason: string | null
          purpose: string | null
          purpose_description: string | null
          recommended_amount: number | null
          rejected_at: string | null
          rejection_reason: string | null
          repayment_frequency: Database["public"]["Enums"]["contribution_frequency"]
          requested_amount: number
          requested_disbursement_account_id: string | null
          requested_tenure: number
          submitted_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          application_date?: string
          application_number: string
          application_status?: Database["public"]["Enums"]["loan_application_status"]
          approval_status?: string
          approved_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          approved_tenure?: number | null
          calculated_affordable_amount?: number | null
          calculated_credit_limit?: number | null
          calculated_maximum_amount?: number | null
          checked_at?: string | null
          checked_by?: string | null
          committee_override_amount?: number | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          credit_status?: string
          disbursement_status?: string
          eligibility_status?: Database["public"]["Enums"]["loan_eligibility_status"]
          id?: string
          loan_product_id: string
          member_id: string
          notes?: string | null
          override_reason?: string | null
          purpose?: string | null
          purpose_description?: string | null
          recommended_amount?: number | null
          rejected_at?: string | null
          rejection_reason?: string | null
          repayment_frequency?: Database["public"]["Enums"]["contribution_frequency"]
          requested_amount: number
          requested_disbursement_account_id?: string | null
          requested_tenure: number
          submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          application_date?: string
          application_number?: string
          application_status?: Database["public"]["Enums"]["loan_application_status"]
          approval_status?: string
          approved_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          approved_tenure?: number | null
          calculated_affordable_amount?: number | null
          calculated_credit_limit?: number | null
          calculated_maximum_amount?: number | null
          checked_at?: string | null
          checked_by?: string | null
          committee_override_amount?: number | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          credit_status?: string
          disbursement_status?: string
          eligibility_status?: Database["public"]["Enums"]["loan_eligibility_status"]
          id?: string
          loan_product_id?: string
          member_id?: string
          notes?: string | null
          override_reason?: string | null
          purpose?: string | null
          purpose_description?: string | null
          recommended_amount?: number | null
          rejected_at?: string | null
          rejection_reason?: string | null
          repayment_frequency?: Database["public"]["Enums"]["contribution_frequency"]
          requested_amount?: number
          requested_disbursement_account_id?: string | null
          requested_tenure?: number
          submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_applications_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_loan_product_id_fkey"
            columns: ["loan_product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_requested_disbursement_account_id_fkey"
            columns: ["requested_disbursement_account_id"]
            isOneToOne: false
            referencedRelation: "member_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_approval_limits: {
        Row: {
          active: boolean
          cooperative_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          maximum_amount: number | null
          minimum_amount: number
          required_role: Database["public"]["Enums"]["app_role"] | null
          requires_committee: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          maximum_amount?: number | null
          minimum_amount?: number
          required_role?: Database["public"]["Enums"]["app_role"] | null
          requires_committee?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          maximum_amount?: number | null
          minimum_amount?: number
          required_role?: Database["public"]["Enums"]["app_role"] | null
          requires_committee?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_approval_limits_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_credit_assessments: {
        Row: {
          affordable_amount: number | null
          analyst_comments: string | null
          analyst_recommendation: string | null
          assessed_at: string | null
          assessed_by: string | null
          assessment_status: Database["public"]["Enums"]["loan_assessment_status"]
          contribution_score: number | null
          cooperative_id: string
          created_at: string
          credit_limit: number | null
          debt_service_ratio: number | null
          eligibility_score: number | null
          id: string
          loan_application_id: string
          proposed_amount: number | null
          recommended_amount: number | null
          risk_rating: Database["public"]["Enums"]["loan_risk_rating"] | null
          savings_position: number | null
          updated_at: string
        }
        Insert: {
          affordable_amount?: number | null
          analyst_comments?: string | null
          analyst_recommendation?: string | null
          assessed_at?: string | null
          assessed_by?: string | null
          assessment_status?: Database["public"]["Enums"]["loan_assessment_status"]
          contribution_score?: number | null
          cooperative_id: string
          created_at?: string
          credit_limit?: number | null
          debt_service_ratio?: number | null
          eligibility_score?: number | null
          id?: string
          loan_application_id: string
          proposed_amount?: number | null
          recommended_amount?: number | null
          risk_rating?: Database["public"]["Enums"]["loan_risk_rating"] | null
          savings_position?: number | null
          updated_at?: string
        }
        Update: {
          affordable_amount?: number | null
          analyst_comments?: string | null
          analyst_recommendation?: string | null
          assessed_at?: string | null
          assessed_by?: string | null
          assessment_status?: Database["public"]["Enums"]["loan_assessment_status"]
          contribution_score?: number | null
          cooperative_id?: string
          created_at?: string
          credit_limit?: number | null
          debt_service_ratio?: number | null
          eligibility_score?: number | null
          id?: string
          loan_application_id?: string
          proposed_amount?: number | null
          recommended_amount?: number | null
          risk_rating?: Database["public"]["Enums"]["loan_risk_rating"] | null
          savings_position?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_credit_assessments_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_credit_assessments_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_delinquency_snapshots: {
        Row: {
          cooperative_id: string
          created_at: string
          days_past_due: number
          delinquency_status: string | null
          earliest_overdue_date: string | null
          fee_arrears: number
          id: string
          interest_arrears: number
          last_payment_date: string | null
          loan_id: string
          maximum_days_past_due: number
          member_id: string | null
          npl: boolean
          outstanding_fees: number
          outstanding_interest: number
          outstanding_penalties: number
          outstanding_principal: number
          par_bucket: string | null
          penalty_arrears: number
          principal_arrears: number
          rule_used: string | null
          snapshot_date: string
          total_arrears: number
        }
        Insert: {
          cooperative_id: string
          created_at?: string
          days_past_due?: number
          delinquency_status?: string | null
          earliest_overdue_date?: string | null
          fee_arrears?: number
          id?: string
          interest_arrears?: number
          last_payment_date?: string | null
          loan_id: string
          maximum_days_past_due?: number
          member_id?: string | null
          npl?: boolean
          outstanding_fees?: number
          outstanding_interest?: number
          outstanding_penalties?: number
          outstanding_principal?: number
          par_bucket?: string | null
          penalty_arrears?: number
          principal_arrears?: number
          rule_used?: string | null
          snapshot_date?: string
          total_arrears?: number
        }
        Update: {
          cooperative_id?: string
          created_at?: string
          days_past_due?: number
          delinquency_status?: string | null
          earliest_overdue_date?: string | null
          fee_arrears?: number
          id?: string
          interest_arrears?: number
          last_payment_date?: string | null
          loan_id?: string
          maximum_days_past_due?: number
          member_id?: string | null
          npl?: boolean
          outstanding_fees?: number
          outstanding_interest?: number
          outstanding_penalties?: number
          outstanding_principal?: number
          par_bucket?: string | null
          penalty_arrears?: number
          principal_arrears?: number
          rule_used?: string | null
          snapshot_date?: string
          total_arrears?: number
        }
        Relationships: [
          {
            foreignKeyName: "loan_delinquency_snapshots_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_delinquency_snapshots_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_delinquency_snapshots_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_eligibility_results: {
        Row: {
          binding_limit: number | null
          checks: Json
          contribution_months: number | null
          cooperative_id: string
          created_at: string
          debt_service_ratio: number | null
          evaluated_at: string
          evaluated_by: string | null
          existing_loan_exposure: number | null
          existing_obligations: number | null
          guarantee_exposure: number | null
          id: string
          income_based_limit: number | null
          loan_application_id: string
          membership_months: number | null
          net_salary: number | null
          net_savings: number | null
          policy_based_limit: number | null
          proposed_installment: number | null
          savings_based_limit: number | null
          status: Database["public"]["Enums"]["loan_eligibility_status"]
        }
        Insert: {
          binding_limit?: number | null
          checks?: Json
          contribution_months?: number | null
          cooperative_id: string
          created_at?: string
          debt_service_ratio?: number | null
          evaluated_at?: string
          evaluated_by?: string | null
          existing_loan_exposure?: number | null
          existing_obligations?: number | null
          guarantee_exposure?: number | null
          id?: string
          income_based_limit?: number | null
          loan_application_id: string
          membership_months?: number | null
          net_salary?: number | null
          net_savings?: number | null
          policy_based_limit?: number | null
          proposed_installment?: number | null
          savings_based_limit?: number | null
          status: Database["public"]["Enums"]["loan_eligibility_status"]
        }
        Update: {
          binding_limit?: number | null
          checks?: Json
          contribution_months?: number | null
          cooperative_id?: string
          created_at?: string
          debt_service_ratio?: number | null
          evaluated_at?: string
          evaluated_by?: string | null
          existing_loan_exposure?: number | null
          existing_obligations?: number | null
          guarantee_exposure?: number | null
          id?: string
          income_based_limit?: number | null
          loan_application_id?: string
          membership_months?: number | null
          net_salary?: number | null
          net_savings?: number | null
          policy_based_limit?: number | null
          proposed_installment?: number | null
          savings_based_limit?: number | null
          status?: Database["public"]["Enums"]["loan_eligibility_status"]
        }
        Relationships: [
          {
            foreignKeyName: "loan_eligibility_results_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_eligibility_results_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_guarantors: {
        Row: {
          acceptance_statement: string | null
          acceptance_user: string | null
          amount_guaranteed: number
          cooperative_id: string
          created_at: string
          created_by: string | null
          guarantor_member_id: string
          id: string
          loan_application_id: string
          offset_authorised: boolean
          requested_at: string
          responded_at: string | null
          response_comment: string | null
          status: Database["public"]["Enums"]["loan_guarantor_status"]
          terms_version: string | null
          updated_at: string
        }
        Insert: {
          acceptance_statement?: string | null
          acceptance_user?: string | null
          amount_guaranteed?: number
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          guarantor_member_id: string
          id?: string
          loan_application_id: string
          offset_authorised?: boolean
          requested_at?: string
          responded_at?: string | null
          response_comment?: string | null
          status?: Database["public"]["Enums"]["loan_guarantor_status"]
          terms_version?: string | null
          updated_at?: string
        }
        Update: {
          acceptance_statement?: string | null
          acceptance_user?: string | null
          amount_guaranteed?: number
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          guarantor_member_id?: string
          id?: string
          loan_application_id?: string
          offset_authorised?: boolean
          requested_at?: string
          responded_at?: string | null
          response_comment?: string | null
          status?: Database["public"]["Enums"]["loan_guarantor_status"]
          terms_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_guarantors_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_guarantors_guarantor_member_id_fkey"
            columns: ["guarantor_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_guarantors_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_penalty_waivers: {
        Row: {
          amount: number
          approved_by: string | null
          cooperative_id: string
          created_at: string
          decision_notes: string | null
          effective_date: string | null
          id: string
          loan_id: string
          member_id: string | null
          posted_transaction_id: string | null
          reason: string
          requested_by: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["loan_request_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          cooperative_id: string
          created_at?: string
          decision_notes?: string | null
          effective_date?: string | null
          id?: string
          loan_id: string
          member_id?: string | null
          posted_transaction_id?: string | null
          reason: string
          requested_by?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["loan_request_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          cooperative_id?: string
          created_at?: string
          decision_notes?: string | null
          effective_date?: string | null
          id?: string
          loan_id?: string
          member_id?: string | null
          posted_transaction_id?: string | null
          reason?: string
          requested_by?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["loan_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_penalty_waivers_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_penalty_waivers_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_penalty_waivers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_penalty_waivers_posted_transaction_id_fkey"
            columns: ["posted_transaction_id"]
            isOneToOne: false
            referencedRelation: "loan_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_products: {
        Row: {
          collateral_required: boolean
          cooperative_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          early_repayment_policy: string | null
          effective_from: string
          effective_to: string | null
          grace_period: number
          guarantor_required: boolean
          id: string
          insurance_required: boolean
          interest_method: Database["public"]["Enums"]["loan_interest_method"]
          interest_rate: number
          interest_rate_type: string
          is_sample: boolean
          loan_category: string | null
          maximum_amount: number | null
          maximum_debt_to_income_ratio: number | null
          maximum_guarantors: number
          maximum_installment_to_income_ratio: number | null
          maximum_tenure: number
          minimum_amount: number
          minimum_guarantors: number
          minimum_membership_months: number
          minimum_savings_months: number
          minimum_tenure: number
          pdc_required: boolean
          penal_interest_rate: number
          processing_fee_type: Database["public"]["Enums"]["loan_fee_type"]
          processing_fee_value: number
          product_code: string
          product_name: string
          repayment_frequency: Database["public"]["Enums"]["contribution_frequency"]
          requires_committee_approval: boolean
          requires_credit_assessment: boolean
          requires_management_approval: boolean
          savings_multiplier: number | null
          self_guarantee_allowed: boolean
          special_savings_waiting_period: number
          standing_instruction_required: boolean
          status: string
          tenure_unit: Database["public"]["Enums"]["loan_tenure_unit"]
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          collateral_required?: boolean
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          early_repayment_policy?: string | null
          effective_from?: string
          effective_to?: string | null
          grace_period?: number
          guarantor_required?: boolean
          id?: string
          insurance_required?: boolean
          interest_method?: Database["public"]["Enums"]["loan_interest_method"]
          interest_rate?: number
          interest_rate_type?: string
          is_sample?: boolean
          loan_category?: string | null
          maximum_amount?: number | null
          maximum_debt_to_income_ratio?: number | null
          maximum_guarantors?: number
          maximum_installment_to_income_ratio?: number | null
          maximum_tenure?: number
          minimum_amount?: number
          minimum_guarantors?: number
          minimum_membership_months?: number
          minimum_savings_months?: number
          minimum_tenure?: number
          pdc_required?: boolean
          penal_interest_rate?: number
          processing_fee_type?: Database["public"]["Enums"]["loan_fee_type"]
          processing_fee_value?: number
          product_code: string
          product_name: string
          repayment_frequency?: Database["public"]["Enums"]["contribution_frequency"]
          requires_committee_approval?: boolean
          requires_credit_assessment?: boolean
          requires_management_approval?: boolean
          savings_multiplier?: number | null
          self_guarantee_allowed?: boolean
          special_savings_waiting_period?: number
          standing_instruction_required?: boolean
          status?: string
          tenure_unit?: Database["public"]["Enums"]["loan_tenure_unit"]
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          collateral_required?: boolean
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          early_repayment_policy?: string | null
          effective_from?: string
          effective_to?: string | null
          grace_period?: number
          guarantor_required?: boolean
          id?: string
          insurance_required?: boolean
          interest_method?: Database["public"]["Enums"]["loan_interest_method"]
          interest_rate?: number
          interest_rate_type?: string
          is_sample?: boolean
          loan_category?: string | null
          maximum_amount?: number | null
          maximum_debt_to_income_ratio?: number | null
          maximum_guarantors?: number
          maximum_installment_to_income_ratio?: number | null
          maximum_tenure?: number
          minimum_amount?: number
          minimum_guarantors?: number
          minimum_membership_months?: number
          minimum_savings_months?: number
          minimum_tenure?: number
          pdc_required?: boolean
          penal_interest_rate?: number
          processing_fee_type?: Database["public"]["Enums"]["loan_fee_type"]
          processing_fee_value?: number
          product_code?: string
          product_name?: string
          repayment_frequency?: Database["public"]["Enums"]["contribution_frequency"]
          requires_committee_approval?: boolean
          requires_credit_assessment?: boolean
          requires_management_approval?: boolean
          savings_multiplier?: number | null
          self_guarantee_allowed?: boolean
          special_savings_waiting_period?: number
          standing_instruction_required?: boolean
          status?: string
          tenure_unit?: Database["public"]["Enums"]["loan_tenure_unit"]
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "loan_products_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_purposes: {
        Row: {
          active: boolean
          code: string
          cooperative_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_purposes_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_repayment_allocations: {
        Row: {
          allocation_date: string
          allocation_sequence: number
          allocation_type: Database["public"]["Enums"]["loan_allocation_type"]
          amount: number
          cooperative_id: string
          created_at: string
          created_by: string | null
          id: string
          loan_id: string
          notes: string | null
          repayment_id: string
          schedule_line_id: string | null
        }
        Insert: {
          allocation_date?: string
          allocation_sequence?: number
          allocation_type: Database["public"]["Enums"]["loan_allocation_type"]
          amount: number
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          loan_id: string
          notes?: string | null
          repayment_id: string
          schedule_line_id?: string | null
        }
        Update: {
          allocation_date?: string
          allocation_sequence?: number
          allocation_type?: Database["public"]["Enums"]["loan_allocation_type"]
          amount?: number
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          loan_id?: string
          notes?: string | null
          repayment_id?: string
          schedule_line_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayment_allocations_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayment_allocations_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayment_allocations_repayment_id_fkey"
            columns: ["repayment_id"]
            isOneToOne: false
            referencedRelation: "loan_repayments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayment_allocations_schedule_line_id_fkey"
            columns: ["schedule_line_id"]
            isOneToOne: false
            referencedRelation: "loan_schedule_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_repayments: {
        Row: {
          allocated_amount: number
          allocation_status: Database["public"]["Enums"]["loan_allocation_status"]
          amount: number
          approved_by: string | null
          bank_account_id: string | null
          bank_transaction_id: string | null
          checked_by: string | null
          checkoff_batch_id: string | null
          checkoff_line_id: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          currency: string
          exception_reason: string | null
          expected_amount: number | null
          external_reference: string | null
          id: string
          internal_reference: string | null
          loan_id: string | null
          member_id: string | null
          notes: string | null
          payment_method: string | null
          payment_source: Database["public"]["Enums"]["loan_repayment_source"]
          posted_by: string | null
          posting_date: string | null
          repayment_date: string
          repayment_number: string
          reversal_of: string | null
          reversal_reason: string | null
          status: Database["public"]["Enums"]["loan_repayment_status"]
          unapplied_amount: number
          updated_at: string
          updated_by: string | null
          value_date: string | null
          variance_amount: number | null
        }
        Insert: {
          allocated_amount?: number
          allocation_status?: Database["public"]["Enums"]["loan_allocation_status"]
          amount: number
          approved_by?: string | null
          bank_account_id?: string | null
          bank_transaction_id?: string | null
          checked_by?: string | null
          checkoff_batch_id?: string | null
          checkoff_line_id?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          exception_reason?: string | null
          expected_amount?: number | null
          external_reference?: string | null
          id?: string
          internal_reference?: string | null
          loan_id?: string | null
          member_id?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_source?: Database["public"]["Enums"]["loan_repayment_source"]
          posted_by?: string | null
          posting_date?: string | null
          repayment_date?: string
          repayment_number: string
          reversal_of?: string | null
          reversal_reason?: string | null
          status?: Database["public"]["Enums"]["loan_repayment_status"]
          unapplied_amount?: number
          updated_at?: string
          updated_by?: string | null
          value_date?: string | null
          variance_amount?: number | null
        }
        Update: {
          allocated_amount?: number
          allocation_status?: Database["public"]["Enums"]["loan_allocation_status"]
          amount?: number
          approved_by?: string | null
          bank_account_id?: string | null
          bank_transaction_id?: string | null
          checked_by?: string | null
          checkoff_batch_id?: string | null
          checkoff_line_id?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          exception_reason?: string | null
          expected_amount?: number | null
          external_reference?: string | null
          id?: string
          internal_reference?: string | null
          loan_id?: string | null
          member_id?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_source?: Database["public"]["Enums"]["loan_repayment_source"]
          posted_by?: string | null
          posting_date?: string | null
          repayment_date?: string
          repayment_number?: string
          reversal_of?: string | null
          reversal_reason?: string | null
          status?: Database["public"]["Enums"]["loan_repayment_status"]
          unapplied_amount?: number
          updated_at?: string
          updated_by?: string | null
          value_date?: string | null
          variance_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayments_checkoff_batch_id_fkey"
            columns: ["checkoff_batch_id"]
            isOneToOne: false
            referencedRelation: "checkoff_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_checkoff_line_id_fkey"
            columns: ["checkoff_line_id"]
            isOneToOne: false
            referencedRelation: "checkoff_batch_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "loan_repayments"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_restructures: {
        Row: {
          approved_by: string | null
          assessment: string | null
          capitalise_arrears: boolean
          checked_by: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          decision_notes: string | null
          effective_date: string | null
          id: string
          loan_id: string
          member_id: string | null
          new_frequency:
            | Database["public"]["Enums"]["contribution_frequency"]
            | null
          new_interest_rate: number | null
          new_schedule_id: string | null
          new_tenure: number | null
          new_terms: Json | null
          old_terms: Json | null
          reason: string | null
          requested_by: string | null
          restructure_type: string
          status: Database["public"]["Enums"]["loan_request_status"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          assessment?: string | null
          capitalise_arrears?: boolean
          checked_by?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          decision_notes?: string | null
          effective_date?: string | null
          id?: string
          loan_id: string
          member_id?: string | null
          new_frequency?:
            | Database["public"]["Enums"]["contribution_frequency"]
            | null
          new_interest_rate?: number | null
          new_schedule_id?: string | null
          new_tenure?: number | null
          new_terms?: Json | null
          old_terms?: Json | null
          reason?: string | null
          requested_by?: string | null
          restructure_type?: string
          status?: Database["public"]["Enums"]["loan_request_status"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          assessment?: string | null
          capitalise_arrears?: boolean
          checked_by?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          decision_notes?: string | null
          effective_date?: string | null
          id?: string
          loan_id?: string
          member_id?: string | null
          new_frequency?:
            | Database["public"]["Enums"]["contribution_frequency"]
            | null
          new_interest_rate?: number | null
          new_schedule_id?: string | null
          new_tenure?: number | null
          new_terms?: Json | null
          old_terms?: Json | null
          reason?: string | null
          requested_by?: string | null
          restructure_type?: string
          status?: Database["public"]["Enums"]["loan_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_restructures_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_restructures_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_restructures_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_restructures_new_schedule_id_fkey"
            columns: ["new_schedule_id"]
            isOneToOne: false
            referencedRelation: "loan_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_schedule_lines: {
        Row: {
          closing_principal: number
          cooperative_id: string
          created_at: string
          due_date: string
          fees: number
          id: string
          installment_number: number
          interest: number
          opening_principal: number
          paid_fees: number
          paid_interest: number
          paid_principal: number
          principal: number
          schedule_id: string
          status: string
          total_due: number
        }
        Insert: {
          closing_principal?: number
          cooperative_id: string
          created_at?: string
          due_date: string
          fees?: number
          id?: string
          installment_number: number
          interest?: number
          opening_principal?: number
          paid_fees?: number
          paid_interest?: number
          paid_principal?: number
          principal?: number
          schedule_id: string
          status?: string
          total_due?: number
        }
        Update: {
          closing_principal?: number
          cooperative_id?: string
          created_at?: string
          due_date?: string
          fees?: number
          id?: string
          installment_number?: number
          interest?: number
          opening_principal?: number
          paid_fees?: number
          paid_interest?: number
          paid_principal?: number
          principal?: number
          schedule_id?: string
          status?: string
          total_due?: number
        }
        Relationships: [
          {
            foreignKeyName: "loan_schedule_lines_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_schedule_lines_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "loan_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_schedules: {
        Row: {
          cooperative_id: string
          created_at: string
          created_by: string | null
          id: string
          installment_amount: number
          interest_method: Database["public"]["Enums"]["loan_interest_method"]
          interest_rate: number
          loan_application_id: string | null
          loan_id: string | null
          number_of_periods: number
          principal: number
          schedule_version: number
          start_date: string | null
          status: string
          total_fees: number
          total_interest: number
          total_repayment: number
          updated_at: string
        }
        Insert: {
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          installment_amount?: number
          interest_method: Database["public"]["Enums"]["loan_interest_method"]
          interest_rate?: number
          loan_application_id?: string | null
          loan_id?: string | null
          number_of_periods?: number
          principal?: number
          schedule_version?: number
          start_date?: string | null
          status?: string
          total_fees?: number
          total_interest?: number
          total_repayment?: number
          updated_at?: string
        }
        Update: {
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          installment_amount?: number
          interest_method?: Database["public"]["Enums"]["loan_interest_method"]
          interest_rate?: number
          loan_application_id?: string | null
          loan_id?: string | null
          number_of_periods?: number
          principal?: number
          schedule_version?: number
          start_date?: string | null
          status?: string
          total_fees?: number
          total_interest?: number
          total_repayment?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_schedules_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_schedules_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_schedules_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_securities: {
        Row: {
          cooperative_id: string
          created_at: string
          created_by: string | null
          description: string | null
          document_id: string | null
          eligible_value: number
          haircut_percentage: number
          id: string
          loan_application_id: string
          release_status: string
          security_type: Database["public"]["Enums"]["loan_security_type"]
          status: Database["public"]["Enums"]["loan_security_status"]
          updated_at: string
          value: number
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          eligible_value?: number
          haircut_percentage?: number
          id?: string
          loan_application_id: string
          release_status?: string
          security_type: Database["public"]["Enums"]["loan_security_type"]
          status?: Database["public"]["Enums"]["loan_security_status"]
          updated_at?: string
          value?: number
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          eligible_value?: number
          haircut_percentage?: number
          id?: string
          loan_application_id?: string
          release_status?: string
          security_type?: Database["public"]["Enums"]["loan_security_type"]
          status?: Database["public"]["Enums"]["loan_security_status"]
          updated_at?: string
          value?: number
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_securities_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_securities_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "member_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_securities_loan_application_id_fkey"
            columns: ["loan_application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_settlement_quotes: {
        Row: {
          accrued_interest: number
          applicable_charges: number
          approved_by: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          decision_notes: string | null
          expiry_date: string | null
          gross_interest_refund: number
          id: string
          loan_id: string
          member_id: string | null
          net_interest_refund: number
          outstanding_fees: number
          outstanding_penalties: number
          outstanding_principal: number
          policy_basis: string | null
          quote_number: string | null
          request_date: string
          requested_by: string | null
          settlement_amount: number
          settlement_date: string | null
          status: Database["public"]["Enums"]["loan_request_status"]
          updated_at: string
        }
        Insert: {
          accrued_interest?: number
          applicable_charges?: number
          approved_by?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          decision_notes?: string | null
          expiry_date?: string | null
          gross_interest_refund?: number
          id?: string
          loan_id: string
          member_id?: string | null
          net_interest_refund?: number
          outstanding_fees?: number
          outstanding_penalties?: number
          outstanding_principal?: number
          policy_basis?: string | null
          quote_number?: string | null
          request_date?: string
          requested_by?: string | null
          settlement_amount?: number
          settlement_date?: string | null
          status?: Database["public"]["Enums"]["loan_request_status"]
          updated_at?: string
        }
        Update: {
          accrued_interest?: number
          applicable_charges?: number
          approved_by?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          decision_notes?: string | null
          expiry_date?: string | null
          gross_interest_refund?: number
          id?: string
          loan_id?: string
          member_id?: string | null
          net_interest_refund?: number
          outstanding_fees?: number
          outstanding_penalties?: number
          outstanding_principal?: number
          policy_basis?: string | null
          quote_number?: string | null
          request_date?: string
          requested_by?: string | null
          settlement_amount?: number
          settlement_date?: string | null
          status?: Database["public"]["Enums"]["loan_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_settlement_quotes_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_settlement_quotes_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_settlement_quotes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_transactions: {
        Row: {
          amount: number
          approved_by: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          fee_component: number
          id: string
          interest_component: number
          loan_id: string
          member_id: string
          narration: string | null
          penalty_component: number
          posting_date: string
          principal_component: number
          reference: string | null
          reversal_of: string | null
          reversal_reason: string | null
          source: string
          status: Database["public"]["Enums"]["loan_transaction_status"]
          transaction_date: string
          transaction_number: string | null
          transaction_type: Database["public"]["Enums"]["loan_transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          fee_component?: number
          id?: string
          interest_component?: number
          loan_id: string
          member_id: string
          narration?: string | null
          penalty_component?: number
          posting_date?: string
          principal_component?: number
          reference?: string | null
          reversal_of?: string | null
          reversal_reason?: string | null
          source?: string
          status?: Database["public"]["Enums"]["loan_transaction_status"]
          transaction_date?: string
          transaction_number?: string | null
          transaction_type: Database["public"]["Enums"]["loan_transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          fee_component?: number
          id?: string
          interest_component?: number
          loan_id?: string
          member_id?: string
          narration?: string | null
          penalty_component?: number
          posting_date?: string
          principal_component?: number
          reference?: string | null
          reversal_of?: string | null
          reversal_reason?: string | null
          source?: string
          status?: Database["public"]["Enums"]["loan_transaction_status"]
          transaction_date?: string
          transaction_number?: string | null
          transaction_type?: Database["public"]["Enums"]["loan_transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_transactions_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_transactions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_transactions_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "loan_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_write_offs: {
        Row: {
          amount: number
          approved_by: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          decision_notes: string | null
          effective_date: string | null
          fee_component: number
          id: string
          interest_component: number
          loan_id: string
          member_id: string | null
          penalty_component: number
          posted_transaction_id: string | null
          principal_component: number
          reason: string
          recovered_amount: number
          recovery_assessment: string | null
          requested_by: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["loan_request_status"]
          supporting_document_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          decision_notes?: string | null
          effective_date?: string | null
          fee_component?: number
          id?: string
          interest_component?: number
          loan_id: string
          member_id?: string | null
          penalty_component?: number
          posted_transaction_id?: string | null
          principal_component?: number
          reason: string
          recovered_amount?: number
          recovery_assessment?: string | null
          requested_by?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["loan_request_status"]
          supporting_document_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          decision_notes?: string | null
          effective_date?: string | null
          fee_component?: number
          id?: string
          interest_component?: number
          loan_id?: string
          member_id?: string | null
          penalty_component?: number
          posted_transaction_id?: string | null
          principal_component?: number
          reason?: string
          recovered_amount?: number
          recovery_assessment?: string | null
          requested_by?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["loan_request_status"]
          supporting_document_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_write_offs_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_write_offs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_write_offs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_write_offs_posted_transaction_id_fkey"
            columns: ["posted_transaction_id"]
            isOneToOne: false
            referencedRelation: "loan_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_write_offs_supporting_document_id_fkey"
            columns: ["supporting_document_id"]
            isOneToOne: false
            referencedRelation: "member_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          accrued_interest: number
          application_id: string | null
          approved_amount: number
          cooperative_id: string
          created_at: string
          created_by: string | null
          disbursed_amount: number
          disbursed_at: string | null
          disbursed_by: string | null
          disbursement_account_id: string | null
          disbursement_reference: string | null
          disbursement_status: string
          id: string
          installment_amount: number
          interest_method: Database["public"]["Enums"]["loan_interest_method"]
          interest_rate: number
          loan_number: string
          loan_product_id: string
          maturity_date: string | null
          member_id: string
          outstanding_fees: number
          outstanding_interest: number
          outstanding_penalties: number
          outstanding_principal: number
          principal_amount: number
          repayment_frequency: Database["public"]["Enums"]["contribution_frequency"]
          schedule_version: number
          start_date: string | null
          status: Database["public"]["Enums"]["loan_account_status"]
          tenure: number
          tenure_unit: Database["public"]["Enums"]["loan_tenure_unit"]
          total_interest: number
          total_outstanding: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accrued_interest?: number
          application_id?: string | null
          approved_amount?: number
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          disbursed_amount?: number
          disbursed_at?: string | null
          disbursed_by?: string | null
          disbursement_account_id?: string | null
          disbursement_reference?: string | null
          disbursement_status?: string
          id?: string
          installment_amount?: number
          interest_method: Database["public"]["Enums"]["loan_interest_method"]
          interest_rate?: number
          loan_number: string
          loan_product_id: string
          maturity_date?: string | null
          member_id: string
          outstanding_fees?: number
          outstanding_interest?: number
          outstanding_penalties?: number
          outstanding_principal?: number
          principal_amount?: number
          repayment_frequency?: Database["public"]["Enums"]["contribution_frequency"]
          schedule_version?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["loan_account_status"]
          tenure: number
          tenure_unit?: Database["public"]["Enums"]["loan_tenure_unit"]
          total_interest?: number
          total_outstanding?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accrued_interest?: number
          application_id?: string | null
          approved_amount?: number
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          disbursed_amount?: number
          disbursed_at?: string | null
          disbursed_by?: string | null
          disbursement_account_id?: string | null
          disbursement_reference?: string | null
          disbursement_status?: string
          id?: string
          installment_amount?: number
          interest_method?: Database["public"]["Enums"]["loan_interest_method"]
          interest_rate?: number
          loan_number?: string
          loan_product_id?: string
          maturity_date?: string | null
          member_id?: string
          outstanding_fees?: number
          outstanding_interest?: number
          outstanding_penalties?: number
          outstanding_principal?: number
          principal_amount?: number
          repayment_frequency?: Database["public"]["Enums"]["contribution_frequency"]
          schedule_version?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["loan_account_status"]
          tenure?: number
          tenure_unit?: Database["public"]["Enums"]["loan_tenure_unit"]
          total_interest?: number
          total_outstanding?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_disbursement_account_id_fkey"
            columns: ["disbursement_account_id"]
            isOneToOne: false
            referencedRelation: "member_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_loan_product_id_fkey"
            columns: ["loan_product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          account_type: string | null
          active: boolean
          approved_at: string | null
          approved_by: string | null
          bank_code: string | null
          bank_name: string
          change_reason: string | null
          change_status: Database["public"]["Enums"]["bank_change_status"]
          cooperative_id: string
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          is_verified: boolean
          member_id: string
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_name: string
          account_number: string
          account_type?: string | null
          active?: boolean
          approved_at?: string | null
          approved_by?: string | null
          bank_code?: string | null
          bank_name: string
          change_reason?: string | null
          change_status?: Database["public"]["Enums"]["bank_change_status"]
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          member_id: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string
          account_type?: string | null
          active?: boolean
          approved_at?: string | null
          approved_by?: string | null
          bank_code?: string | null
          bank_name?: string
          change_reason?: string | null
          change_status?: Database["public"]["Enums"]["bank_change_status"]
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          member_id?: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_bank_accounts_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_bank_accounts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_contribution_schedules: {
        Row: {
          approved_by: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          due_day: number | null
          effective_from: string
          effective_to: string | null
          expected_amount: number
          frequency: Database["public"]["Enums"]["contribution_frequency"]
          id: string
          member_id: string
          reason_for_change: string | null
          savings_product_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_by?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          due_day?: number | null
          effective_from?: string
          effective_to?: string | null
          expected_amount: number
          frequency?: Database["public"]["Enums"]["contribution_frequency"]
          id?: string
          member_id: string
          reason_for_change?: string | null
          savings_product_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_by?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          due_day?: number | null
          effective_from?: string
          effective_to?: string | null
          expected_amount?: number
          frequency?: Database["public"]["Enums"]["contribution_frequency"]
          id?: string
          member_id?: string
          reason_for_change?: string | null
          savings_product_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_contribution_schedules_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_contribution_schedules_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_contribution_schedules_savings_product_id_fkey"
            columns: ["savings_product_id"]
            isOneToOne: false
            referencedRelation: "savings_products"
            referencedColumns: ["id"]
          },
        ]
      }
      member_documents: {
        Row: {
          cooperative_id: string
          created_at: string
          created_by: string | null
          document_type: string
          expiry_date: string | null
          file_name: string
          file_size: number | null
          id: string
          member_id: string
          mime_type: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["member_document_status"]
          storage_path: string
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          document_type: string
          expiry_date?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          member_id: string
          mime_type?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["member_document_status"]
          storage_path: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          document_type?: string
          expiry_date?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          member_id?: string
          mime_type?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["member_document_status"]
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_documents_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_employment: {
        Row: {
          basic_salary: number | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          date_employed: string | null
          department: string | null
          designation: string | null
          employee_id: string | null
          employer_name: string | null
          employer_type: string | null
          employment_status: Database["public"]["Enums"]["employment_status_type"]
          employment_type: string | null
          grade_level: string | null
          id: string
          member_id: string
          monthly_salary: number | null
          net_salary: number | null
          payroll_frequency: string | null
          payroll_provider: string | null
          retirement_date: string | null
          salary_account: string | null
          salary_bank: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          basic_salary?: number | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          date_employed?: string | null
          department?: string | null
          designation?: string | null
          employee_id?: string | null
          employer_name?: string | null
          employer_type?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status_type"]
          employment_type?: string | null
          grade_level?: string | null
          id?: string
          member_id: string
          monthly_salary?: number | null
          net_salary?: number | null
          payroll_frequency?: string | null
          payroll_provider?: string | null
          retirement_date?: string | null
          salary_account?: string | null
          salary_bank?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          basic_salary?: number | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          date_employed?: string | null
          department?: string | null
          designation?: string | null
          employee_id?: string | null
          employer_name?: string | null
          employer_type?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status_type"]
          employment_type?: string | null
          grade_level?: string | null
          id?: string
          member_id?: string
          monthly_salary?: number | null
          net_salary?: number | null
          payroll_frequency?: string | null
          payroll_provider?: string | null
          retirement_date?: string | null
          salary_account?: string | null
          salary_bank?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_employment_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_employment_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_identifiers: {
        Row: {
          cooperative_id: string
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          identifier_type: string
          identifier_value: string
          issued_date: string | null
          member_id: string
          updated_at: string
          updated_by: string | null
          verified: boolean
        }
        Insert: {
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          identifier_type: string
          identifier_value: string
          issued_date?: string | null
          member_id: string
          updated_at?: string
          updated_by?: string | null
          verified?: boolean
        }
        Update: {
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          identifier_type?: string
          identifier_value?: string
          issued_date?: string | null
          member_id?: string
          updated_at?: string
          updated_by?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "member_identifiers_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_identifiers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_next_of_kin: {
        Row: {
          address: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_primary: boolean
          member_id: string
          name: string
          percentage: number
          phone: string | null
          relationship: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          member_id: string
          name: string
          percentage?: number
          phone?: string | null
          relationship?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          member_id?: string
          name?: string
          percentage?: number
          phone?: string | null
          relationship?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_next_of_kin_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_next_of_kin_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_notes: {
        Row: {
          category: Database["public"]["Enums"]["member_note_category"]
          cooperative_id: string
          created_at: string
          created_by: string | null
          id: string
          member_id: string
          member_visible: boolean
          note: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["member_note_category"]
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id: string
          member_visible?: boolean
          note: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["member_note_category"]
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string
          member_visible?: boolean
          note?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_notes_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_notifications: {
        Row: {
          body: string | null
          cooperative_id: string
          created_at: string
          event_type: string
          id: string
          member_id: string | null
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          cooperative_id: string
          created_at?: string
          event_type: string
          id?: string
          member_id?: string | null
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          cooperative_id?: string
          created_at?: string
          event_type?: string
          id?: string
          member_id?: string | null
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_notifications_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_savings_accounts: {
        Row: {
          account_number: string
          accrued_bonus: number
          accrued_interest: number
          available_balance: number
          closed_date: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          current_balance: number
          id: string
          last_statement_date: string | null
          last_transaction_date: string | null
          locked_balance: number
          member_id: string
          opened_date: string
          opening_balance: number
          savings_product_id: string
          status: Database["public"]["Enums"]["savings_account_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_number: string
          accrued_bonus?: number
          accrued_interest?: number
          available_balance?: number
          closed_date?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          current_balance?: number
          id?: string
          last_statement_date?: string | null
          last_transaction_date?: string | null
          locked_balance?: number
          member_id: string
          opened_date?: string
          opening_balance?: number
          savings_product_id: string
          status?: Database["public"]["Enums"]["savings_account_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_number?: string
          accrued_bonus?: number
          accrued_interest?: number
          available_balance?: number
          closed_date?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          current_balance?: number
          id?: string
          last_statement_date?: string | null
          last_transaction_date?: string | null
          locked_balance?: number
          member_id?: string
          opened_date?: string
          opening_balance?: number
          savings_product_id?: string
          status?: Database["public"]["Enums"]["savings_account_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_savings_accounts_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_savings_accounts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_savings_accounts_savings_product_id_fkey"
            columns: ["savings_product_id"]
            isOneToOne: false
            referencedRelation: "savings_products"
            referencedColumns: ["id"]
          },
        ]
      }
      member_status_history: {
        Row: {
          approved_by: string | null
          changed_by: string | null
          cooperative_id: string
          created_at: string
          effective_date: string
          id: string
          member_id: string
          membership_id: string | null
          new_status: Database["public"]["Enums"]["member_lifecycle_status"]
          previous_status:
            | Database["public"]["Enums"]["member_lifecycle_status"]
            | null
          reason: string | null
        }
        Insert: {
          approved_by?: string | null
          changed_by?: string | null
          cooperative_id: string
          created_at?: string
          effective_date?: string
          id?: string
          member_id: string
          membership_id?: string | null
          new_status: Database["public"]["Enums"]["member_lifecycle_status"]
          previous_status?:
            | Database["public"]["Enums"]["member_lifecycle_status"]
            | null
          reason?: string | null
        }
        Update: {
          approved_by?: string | null
          changed_by?: string | null
          cooperative_id?: string
          created_at?: string
          effective_date?: string
          id?: string
          member_id?: string
          membership_id?: string | null
          new_status?: Database["public"]["Enums"]["member_lifecycle_status"]
          previous_status?:
            | Database["public"]["Enums"]["member_lifecycle_status"]
            | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_status_history_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_status_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_status_history_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      member_verifications: {
        Row: {
          action: Database["public"]["Enums"]["member_verification_action"]
          cooperative_id: string
          created_at: string
          fields_requiring_correction: string[] | null
          id: string
          member_id: string
          membership_id: string | null
          reason: string | null
          requested_at: string
          requested_by: string | null
          resolved: boolean
          resolved_at: string | null
          updated_at: string
        }
        Insert: {
          action: Database["public"]["Enums"]["member_verification_action"]
          cooperative_id: string
          created_at?: string
          fields_requiring_correction?: string[] | null
          id?: string
          member_id: string
          membership_id?: string | null
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          resolved?: boolean
          resolved_at?: string | null
          updated_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["member_verification_action"]
          cooperative_id?: string
          created_at?: string
          fields_requiring_correction?: string[] | null
          id?: string
          member_id?: string
          membership_id?: string | null
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          resolved?: boolean
          resolved_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_verifications_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_verifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_verifications_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          branch_id: string | null
          city: string | null
          cooperative_id: string
          country: string
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          email: string | null
          employer: string | null
          exit_date: string | null
          first_name: string
          gender: string | null
          id: string
          is_demo: boolean
          join_date: string
          last_name: string
          lifecycle_status: Database["public"]["Enums"]["member_lifecycle_status"]
          marital_status: string | null
          member_number: string | null
          membership_number: string
          middle_name: string | null
          nationality: string | null
          other_names: string | null
          phone: string | null
          preferred_name: string | null
          profile_photo_url: string | null
          residential_address: string | null
          staff_number: string | null
          state: string | null
          status: Database["public"]["Enums"]["member_status"]
          title: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          city?: string | null
          cooperative_id: string
          country?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          employer?: string | null
          exit_date?: string | null
          first_name: string
          gender?: string | null
          id?: string
          is_demo?: boolean
          join_date?: string
          last_name: string
          lifecycle_status?: Database["public"]["Enums"]["member_lifecycle_status"]
          marital_status?: string | null
          member_number?: string | null
          membership_number: string
          middle_name?: string | null
          nationality?: string | null
          other_names?: string | null
          phone?: string | null
          preferred_name?: string | null
          profile_photo_url?: string | null
          residential_address?: string | null
          staff_number?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          city?: string | null
          cooperative_id?: string
          country?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          employer?: string | null
          exit_date?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          is_demo?: boolean
          join_date?: string
          last_name?: string
          lifecycle_status?: Database["public"]["Enums"]["member_lifecycle_status"]
          marital_status?: string | null
          member_number?: string | null
          membership_number?: string
          middle_name?: string | null
          nationality?: string | null
          other_names?: string | null
          phone?: string | null
          preferred_name?: string | null
          profile_photo_url?: string | null
          residential_address?: string | null
          staff_number?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_categories: {
        Row: {
          active: boolean
          code: string
          cooperative_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          code: string
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_categories_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          application_date: string
          approval_date: string | null
          branch_id: string | null
          category_id: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          department: string | null
          effective_date: string | null
          employee_id: string | null
          exit_date: string | null
          exit_reason: string | null
          id: string
          is_demo: boolean
          member_id: string
          membership_number: string | null
          membership_type: string
          status: Database["public"]["Enums"]["member_lifecycle_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          application_date?: string
          approval_date?: string | null
          branch_id?: string | null
          category_id?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          effective_date?: string | null
          employee_id?: string | null
          exit_date?: string | null
          exit_reason?: string | null
          id?: string
          is_demo?: boolean
          member_id: string
          membership_number?: string | null
          membership_type?: string
          status?: Database["public"]["Enums"]["member_lifecycle_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          application_date?: string
          approval_date?: string | null
          branch_id?: string | null
          category_id?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          effective_date?: string | null
          employee_id?: string | null
          exit_date?: string | null
          exit_reason?: string | null
          id?: string
          is_demo?: boolean
          member_id?: string
          membership_number?: string | null
          membership_type?: string
          status?: Database["public"]["Enums"]["member_lifecycle_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "membership_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          code: string
          created_at: string
          description: string | null
          id: string
          module: string
          resource: string
        }
        Insert: {
          action: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
          resource: string
        }
        Update: {
          action?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
          resource?: string
        }
        Relationships: []
      }
      prepayment_schedule_lines: {
        Row: {
          amount: number
          cooperative_id: string
          created_at: string
          id: string
          journal_id: string | null
          prepayment_id: string
          recognised: boolean
          recognition_date: string
        }
        Insert: {
          amount: number
          cooperative_id: string
          created_at?: string
          id?: string
          journal_id?: string | null
          prepayment_id: string
          recognised?: boolean
          recognition_date: string
        }
        Update: {
          amount?: number
          cooperative_id?: string
          created_at?: string
          id?: string
          journal_id?: string | null
          prepayment_id?: string
          recognised?: boolean
          recognition_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepayment_schedule_lines_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepayment_schedule_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepayment_schedule_lines_prepayment_id_fkey"
            columns: ["prepayment_id"]
            isOneToOne: false
            referencedRelation: "prepayments"
            referencedColumns: ["id"]
          },
        ]
      }
      prepayments: {
        Row: {
          cooperative_id: string
          created_at: string
          created_by: string | null
          description: string
          expense_account_id: string | null
          id: string
          months: number
          prepayment_account_id: string | null
          recognised_amount: number
          start_date: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_account_id?: string | null
          id?: string
          months: number
          prepayment_account_id?: string | null
          recognised_amount?: number
          start_date: string
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_account_id?: string | null
          id?: string
          months?: number
          prepayment_account_id?: string | null
          recognised_amount?: number
          start_date?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepayments_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepayments_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepayments_prepayment_account_id_fkey"
            columns: ["prepayment_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_demo: boolean
          is_platform_user: boolean
          phone: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_demo?: boolean
          is_platform_user?: boolean
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_demo?: boolean
          is_platform_user?: boolean
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      promise_to_pay: {
        Row: {
          amount: number
          case_id: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          fulfilled_amount: number
          id: string
          loan_id: string
          member_id: string | null
          notes: string | null
          promised_date: string
          status: Database["public"]["Enums"]["promise_status"]
          updated_at: string
          variance_amount: number
        }
        Insert: {
          amount: number
          case_id?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          fulfilled_amount?: number
          id?: string
          loan_id: string
          member_id?: string | null
          notes?: string | null
          promised_date: string
          status?: Database["public"]["Enums"]["promise_status"]
          updated_at?: string
          variance_amount?: number
        }
        Update: {
          amount?: number
          case_id?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          fulfilled_amount?: number
          id?: string
          loan_id?: string
          member_id?: string | null
          notes?: string | null
          promised_date?: string
          status?: Database["public"]["Enums"]["promise_status"]
          updated_at?: string
          variance_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "promise_to_pay_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "collection_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promise_to_pay_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promise_to_pay_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promise_to_pay_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_journals: {
        Row: {
          amount: number | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          frequency: string
          id: string
          interval_days: number | null
          is_active: boolean
          last_run_date: string | null
          name: string
          next_run_date: string
          requires_approval: boolean
          template_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          interval_days?: number | null
          is_active?: boolean
          last_run_date?: string | null
          name: string
          next_run_date: string
          requires_approval?: boolean
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          interval_days?: number | null
          is_active?: boolean
          last_run_date?: string | null
          name?: string
          next_run_date?: string
          requires_approval?: boolean
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_journals_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_journals_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "journal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          cooperative_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_platform_role: boolean
          is_system: boolean
          key: Database["public"]["Enums"]["app_role"]
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cooperative_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_platform_role?: boolean
          is_system?: boolean
          key: Database["public"]["Enums"]["app_role"]
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cooperative_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_platform_role?: boolean
          is_system?: boolean
          key?: Database["public"]["Enums"]["app_role"]
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_bonus_lines: {
        Row: {
          basis_amount: number
          bonus_amount: number
          cooperative_id: string
          created_at: string
          id: string
          member_id: string
          run_id: string
          savings_account_id: string
          savings_product_id: string
          transaction_id: string | null
        }
        Insert: {
          basis_amount?: number
          bonus_amount?: number
          cooperative_id: string
          created_at?: string
          id?: string
          member_id: string
          run_id: string
          savings_account_id: string
          savings_product_id: string
          transaction_id?: string | null
        }
        Update: {
          basis_amount?: number
          bonus_amount?: number
          cooperative_id?: string
          created_at?: string
          id?: string
          member_id?: string
          run_id?: string
          savings_account_id?: string
          savings_product_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_bonus_lines_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_bonus_lines_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_bonus_lines_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "savings_bonus_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_bonus_lines_savings_account_id_fkey"
            columns: ["savings_account_id"]
            isOneToOne: false
            referencedRelation: "member_savings_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_bonus_lines_savings_product_id_fkey"
            columns: ["savings_product_id"]
            isOneToOne: false
            referencedRelation: "savings_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_bonus_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "savings_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_bonus_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          basis: string
          cooperative_id: string
          created_at: string
          created_by: string | null
          id: string
          member_count: number
          name: string
          period_end: string
          period_start: string
          posted_at: string | null
          posted_by: string | null
          rate_percent: number
          savings_product_id: string | null
          status: string
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          basis?: string
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_count?: number
          name: string
          period_end: string
          period_start: string
          posted_at?: string | null
          posted_by?: string | null
          rate_percent?: number
          savings_product_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          basis?: string
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_count?: number
          name?: string
          period_end?: string
          period_start?: string
          posted_at?: string | null
          posted_by?: string | null
          rate_percent?: number
          savings_product_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_bonus_runs_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_bonus_runs_savings_product_id_fkey"
            columns: ["savings_product_id"]
            isOneToOne: false
            referencedRelation: "savings_products"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_migration_batches: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          batch_reference: string
          cooperative_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          posted_at: string | null
          posted_by: string | null
          row_count: number
          source: string | null
          status: Database["public"]["Enums"]["savings_batch_status"]
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          batch_reference: string
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          posted_at?: string | null
          posted_by?: string | null
          row_count?: number
          source?: string | null
          status?: Database["public"]["Enums"]["savings_batch_status"]
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          batch_reference?: string
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          posted_at?: string | null
          posted_by?: string | null
          row_count?: number
          source?: string | null
          status?: Database["public"]["Enums"]["savings_batch_status"]
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_migration_batches_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_products: {
        Row: {
          account_number_format: string
          bonus_eligible: boolean
          collateral_eligible: boolean
          contribution_frequency: Database["public"]["Enums"]["contribution_frequency"]
          cooperative_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          effective_from: string
          effective_to: string | null
          eligibility_wait_days: number
          id: string
          interest_enabled: boolean
          interest_method: string | null
          interest_rate: number | null
          is_sample: boolean
          loan_eligibility_enabled: boolean
          maximum_contribution: number | null
          minimum_contribution: number | null
          minimum_opening_balance: number
          product_code: string
          product_name: string
          product_type: Database["public"]["Enums"]["savings_product_type"]
          status: string
          updated_at: string
          updated_by: string | null
          withdrawal_allowed: boolean
          withdrawal_frequency_limit: number | null
          withdrawal_notice_days: number | null
          withdrawal_percentage_limit: number | null
        }
        Insert: {
          account_number_format?: string
          bonus_eligible?: boolean
          collateral_eligible?: boolean
          contribution_frequency?: Database["public"]["Enums"]["contribution_frequency"]
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          eligibility_wait_days?: number
          id?: string
          interest_enabled?: boolean
          interest_method?: string | null
          interest_rate?: number | null
          is_sample?: boolean
          loan_eligibility_enabled?: boolean
          maximum_contribution?: number | null
          minimum_contribution?: number | null
          minimum_opening_balance?: number
          product_code: string
          product_name: string
          product_type?: Database["public"]["Enums"]["savings_product_type"]
          status?: string
          updated_at?: string
          updated_by?: string | null
          withdrawal_allowed?: boolean
          withdrawal_frequency_limit?: number | null
          withdrawal_notice_days?: number | null
          withdrawal_percentage_limit?: number | null
        }
        Update: {
          account_number_format?: string
          bonus_eligible?: boolean
          collateral_eligible?: boolean
          contribution_frequency?: Database["public"]["Enums"]["contribution_frequency"]
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          eligibility_wait_days?: number
          id?: string
          interest_enabled?: boolean
          interest_method?: string | null
          interest_rate?: number | null
          is_sample?: boolean
          loan_eligibility_enabled?: boolean
          maximum_contribution?: number | null
          minimum_contribution?: number | null
          minimum_opening_balance?: number
          product_code?: string
          product_name?: string
          product_type?: Database["public"]["Enums"]["savings_product_type"]
          status?: string
          updated_at?: string
          updated_by?: string | null
          withdrawal_allowed?: boolean
          withdrawal_frequency_limit?: number | null
          withdrawal_notice_days?: number | null
          withdrawal_percentage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_products_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_transactions: {
        Row: {
          amount: number
          approved_by: string | null
          batch_id: string | null
          checked_by: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          description: string | null
          direction: Database["public"]["Enums"]["savings_direction"]
          eligible_from_date: string | null
          external_reference: string | null
          id: string
          member_id: string
          metadata: Json | null
          payment_reference: string | null
          period_id: string | null
          posted_at: string | null
          posted_by: string | null
          reversal_of_transaction_id: string | null
          reversal_reason: string | null
          reversed_at: string | null
          savings_account_id: string
          savings_product_id: string
          source: Database["public"]["Enums"]["savings_transaction_source"]
          status: Database["public"]["Enums"]["savings_transaction_status"]
          transaction_date: string
          transaction_number: string
          transaction_type: Database["public"]["Enums"]["savings_transaction_type"]
          updated_at: string
          updated_by: string | null
          value_date: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          batch_id?: string | null
          checked_by?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction: Database["public"]["Enums"]["savings_direction"]
          eligible_from_date?: string | null
          external_reference?: string | null
          id?: string
          member_id: string
          metadata?: Json | null
          payment_reference?: string | null
          period_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reversal_of_transaction_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          savings_account_id: string
          savings_product_id: string
          source?: Database["public"]["Enums"]["savings_transaction_source"]
          status?: Database["public"]["Enums"]["savings_transaction_status"]
          transaction_date?: string
          transaction_number: string
          transaction_type: Database["public"]["Enums"]["savings_transaction_type"]
          updated_at?: string
          updated_by?: string | null
          value_date?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          batch_id?: string | null
          checked_by?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["savings_direction"]
          eligible_from_date?: string | null
          external_reference?: string | null
          id?: string
          member_id?: string
          metadata?: Json | null
          payment_reference?: string | null
          period_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reversal_of_transaction_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          savings_account_id?: string
          savings_product_id?: string
          source?: Database["public"]["Enums"]["savings_transaction_source"]
          status?: Database["public"]["Enums"]["savings_transaction_status"]
          transaction_date?: string
          transaction_number?: string
          transaction_type?: Database["public"]["Enums"]["savings_transaction_type"]
          updated_at?: string
          updated_by?: string | null
          value_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_transactions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "savings_migration_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_transactions_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_transactions_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "contribution_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_transactions_reversal_of_transaction_id_fkey"
            columns: ["reversal_of_transaction_id"]
            isOneToOne: false
            referencedRelation: "savings_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_transactions_savings_account_id_fkey"
            columns: ["savings_account_id"]
            isOneToOne: false
            referencedRelation: "member_savings_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_transactions_savings_product_id_fkey"
            columns: ["savings_product_id"]
            isOneToOne: false
            referencedRelation: "savings_products"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_notifications: {
        Row: {
          body: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          link: string | null
          read_at: string | null
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          link?: string | null
          read_at?: string | null
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          link?: string | null
          read_at?: string | null
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_notifications_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          approved_by: string | null
          checked_by: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          is_demo: boolean
          member_id: string | null
          posted_at: string | null
          reference: string | null
          reversed_transaction_id: string | null
          source: string
          status: Database["public"]["Enums"]["transaction_status"]
          transaction_date: string
          transaction_type: string
          updated_at: string
          updated_by: string | null
          value_date: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          approved_by?: string | null
          checked_by?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          member_id?: string | null
          posted_at?: string | null
          reference?: string | null
          reversed_transaction_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_date?: string
          transaction_type: string
          updated_at?: string
          updated_by?: string | null
          value_date?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          approved_by?: string | null
          checked_by?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          member_id?: string | null
          posted_at?: string | null
          reference?: string | null
          reversed_transaction_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
          updated_by?: string | null
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reversed_transaction_id_fkey"
            columns: ["reversed_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      unapplied_loan_payments: {
        Row: {
          amount: number
          cooperative_id: string
          created_at: string
          created_by: string | null
          id: string
          loan_id: string | null
          member_id: string | null
          payment_source: Database["public"]["Enums"]["loan_repayment_source"]
          reason: string
          received_date: string
          reference: string | null
          repayment_id: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          loan_id?: string | null
          member_id?: string | null
          payment_source?: Database["public"]["Enums"]["loan_repayment_source"]
          reason?: string
          received_date?: string
          reference?: string | null
          repayment_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          loan_id?: string | null
          member_id?: string | null
          payment_source?: Database["public"]["Enums"]["loan_repayment_source"]
          reason?: string
          received_date?: string
          reference?: string | null
          repayment_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unapplied_loan_payments_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unapplied_loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unapplied_loan_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unapplied_loan_payments_repayment_id_fkey"
            columns: ["repayment_id"]
            isOneToOne: false
            referencedRelation: "loan_repayments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          cooperative_id: string | null
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          role_id: string | null
          status: Database["public"]["Enums"]["user_status"]
          user_id: string
        }
        Insert: {
          cooperative_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          user_id: string
        }
        Update: {
          cooperative_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_eligibility_checks: {
        Row: {
          available_balance: number
          calculated_at: string
          calculated_by: string | null
          calculated_eligible_amount: number
          cooperative_id: string
          created_at: string
          eligibility_status: Database["public"]["Enums"]["withdrawal_eligibility_status"]
          failure_reasons: string[]
          id: string
          last_withdrawal_date: string | null
          maximum_allowed: number
          member_id: string
          membership_tenure_months: number
          outstanding_loan_balance: number
          overdue_amount: number
          pledged_balance: number
          reserved_balance: number
          restricted_balance: number
          rule_snapshot: Json | null
          savings_balance: number
          savings_tenure_months: number
          updated_at: string
          withdrawal_request_id: string | null
          withdrawal_type_id: string
          withdrawals_in_period: number
        }
        Insert: {
          available_balance?: number
          calculated_at?: string
          calculated_by?: string | null
          calculated_eligible_amount?: number
          cooperative_id: string
          created_at?: string
          eligibility_status?: Database["public"]["Enums"]["withdrawal_eligibility_status"]
          failure_reasons?: string[]
          id?: string
          last_withdrawal_date?: string | null
          maximum_allowed?: number
          member_id: string
          membership_tenure_months?: number
          outstanding_loan_balance?: number
          overdue_amount?: number
          pledged_balance?: number
          reserved_balance?: number
          restricted_balance?: number
          rule_snapshot?: Json | null
          savings_balance?: number
          savings_tenure_months?: number
          updated_at?: string
          withdrawal_request_id?: string | null
          withdrawal_type_id: string
          withdrawals_in_period?: number
        }
        Update: {
          available_balance?: number
          calculated_at?: string
          calculated_by?: string | null
          calculated_eligible_amount?: number
          cooperative_id?: string
          created_at?: string
          eligibility_status?: Database["public"]["Enums"]["withdrawal_eligibility_status"]
          failure_reasons?: string[]
          id?: string
          last_withdrawal_date?: string | null
          maximum_allowed?: number
          member_id?: string
          membership_tenure_months?: number
          outstanding_loan_balance?: number
          overdue_amount?: number
          pledged_balance?: number
          reserved_balance?: number
          restricted_balance?: number
          rule_snapshot?: Json | null
          savings_balance?: number
          savings_tenure_months?: number
          updated_at?: string
          withdrawal_request_id?: string | null
          withdrawal_type_id?: string
          withdrawals_in_period?: number
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_eligibility_checks_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_eligibility_checks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_eligibility_checks_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_eligibility_checks_withdrawal_type_id_fkey"
            columns: ["withdrawal_type_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_types"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_exceptions: {
        Row: {
          assigned_to: string | null
          cooperative_id: string
          created_at: string
          detail: string | null
          detected_at: string
          exception_type: string
          id: string
          member_id: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["checkoff_exception_severity"]
          status: Database["public"]["Enums"]["withdrawal_exception_status"]
          updated_at: string
          withdrawal_request_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          cooperative_id: string
          created_at?: string
          detail?: string | null
          detected_at?: string
          exception_type: string
          id?: string
          member_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["checkoff_exception_severity"]
          status?: Database["public"]["Enums"]["withdrawal_exception_status"]
          updated_at?: string
          withdrawal_request_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          cooperative_id?: string
          created_at?: string
          detail?: string | null
          detected_at?: string
          exception_type?: string
          id?: string
          member_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["checkoff_exception_severity"]
          status?: Database["public"]["Enums"]["withdrawal_exception_status"]
          updated_at?: string
          withdrawal_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_exceptions_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_exceptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_exceptions_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_holds: {
        Row: {
          amount: number
          cooperative_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          hold_type: string
          id: string
          member_id: string
          reason: string | null
          released_at: string | null
          released_by: string | null
          savings_account_id: string | null
          status: Database["public"]["Enums"]["withdrawal_hold_status"]
          updated_at: string
          withdrawal_request_id: string | null
        }
        Insert: {
          amount: number
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          hold_type?: string
          id?: string
          member_id: string
          reason?: string | null
          released_at?: string | null
          released_by?: string | null
          savings_account_id?: string | null
          status?: Database["public"]["Enums"]["withdrawal_hold_status"]
          updated_at?: string
          withdrawal_request_id?: string | null
        }
        Update: {
          amount?: number
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          hold_type?: string
          id?: string
          member_id?: string
          reason?: string | null
          released_at?: string | null
          released_by?: string | null
          savings_account_id?: string | null
          status?: Database["public"]["Enums"]["withdrawal_hold_status"]
          updated_at?: string
          withdrawal_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_holds_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_holds_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_holds_savings_account_id_fkey"
            columns: ["savings_account_id"]
            isOneToOne: false
            referencedRelation: "member_savings_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_holds_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_payouts: {
        Row: {
          amount: number
          bank_account_id: string | null
          bank_reference: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          failure_reason: string | null
          id: string
          initiated_at: string | null
          member_id: string
          notes: string | null
          payment_provider: string | null
          payment_reference: string | null
          processed_at: string | null
          processed_by: string | null
          retry_count: number
          status: Database["public"]["Enums"]["withdrawal_payout_status"]
          updated_at: string
          withdrawal_request_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          bank_reference?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          id?: string
          initiated_at?: string | null
          member_id: string
          notes?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          processed_at?: string | null
          processed_by?: string | null
          retry_count?: number
          status?: Database["public"]["Enums"]["withdrawal_payout_status"]
          updated_at?: string
          withdrawal_request_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          bank_reference?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          id?: string
          initiated_at?: string | null
          member_id?: string
          notes?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          processed_at?: string | null
          processed_by?: string | null
          retry_count?: number
          status?: Database["public"]["Enums"]["withdrawal_payout_status"]
          updated_at?: string
          withdrawal_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_payouts_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "member_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_payouts_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_payouts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_payouts_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          approved_amount: number | null
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          checked_at: string | null
          checked_by: string | null
          completed_at: string | null
          cooperative_id: string
          created_at: string
          created_by: string | null
          currency: string
          destination_bank_account_id: string | null
          document_id: string | null
          eligibility_snapshot: Json | null
          eligibility_status: Database["public"]["Enums"]["withdrawal_eligibility_status"]
          eligible_amount: number
          fee_amount: number
          id: string
          member_id: string
          net_payout_amount: number
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          purpose: string | null
          rejected_at: string | null
          rejection_reason: string | null
          request_date: string
          requested_amount: number
          requested_payment_date: string | null
          reversal_of: string | null
          reversal_reason: string | null
          reversed_at: string | null
          savings_account_id: string | null
          savings_product_id: string | null
          savings_transaction_id: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          submitted_at: string | null
          updated_at: string
          withdrawal_number: string
          withdrawal_type_id: string
        }
        Insert: {
          approved_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_at?: string | null
          checked_by?: string | null
          completed_at?: string | null
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          destination_bank_account_id?: string | null
          document_id?: string | null
          eligibility_snapshot?: Json | null
          eligibility_status?: Database["public"]["Enums"]["withdrawal_eligibility_status"]
          eligible_amount?: number
          fee_amount?: number
          id?: string
          member_id: string
          net_payout_amount?: number
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          purpose?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          request_date?: string
          requested_amount: number
          requested_payment_date?: string | null
          reversal_of?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          savings_account_id?: string | null
          savings_product_id?: string | null
          savings_transaction_id?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          submitted_at?: string | null
          updated_at?: string
          withdrawal_number: string
          withdrawal_type_id: string
        }
        Update: {
          approved_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_at?: string | null
          checked_by?: string | null
          completed_at?: string | null
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          destination_bank_account_id?: string | null
          document_id?: string | null
          eligibility_snapshot?: Json | null
          eligibility_status?: Database["public"]["Enums"]["withdrawal_eligibility_status"]
          eligible_amount?: number
          fee_amount?: number
          id?: string
          member_id?: string
          net_payout_amount?: number
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          purpose?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          request_date?: string
          requested_amount?: number
          requested_payment_date?: string | null
          reversal_of?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          savings_account_id?: string | null
          savings_product_id?: string | null
          savings_transaction_id?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          submitted_at?: string | null
          updated_at?: string
          withdrawal_number?: string
          withdrawal_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_destination_bank_account_id_fkey"
            columns: ["destination_bank_account_id"]
            isOneToOne: false
            referencedRelation: "member_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "member_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_savings_account_id_fkey"
            columns: ["savings_account_id"]
            isOneToOne: false
            referencedRelation: "member_savings_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_savings_product_id_fkey"
            columns: ["savings_product_id"]
            isOneToOne: false
            referencedRelation: "savings_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_savings_transaction_id_fkey"
            columns: ["savings_transaction_id"]
            isOneToOne: false
            referencedRelation: "savings_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_withdrawal_type_id_fkey"
            columns: ["withdrawal_type_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_types"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_types: {
        Row: {
          active: boolean
          allowed_member_categories: string[]
          allowed_member_statuses: string[]
          approval_level: string | null
          code: string
          cooling_period_days: number
          cooperative_id: string
          created_at: string
          created_by: string | null
          description: string | null
          eligible_product_types: string[]
          eligible_savings_products: string[]
          fee_type: Database["public"]["Enums"]["loan_fee_type"]
          fee_value: number
          frequency_limit: number | null
          frequency_period: Database["public"]["Enums"]["withdrawal_frequency_period"]
          frequency_rolling_days: number | null
          id: string
          maximum_amount: number | null
          maximum_percentage: number | null
          minimum_amount: number
          minimum_balance_after: number
          minimum_membership_months: number
          minimum_savings_months: number
          name: string
          requires_approval: boolean
          requires_document: boolean
          requires_no_active_loan: boolean
          requires_no_delinquency: boolean
          requires_purpose: boolean
          rules_configuration: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          allowed_member_categories?: string[]
          allowed_member_statuses?: string[]
          approval_level?: string | null
          code: string
          cooling_period_days?: number
          cooperative_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligible_product_types?: string[]
          eligible_savings_products?: string[]
          fee_type?: Database["public"]["Enums"]["loan_fee_type"]
          fee_value?: number
          frequency_limit?: number | null
          frequency_period?: Database["public"]["Enums"]["withdrawal_frequency_period"]
          frequency_rolling_days?: number | null
          id?: string
          maximum_amount?: number | null
          maximum_percentage?: number | null
          minimum_amount?: number
          minimum_balance_after?: number
          minimum_membership_months?: number
          minimum_savings_months?: number
          name: string
          requires_approval?: boolean
          requires_document?: boolean
          requires_no_active_loan?: boolean
          requires_no_delinquency?: boolean
          requires_purpose?: boolean
          rules_configuration?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          allowed_member_categories?: string[]
          allowed_member_statuses?: string[]
          approval_level?: string | null
          code?: string
          cooling_period_days?: number
          cooperative_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligible_product_types?: string[]
          eligible_savings_products?: string[]
          fee_type?: Database["public"]["Enums"]["loan_fee_type"]
          fee_value?: number
          frequency_limit?: number | null
          frequency_period?: Database["public"]["Enums"]["withdrawal_frequency_period"]
          frequency_rolling_days?: number | null
          id?: string
          maximum_amount?: number | null
          maximum_percentage?: number | null
          minimum_amount?: number
          minimum_balance_after?: number
          minimum_membership_months?: number
          minimum_savings_months?: number
          name?: string
          requires_approval?: boolean
          requires_document?: boolean
          requires_no_active_loan?: boolean
          requires_no_delinquency?: boolean
          requires_purpose?: boolean
          rules_configuration?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_types_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_ledger: {
        Args: {
          _account_id: string
          _cooperative_id: string
          _from: string
          _limit?: number
          _to: string
        }
        Returns: {
          credit: number
          debit: number
          description: string
          journal_id: string
          journal_number: string
          line_id: string
          loan_id: string
          member_id: string
          posting_date: string
          reference: string
          running_balance: number
          source_id: string
          source_type: string
        }[]
      }
      can_admin_cooperative: {
        Args: { _cooperative_id: string; _user_id?: string }
        Returns: boolean
      }
      change_member_status: {
        Args: {
          _effective_date?: string
          _member_id: string
          _new_status: Database["public"]["Enums"]["member_lifecycle_status"]
          _reason?: string
        }
        Returns: Database["public"]["Enums"]["member_lifecycle_status"]
      }
      has_permission: {
        Args: {
          _cooperative_id: string
          _permission: string
          _user_id?: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _cooperative_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member_of_cooperative: {
        Args: { _cooperative_id: string; _user_id?: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id?: string }; Returns: boolean }
      member_status_transition_allowed: {
        Args: {
          _from: Database["public"]["Enums"]["member_lifecycle_status"]
          _to: Database["public"]["Enums"]["member_lifecycle_status"]
        }
        Returns: boolean
      }
      next_checkoff_batch_number: {
        Args: { _cooperative_id: string }
        Returns: string
      }
      next_collection_case_number: {
        Args: { _cooperative_id: string }
        Returns: string
      }
      next_exit_settlement_number: {
        Args: { _cooperative_id: string }
        Returns: string
      }
      next_journal_number: {
        Args: { _cooperative_id: string }
        Returns: string
      }
      next_loan_application_number: {
        Args: { _cooperative_id: string }
        Returns: string
      }
      next_loan_number: { Args: { _cooperative_id: string }; Returns: string }
      next_loan_repayment_number: {
        Args: { _cooperative_id: string }
        Returns: string
      }
      next_member_number: { Args: { _cooperative_id: string }; Returns: string }
      next_savings_account_number: {
        Args: {
          _cooperative_id: string
          _member_id: string
          _product_id: string
        }
        Returns: string
      }
      next_savings_transaction_number: {
        Args: { _cooperative_id: string }
        Returns: string
      }
      next_withdrawal_number: {
        Args: { _cooperative_id: string }
        Returns: string
      }
      post_accounting_event: {
        Args: {
          _amount: number
          _cooperative_id: string
          _description?: string
          _event_code: string
          _journal_date: string
          _loan_id?: string
          _loan_product_id?: string
          _member_id?: string
          _reference?: string
          _savings_product_id?: string
          _source_channel?: string
          _source_id: string
          _source_type: string
          _withdrawal_type_id?: string
        }
        Returns: string
      }
      post_manual_journal: { Args: { _journal_id: string }; Returns: string }
      recalc_loan_balances: { Args: { _loan_id: string }; Returns: undefined }
      recalc_savings_account_balance: {
        Args: { _account_id: string }
        Returns: undefined
      }
      resolve_accounting_mapping: {
        Args: {
          _cooperative_id: string
          _event_code: string
          _loan_product_id?: string
          _savings_product_id?: string
          _source_channel?: string
          _withdrawal_type_id?: string
        }
        Returns: {
          cooperative_id: string
          created_at: string
          created_by: string | null
          credit_account_id: string | null
          debit_account_id: string | null
          description: string | null
          event_code: string
          id: string
          is_active: boolean
          loan_product_id: string | null
          priority: number
          savings_product_id: string | null
          source_channel: string | null
          updated_at: string
          updated_by: string | null
          withdrawal_type_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "accounting_mappings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      retry_accounting_exception: {
        Args: { _exception_id: string }
        Returns: string
      }
      reverse_journal: {
        Args: { _journal_id: string; _reason: string }
        Returns: string
      }
      run_loan_daily_maintenance: { Args: { _as_of?: string }; Returns: Json }
      seed_default_accounting_mappings: {
        Args: { _cooperative_id: string }
        Returns: number
      }
      seed_sample_chart_of_accounts: {
        Args: { _cooperative_id: string }
        Returns: number
      }
      shares_cooperative_with: {
        Args: { _other_user_id: string; _user_id?: string }
        Returns: boolean
      }
      subledger_reconciliation: {
        Args: { _as_of: string; _cooperative_id: string }
        Returns: {
          difference: number
          gl_balance: number
          subledger: string
          subledger_balance: number
        }[]
      }
      trial_balance: {
        Args: { _cooperative_id: string; _from: string; _to: string }
        Returns: {
          account_id: string
          account_subtype: string
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          credit: number
          debit: number
          name: string
          net: number
          normal_balance: Database["public"]["Enums"]["normal_balance"]
          opening: number
        }[]
      }
    }
    Enums: {
      account_type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE"
      accounting_exception_status: "OPEN" | "RESOLVED" | "IGNORED"
      app_role:
        | "PLATFORM_SUPER_ADMIN"
        | "PLATFORM_SUPPORT"
        | "PLATFORM_AUDITOR"
        | "COOPERATIVE_ADMIN"
        | "COOPERATIVE_MANAGER"
        | "TREASURER"
        | "ACCOUNTANT"
        | "LOAN_OFFICER"
        | "CHECKER"
        | "APPROVER"
        | "AUDITOR"
        | "PAYROLL_OFFICER"
        | "SECRETARY"
        | "COMMITTEE_MEMBER"
        | "MEMBER"
      approval_action_type: "SUBMIT" | "CHECK" | "APPROVE" | "REJECT" | "CANCEL"
      bank_change_status: "PENDING" | "APPROVED" | "REJECTED"
      checkoff_batch_status:
        | "DRAFT"
        | "UPLOADED"
        | "PARSING"
        | "VALIDATING"
        | "VALIDATION_COMPLETE"
        | "EXCEPTION_REVIEW"
        | "READY_FOR_APPROVAL"
        | "CHECKED"
        | "APPROVED"
        | "PROCESSING"
        | "POSTED"
        | "PARTIALLY_POSTED"
        | "REJECTED"
        | "FAILED"
        | "REVERSED"
        | "CANCELLED"
        | "CLOSED"
      checkoff_deduction_type:
        | "ORDINARY_SAVINGS"
        | "SPECIAL_SAVINGS"
        | "SHARE_CONTRIBUTION"
        | "LOAN_REPAYMENT"
        | "INSURANCE"
        | "OTHER_DEDUCTION"
      checkoff_exception_severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
      checkoff_line_posting_status:
        | "PENDING"
        | "HELD"
        | "POSTED"
        | "DEFERRED"
        | "REJECTED"
        | "REVERSED"
      checkoff_match_status:
        | "UNMATCHED"
        | "EXACT_MATCH"
        | "STRONG_MATCH"
        | "POSSIBLE_MATCH"
        | "MANUAL_MATCH"
        | "MULTIPLE_MATCHES"
        | "REJECTED"
      checkoff_settlement_status:
        | "EXPECTED"
        | "PARTIALLY_RECEIVED"
        | "RECEIVED"
        | "VARIANCE"
        | "UNIDENTIFIED"
        | "RECONCILED"
      checkoff_source_type:
        | "PAYROLL_FILE"
        | "CSV"
        | "EXCEL"
        | "API"
        | "BANK_ADVICE"
        | "MANUAL_ENTRY"
        | "PREVIOUS_BATCH_TEMPLATE"
        | "OTHER"
      collection_action_type:
        | "SMS"
        | "EMAIL"
        | "PHONE_CALL"
        | "REMINDER"
        | "MEETING"
        | "PAYMENT_REQUEST"
        | "PROMISE_TO_PAY"
        | "GUARANTOR_CONTACT"
        | "EMPLOYER_ESCALATION"
        | "COMMITTEE_ESCALATION"
        | "RECOVERY_ACTION"
        | "LEGAL_REVIEW"
        | "OTHER"
      collection_case_status:
        | "OPEN"
        | "CONTACTED"
        | "PROMISE_TO_PAY"
        | "ESCALATED"
        | "RESTRUCTURING"
        | "RECOVERY"
        | "LEGAL_REVIEW"
        | "RESOLVED"
        | "CLOSED"
      collection_priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      contribution_compliance_status:
        | "NOT_DUE"
        | "DUE"
        | "PARTIALLY_PAID"
        | "FULLY_PAID"
        | "OVERPAID"
        | "WAIVED"
        | "SUSPENDED"
        | "NOT_APPLICABLE"
      contribution_frequency:
        | "MONTHLY"
        | "WEEKLY"
        | "BIWEEKLY"
        | "QUARTERLY"
        | "ANNUAL"
        | "CUSTOM"
      contribution_period_status: "OPEN" | "PROCESSING" | "POSTED" | "CLOSED"
      cooperative_status: "ACTIVE" | "PENDING" | "SUSPENDED" | "CLOSED"
      cooperative_type:
        | "THRIFT_AND_CREDIT"
        | "CONSUMER"
        | "MULTIPURPOSE"
        | "AGRICULTURAL"
        | "STAFF"
        | "HOUSING"
        | "OTHER"
      employment_status_type:
        | "EMPLOYED"
        | "RETIRED"
        | "RESIGNED"
        | "TERMINATED"
        | "DECEASED"
        | "SELF_EMPLOYED"
        | "OTHER"
      exit_settlement_status:
        | "REQUESTED"
        | "NOTICE_CHECK"
        | "CALCULATED"
        | "UNDER_REVIEW"
        | "CHECKED"
        | "APPROVED"
        | "SETTLED"
        | "REJECTED"
        | "CANCELLED"
      journal_status:
        | "DRAFT"
        | "SUBMITTED"
        | "CHECKED"
        | "APPROVED"
        | "POSTED"
        | "REJECTED"
        | "REVERSED"
        | "CANCELLED"
      loan_account_status:
        | "PENDING_DISBURSEMENT"
        | "ACTIVE"
        | "CLOSED"
        | "DEFAULTED"
        | "RESTRUCTURED"
        | "WRITTEN_OFF"
        | "CANCELLED"
      loan_allocation_status:
        | "UNALLOCATED"
        | "PARTIALLY_ALLOCATED"
        | "FULLY_ALLOCATED"
      loan_allocation_type:
        | "PENALTY"
        | "PROCESSING_FEE"
        | "ADMIN_FEE"
        | "INSURANCE"
        | "INTEREST"
        | "PRINCIPAL"
        | "OTHER"
      loan_application_status:
        | "DRAFT"
        | "SUBMITTED"
        | "ELIGIBILITY_CHECK"
        | "UNDER_REVIEW"
        | "GUARANTOR_PENDING"
        | "CREDIT_REVIEW"
        | "CHECKED"
        | "APPROVED"
        | "DISBURSEMENT_PENDING"
        | "DISBURSED"
        | "ACTIVE"
        | "CLOSED"
        | "REJECTED"
        | "DECLINED"
        | "WITHDRAWN"
        | "CANCELLED"
        | "DEFAULTED"
        | "RESTRUCTURED"
        | "WRITTEN_OFF"
      loan_assessment_status: "DRAFT" | "COMPLETED"
      loan_eligibility_status:
        | "NOT_CHECKED"
        | "ELIGIBLE"
        | "CONDITIONAL"
        | "NOT_ELIGIBLE"
      loan_fee_type: "NONE" | "FLAT" | "PERCENTAGE"
      loan_guarantor_status:
        | "PENDING"
        | "ACCEPTED"
        | "DECLINED"
        | "RELEASED"
        | "CANCELLED"
      loan_interest_method:
        | "FLAT"
        | "REDUCING_BALANCE"
        | "AMORTISED"
        | "SIMPLE"
        | "CUSTOM"
      loan_repayment_source:
        | "CHECK_OFF"
        | "BANK_TRANSFER"
        | "DIRECT_DEBIT"
        | "CASH"
        | "INTERNAL_TRANSFER"
        | "SAVINGS_OFFSET"
        | "PORTAL"
        | "MANUAL_ADJUSTMENT"
        | "GUARANTOR_RECOVERY"
        | "RECOVERY_AFTER_WRITE_OFF"
        | "OTHER"
      loan_repayment_status:
        | "DRAFT"
        | "PENDING"
        | "MATCHED"
        | "CHECKED"
        | "APPROVED"
        | "POSTED"
        | "UNAPPLIED"
        | "REVERSED"
        | "FAILED"
        | "CANCELLED"
      loan_request_status:
        | "REQUESTED"
        | "UNDER_REVIEW"
        | "CHECKED"
        | "APPROVED"
        | "REJECTED"
        | "POSTED"
        | "EFFECTIVE"
        | "CANCELLED"
        | "EXPIRED"
        | "SETTLED"
        | "RECOVERED"
      loan_risk_rating: "LOW" | "MODERATE" | "HIGH" | "CRITICAL"
      loan_security_status: "PROPOSED" | "VERIFIED" | "REJECTED" | "RELEASED"
      loan_security_type:
        | "SAVINGS"
        | "SELF_GUARANTEE"
        | "GUARANTOR"
        | "PDC"
        | "STANDING_INSTRUCTION"
        | "INSURANCE"
        | "ASSET"
        | "PROPERTY"
        | "INVESTMENT"
        | "OTHER"
      loan_tenure_unit: "DAYS" | "WEEKS" | "MONTHS" | "YEARS"
      loan_transaction_status: "DRAFT" | "POSTED" | "REVERSED"
      loan_transaction_type:
        | "DISBURSEMENT"
        | "PRINCIPAL_REPAYMENT"
        | "INTEREST_ACCRUAL"
        | "INTEREST_REPAYMENT"
        | "FEE_CHARGE"
        | "FEE_REPAYMENT"
        | "PENALTY_CHARGE"
        | "PENALTY_REPAYMENT"
        | "ADJUSTMENT_DEBIT"
        | "ADJUSTMENT_CREDIT"
        | "REVERSAL"
        | "WRITE_OFF"
        | "RESTRUCTURE_ADJUSTMENT"
      member_document_status:
        | "UPLOADED"
        | "UNDER_REVIEW"
        | "VERIFIED"
        | "REJECTED"
        | "EXPIRED"
      member_lifecycle_status:
        | "PROSPECTIVE"
        | "PENDING_VERIFICATION"
        | "PENDING_APPROVAL"
        | "ACTIVE"
        | "SUSPENDED"
        | "DORMANT"
        | "REACTIVATION_PENDING"
        | "RETIRED"
        | "EXIT_PENDING"
        | "EXITED"
        | "DECEASED"
        | "BLACKLISTED"
      member_note_category:
        | "GENERAL"
        | "MEMBERSHIP"
        | "COMPLIANCE"
        | "EMPLOYMENT"
        | "LOAN"
        | "PAYROLL"
        | "OTHER"
      member_status: "ACTIVE" | "PENDING" | "DORMANT" | "EXITED" | "SUSPENDED"
      member_verification_action:
        | "VERIFY"
        | "REQUEST_CORRECTION"
        | "REJECT"
        | "ESCALATE"
      normal_balance: "DEBIT" | "CREDIT"
      period_status: "OPEN" | "SOFT_CLOSED" | "CLOSED"
      promise_status:
        | "PENDING"
        | "KEPT"
        | "PARTIALLY_KEPT"
        | "BROKEN"
        | "CANCELLED"
      rule_value_type: "NUMERIC" | "TEXT" | "BOOLEAN" | "JSON"
      savings_account_status:
        | "PENDING"
        | "ACTIVE"
        | "FROZEN"
        | "DORMANT"
        | "CLOSED"
      savings_batch_status:
        | "DRAFT"
        | "VALIDATED"
        | "APPROVED"
        | "POSTED"
        | "CANCELLED"
      savings_direction: "CREDIT" | "DEBIT"
      savings_product_type: "ORDINARY" | "SPECIAL" | "INVESTMENT" | "OTHER"
      savings_transaction_source:
        | "MANUAL"
        | "BANK_TRANSFER"
        | "CASH"
        | "CHECK_OFF"
        | "IMPORT"
        | "OPENING_BALANCE"
        | "SYSTEM"
      savings_transaction_status:
        | "DRAFT"
        | "SUBMITTED"
        | "CHECKED"
        | "APPROVED"
        | "POSTED"
        | "REJECTED"
        | "REVERSED"
        | "CANCELLED"
      savings_transaction_type:
        | "OPENING_BALANCE"
        | "CONTRIBUTION"
        | "SPECIAL_CONTRIBUTION"
        | "CHECK_OFF_CONTRIBUTION"
        | "BANK_TRANSFER_CONTRIBUTION"
        | "CASH_CONTRIBUTION"
        | "ADJUSTMENT_CREDIT"
        | "ADJUSTMENT_DEBIT"
        | "INTEREST_CREDIT"
        | "BONUS_CREDIT"
        | "WITHDRAWAL"
        | "REVERSAL"
        | "TRANSFER_IN"
        | "TRANSFER_OUT"
        | "OTHER_CREDIT"
        | "OTHER_DEBIT"
      transaction_status:
        | "DRAFT"
        | "PENDING"
        | "SUBMITTED"
        | "CHECKED"
        | "APPROVED"
        | "PROCESSING"
        | "COMPLETED"
        | "REJECTED"
        | "FAILED"
        | "REVERSED"
        | "CANCELLED"
      user_status: "ACTIVE" | "INVITED" | "SUSPENDED" | "LOCKED" | "DISABLED"
      withdrawal_eligibility_status:
        | "NOT_CHECKED"
        | "ELIGIBLE"
        | "PARTIALLY_ELIGIBLE"
        | "NOT_ELIGIBLE"
      withdrawal_exception_status:
        | "OPEN"
        | "IN_REVIEW"
        | "RESOLVED"
        | "DISMISSED"
      withdrawal_frequency_period:
        | "CALENDAR_YEAR"
        | "ROLLING_YEAR"
        | "CALENDAR_MONTH"
        | "QUARTER"
        | "ROLLING_DAYS"
      withdrawal_hold_status:
        | "ACTIVE"
        | "RELEASED"
        | "CONSUMED"
        | "EXPIRED"
        | "CANCELLED"
      withdrawal_payout_status:
        | "PENDING"
        | "SUBMITTED"
        | "PROCESSING"
        | "SUCCESSFUL"
        | "FAILED"
        | "RETRYING"
        | "REVERSED"
        | "CANCELLED"
      withdrawal_status:
        | "DRAFT"
        | "SUBMITTED"
        | "ELIGIBILITY_CHECK"
        | "UNDER_REVIEW"
        | "CHECKED"
        | "APPROVED"
        | "PAYMENT_PENDING"
        | "PROCESSING"
        | "COMPLETED"
        | "REJECTED"
        | "CANCELLED"
        | "FAILED"
        | "REVERSED"
        | "EXPIRED"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_type: ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"],
      accounting_exception_status: ["OPEN", "RESOLVED", "IGNORED"],
      app_role: [
        "PLATFORM_SUPER_ADMIN",
        "PLATFORM_SUPPORT",
        "PLATFORM_AUDITOR",
        "COOPERATIVE_ADMIN",
        "COOPERATIVE_MANAGER",
        "TREASURER",
        "ACCOUNTANT",
        "LOAN_OFFICER",
        "CHECKER",
        "APPROVER",
        "AUDITOR",
        "PAYROLL_OFFICER",
        "SECRETARY",
        "COMMITTEE_MEMBER",
        "MEMBER",
      ],
      approval_action_type: ["SUBMIT", "CHECK", "APPROVE", "REJECT", "CANCEL"],
      bank_change_status: ["PENDING", "APPROVED", "REJECTED"],
      checkoff_batch_status: [
        "DRAFT",
        "UPLOADED",
        "PARSING",
        "VALIDATING",
        "VALIDATION_COMPLETE",
        "EXCEPTION_REVIEW",
        "READY_FOR_APPROVAL",
        "CHECKED",
        "APPROVED",
        "PROCESSING",
        "POSTED",
        "PARTIALLY_POSTED",
        "REJECTED",
        "FAILED",
        "REVERSED",
        "CANCELLED",
        "CLOSED",
      ],
      checkoff_deduction_type: [
        "ORDINARY_SAVINGS",
        "SPECIAL_SAVINGS",
        "SHARE_CONTRIBUTION",
        "LOAN_REPAYMENT",
        "INSURANCE",
        "OTHER_DEDUCTION",
      ],
      checkoff_exception_severity: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
      checkoff_line_posting_status: [
        "PENDING",
        "HELD",
        "POSTED",
        "DEFERRED",
        "REJECTED",
        "REVERSED",
      ],
      checkoff_match_status: [
        "UNMATCHED",
        "EXACT_MATCH",
        "STRONG_MATCH",
        "POSSIBLE_MATCH",
        "MANUAL_MATCH",
        "MULTIPLE_MATCHES",
        "REJECTED",
      ],
      checkoff_settlement_status: [
        "EXPECTED",
        "PARTIALLY_RECEIVED",
        "RECEIVED",
        "VARIANCE",
        "UNIDENTIFIED",
        "RECONCILED",
      ],
      checkoff_source_type: [
        "PAYROLL_FILE",
        "CSV",
        "EXCEL",
        "API",
        "BANK_ADVICE",
        "MANUAL_ENTRY",
        "PREVIOUS_BATCH_TEMPLATE",
        "OTHER",
      ],
      collection_action_type: [
        "SMS",
        "EMAIL",
        "PHONE_CALL",
        "REMINDER",
        "MEETING",
        "PAYMENT_REQUEST",
        "PROMISE_TO_PAY",
        "GUARANTOR_CONTACT",
        "EMPLOYER_ESCALATION",
        "COMMITTEE_ESCALATION",
        "RECOVERY_ACTION",
        "LEGAL_REVIEW",
        "OTHER",
      ],
      collection_case_status: [
        "OPEN",
        "CONTACTED",
        "PROMISE_TO_PAY",
        "ESCALATED",
        "RESTRUCTURING",
        "RECOVERY",
        "LEGAL_REVIEW",
        "RESOLVED",
        "CLOSED",
      ],
      collection_priority: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      contribution_compliance_status: [
        "NOT_DUE",
        "DUE",
        "PARTIALLY_PAID",
        "FULLY_PAID",
        "OVERPAID",
        "WAIVED",
        "SUSPENDED",
        "NOT_APPLICABLE",
      ],
      contribution_frequency: [
        "MONTHLY",
        "WEEKLY",
        "BIWEEKLY",
        "QUARTERLY",
        "ANNUAL",
        "CUSTOM",
      ],
      contribution_period_status: ["OPEN", "PROCESSING", "POSTED", "CLOSED"],
      cooperative_status: ["ACTIVE", "PENDING", "SUSPENDED", "CLOSED"],
      cooperative_type: [
        "THRIFT_AND_CREDIT",
        "CONSUMER",
        "MULTIPURPOSE",
        "AGRICULTURAL",
        "STAFF",
        "HOUSING",
        "OTHER",
      ],
      employment_status_type: [
        "EMPLOYED",
        "RETIRED",
        "RESIGNED",
        "TERMINATED",
        "DECEASED",
        "SELF_EMPLOYED",
        "OTHER",
      ],
      exit_settlement_status: [
        "REQUESTED",
        "NOTICE_CHECK",
        "CALCULATED",
        "UNDER_REVIEW",
        "CHECKED",
        "APPROVED",
        "SETTLED",
        "REJECTED",
        "CANCELLED",
      ],
      journal_status: [
        "DRAFT",
        "SUBMITTED",
        "CHECKED",
        "APPROVED",
        "POSTED",
        "REJECTED",
        "REVERSED",
        "CANCELLED",
      ],
      loan_account_status: [
        "PENDING_DISBURSEMENT",
        "ACTIVE",
        "CLOSED",
        "DEFAULTED",
        "RESTRUCTURED",
        "WRITTEN_OFF",
        "CANCELLED",
      ],
      loan_allocation_status: [
        "UNALLOCATED",
        "PARTIALLY_ALLOCATED",
        "FULLY_ALLOCATED",
      ],
      loan_allocation_type: [
        "PENALTY",
        "PROCESSING_FEE",
        "ADMIN_FEE",
        "INSURANCE",
        "INTEREST",
        "PRINCIPAL",
        "OTHER",
      ],
      loan_application_status: [
        "DRAFT",
        "SUBMITTED",
        "ELIGIBILITY_CHECK",
        "UNDER_REVIEW",
        "GUARANTOR_PENDING",
        "CREDIT_REVIEW",
        "CHECKED",
        "APPROVED",
        "DISBURSEMENT_PENDING",
        "DISBURSED",
        "ACTIVE",
        "CLOSED",
        "REJECTED",
        "DECLINED",
        "WITHDRAWN",
        "CANCELLED",
        "DEFAULTED",
        "RESTRUCTURED",
        "WRITTEN_OFF",
      ],
      loan_assessment_status: ["DRAFT", "COMPLETED"],
      loan_eligibility_status: [
        "NOT_CHECKED",
        "ELIGIBLE",
        "CONDITIONAL",
        "NOT_ELIGIBLE",
      ],
      loan_fee_type: ["NONE", "FLAT", "PERCENTAGE"],
      loan_guarantor_status: [
        "PENDING",
        "ACCEPTED",
        "DECLINED",
        "RELEASED",
        "CANCELLED",
      ],
      loan_interest_method: [
        "FLAT",
        "REDUCING_BALANCE",
        "AMORTISED",
        "SIMPLE",
        "CUSTOM",
      ],
      loan_repayment_source: [
        "CHECK_OFF",
        "BANK_TRANSFER",
        "DIRECT_DEBIT",
        "CASH",
        "INTERNAL_TRANSFER",
        "SAVINGS_OFFSET",
        "PORTAL",
        "MANUAL_ADJUSTMENT",
        "GUARANTOR_RECOVERY",
        "RECOVERY_AFTER_WRITE_OFF",
        "OTHER",
      ],
      loan_repayment_status: [
        "DRAFT",
        "PENDING",
        "MATCHED",
        "CHECKED",
        "APPROVED",
        "POSTED",
        "UNAPPLIED",
        "REVERSED",
        "FAILED",
        "CANCELLED",
      ],
      loan_request_status: [
        "REQUESTED",
        "UNDER_REVIEW",
        "CHECKED",
        "APPROVED",
        "REJECTED",
        "POSTED",
        "EFFECTIVE",
        "CANCELLED",
        "EXPIRED",
        "SETTLED",
        "RECOVERED",
      ],
      loan_risk_rating: ["LOW", "MODERATE", "HIGH", "CRITICAL"],
      loan_security_status: ["PROPOSED", "VERIFIED", "REJECTED", "RELEASED"],
      loan_security_type: [
        "SAVINGS",
        "SELF_GUARANTEE",
        "GUARANTOR",
        "PDC",
        "STANDING_INSTRUCTION",
        "INSURANCE",
        "ASSET",
        "PROPERTY",
        "INVESTMENT",
        "OTHER",
      ],
      loan_tenure_unit: ["DAYS", "WEEKS", "MONTHS", "YEARS"],
      loan_transaction_status: ["DRAFT", "POSTED", "REVERSED"],
      loan_transaction_type: [
        "DISBURSEMENT",
        "PRINCIPAL_REPAYMENT",
        "INTEREST_ACCRUAL",
        "INTEREST_REPAYMENT",
        "FEE_CHARGE",
        "FEE_REPAYMENT",
        "PENALTY_CHARGE",
        "PENALTY_REPAYMENT",
        "ADJUSTMENT_DEBIT",
        "ADJUSTMENT_CREDIT",
        "REVERSAL",
        "WRITE_OFF",
        "RESTRUCTURE_ADJUSTMENT",
      ],
      member_document_status: [
        "UPLOADED",
        "UNDER_REVIEW",
        "VERIFIED",
        "REJECTED",
        "EXPIRED",
      ],
      member_lifecycle_status: [
        "PROSPECTIVE",
        "PENDING_VERIFICATION",
        "PENDING_APPROVAL",
        "ACTIVE",
        "SUSPENDED",
        "DORMANT",
        "REACTIVATION_PENDING",
        "RETIRED",
        "EXIT_PENDING",
        "EXITED",
        "DECEASED",
        "BLACKLISTED",
      ],
      member_note_category: [
        "GENERAL",
        "MEMBERSHIP",
        "COMPLIANCE",
        "EMPLOYMENT",
        "LOAN",
        "PAYROLL",
        "OTHER",
      ],
      member_status: ["ACTIVE", "PENDING", "DORMANT", "EXITED", "SUSPENDED"],
      member_verification_action: [
        "VERIFY",
        "REQUEST_CORRECTION",
        "REJECT",
        "ESCALATE",
      ],
      normal_balance: ["DEBIT", "CREDIT"],
      period_status: ["OPEN", "SOFT_CLOSED", "CLOSED"],
      promise_status: [
        "PENDING",
        "KEPT",
        "PARTIALLY_KEPT",
        "BROKEN",
        "CANCELLED",
      ],
      rule_value_type: ["NUMERIC", "TEXT", "BOOLEAN", "JSON"],
      savings_account_status: [
        "PENDING",
        "ACTIVE",
        "FROZEN",
        "DORMANT",
        "CLOSED",
      ],
      savings_batch_status: [
        "DRAFT",
        "VALIDATED",
        "APPROVED",
        "POSTED",
        "CANCELLED",
      ],
      savings_direction: ["CREDIT", "DEBIT"],
      savings_product_type: ["ORDINARY", "SPECIAL", "INVESTMENT", "OTHER"],
      savings_transaction_source: [
        "MANUAL",
        "BANK_TRANSFER",
        "CASH",
        "CHECK_OFF",
        "IMPORT",
        "OPENING_BALANCE",
        "SYSTEM",
      ],
      savings_transaction_status: [
        "DRAFT",
        "SUBMITTED",
        "CHECKED",
        "APPROVED",
        "POSTED",
        "REJECTED",
        "REVERSED",
        "CANCELLED",
      ],
      savings_transaction_type: [
        "OPENING_BALANCE",
        "CONTRIBUTION",
        "SPECIAL_CONTRIBUTION",
        "CHECK_OFF_CONTRIBUTION",
        "BANK_TRANSFER_CONTRIBUTION",
        "CASH_CONTRIBUTION",
        "ADJUSTMENT_CREDIT",
        "ADJUSTMENT_DEBIT",
        "INTEREST_CREDIT",
        "BONUS_CREDIT",
        "WITHDRAWAL",
        "REVERSAL",
        "TRANSFER_IN",
        "TRANSFER_OUT",
        "OTHER_CREDIT",
        "OTHER_DEBIT",
      ],
      transaction_status: [
        "DRAFT",
        "PENDING",
        "SUBMITTED",
        "CHECKED",
        "APPROVED",
        "PROCESSING",
        "COMPLETED",
        "REJECTED",
        "FAILED",
        "REVERSED",
        "CANCELLED",
      ],
      user_status: ["ACTIVE", "INVITED", "SUSPENDED", "LOCKED", "DISABLED"],
      withdrawal_eligibility_status: [
        "NOT_CHECKED",
        "ELIGIBLE",
        "PARTIALLY_ELIGIBLE",
        "NOT_ELIGIBLE",
      ],
      withdrawal_exception_status: [
        "OPEN",
        "IN_REVIEW",
        "RESOLVED",
        "DISMISSED",
      ],
      withdrawal_frequency_period: [
        "CALENDAR_YEAR",
        "ROLLING_YEAR",
        "CALENDAR_MONTH",
        "QUARTER",
        "ROLLING_DAYS",
      ],
      withdrawal_hold_status: [
        "ACTIVE",
        "RELEASED",
        "CONSUMED",
        "EXPIRED",
        "CANCELLED",
      ],
      withdrawal_payout_status: [
        "PENDING",
        "SUBMITTED",
        "PROCESSING",
        "SUCCESSFUL",
        "FAILED",
        "RETRYING",
        "REVERSED",
        "CANCELLED",
      ],
      withdrawal_status: [
        "DRAFT",
        "SUBMITTED",
        "ELIGIBILITY_CHECK",
        "UNDER_REVIEW",
        "CHECKED",
        "APPROVED",
        "PAYMENT_PENDING",
        "PROCESSING",
        "COMPLETED",
        "REJECTED",
        "CANCELLED",
        "FAILED",
        "REVERSED",
        "EXPIRED",
      ],
    },
  },
} as const
