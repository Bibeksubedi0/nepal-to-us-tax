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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          description: string
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          description: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          description?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          section: Database["public"]["Enums"]["admin_section"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          section: Database["public"]["Enums"]["admin_section"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          section?: Database["public"]["Enums"]["admin_section"]
          user_id?: string
        }
        Relationships: []
      }
      announcement_batches: {
        Row: {
          announcement_id: string
          batch_id: string
          created_at: string
        }
        Insert: {
          announcement_id: string
          batch_id: string
          created_at?: string
        }
        Update: {
          announcement_id?: string
          batch_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_batches_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          scheduled_at: string | null
          sent_at: string | null
          target_audience: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          target_audience?: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          target_audience?: string
          title?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          created_at: string
          id: string
          present: boolean
          session_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          present?: boolean
          session_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          present?: boolean
          session_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_email_runs: {
        Row: {
          batch_id: string | null
          batch_name: string | null
          created_at: string
          failed_count: number
          id: string
          recipient_count: number
          sent_by: string | null
          sent_count: number
          status: string
          subject: string
          template_key: string | null
        }
        Insert: {
          batch_id?: string | null
          batch_name?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          recipient_count?: number
          sent_by?: string | null
          sent_count?: number
          status?: string
          subject: string
          template_key?: string | null
        }
        Update: {
          batch_id?: string | null
          batch_name?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          recipient_count?: number
          sent_by?: string | null
          sent_count?: number
          status?: string
          subject?: string
          template_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_email_runs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_enrollments: {
        Row: {
          batch_id: string
          enrolled_at: string
          id: string
          student_id: string
        }
        Insert: {
          batch_id: string
          enrolled_at?: string
          id?: string
          student_id: string
        }
        Update: {
          batch_id?: string
          enrolled_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_enrollments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          access_granted: boolean
          completed_at: string | null
          created_at: string
          end_date: string
          enrolled_count: number
          id: string
          instructor_name: string | null
          is_completed: boolean
          is_partner: boolean
          max_seats: number
          name: string
          sponsor_organization: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          access_granted?: boolean
          completed_at?: string | null
          created_at?: string
          end_date: string
          enrolled_count?: number
          id?: string
          instructor_name?: string | null
          is_completed?: boolean
          is_partner?: boolean
          max_seats?: number
          name: string
          sponsor_organization?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          access_granted?: boolean
          completed_at?: string | null
          created_at?: string
          end_date?: string
          enrolled_count?: number
          id?: string
          instructor_name?: string | null
          is_completed?: boolean
          is_partner?: boolean
          max_seats?: number
          name?: string
          sponsor_organization?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          batch_id: string | null
          certificate_number: string
          created_at: string
          created_by: string | null
          file_path: string | null
          id: string
          is_unlocked: boolean
          issued_on: string | null
          notes: string | null
          student_id: string
          unlocked_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          batch_id?: string | null
          certificate_number: string
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          is_unlocked?: boolean
          issued_on?: string | null
          notes?: string | null
          student_id: string
          unlocked_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          batch_id?: string | null
          certificate_number?: string
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          is_unlocked?: boolean
          issued_on?: string | null
          notes?: string | null
          student_id?: string
          unlocked_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          notes: string | null
          recording_link: string | null
          session_date: string
          topic: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          notes?: string | null
          recording_link?: string | null
          session_date: string
          topic: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          recording_link?: string | null
          session_date?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          conversation_key: string
          created_at: string
          customer_avatar: string | null
          customer_id: string
          customer_name: string | null
          id: string
          last_message_at: string
          last_message_preview: string | null
          platform: string
          unread_count: number
        }
        Insert: {
          conversation_key: string
          created_at?: string
          customer_avatar?: string | null
          customer_id: string
          customer_name?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          platform: string
          unread_count?: number
        }
        Update: {
          conversation_key?: string
          created_at?: string
          customer_avatar?: string | null
          customer_id?: string
          customer_name?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          platform?: string
          unread_count?: number
        }
        Relationships: []
      }
      course_documents: {
        Row: {
          description: string
          file_name: string
          file_size: number
          file_url: string
          id: string
          tab: string
          title: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          description: string
          file_name: string
          file_size: number
          file_url: string
          id?: string
          tab: string
          title: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          description?: string
          file_name?: string
          file_size?: number
          file_url?: string
          id?: string
          tab?: string
          title?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      course_modules: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          file_path: string | null
          id: string
          is_unlocked: boolean
          module_number: number
          slide_count: number
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          is_unlocked?: boolean
          module_number: number
          slide_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          is_unlocked?: boolean
          module_number?: number
          slide_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_batches: {
        Row: {
          batch_id: string
          created_at: string
          document_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          document_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_batches_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "course_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          body: string
          clicks_count: number
          created_at: string
          cta_label: string | null
          cta_url: string | null
          error_message: string | null
          first_opened_at: string | null
          id: string
          inquiry_id: string | null
          last_clicked_at: string | null
          last_opened_at: string | null
          opens_count: number
          recipient_email: string
          recipient_name: string | null
          sent_by: string | null
          status: string
          subject: string
        }
        Insert: {
          body: string
          clicks_count?: number
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          error_message?: string | null
          first_opened_at?: string | null
          id?: string
          inquiry_id?: string | null
          last_clicked_at?: string | null
          last_opened_at?: string | null
          opens_count?: number
          recipient_email: string
          recipient_name?: string | null
          sent_by?: string | null
          status?: string
          subject: string
        }
        Update: {
          body?: string
          clicks_count?: number
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          error_message?: string | null
          first_opened_at?: string | null
          id?: string
          inquiry_id?: string | null
          last_clicked_at?: string | null
          last_opened_at?: string | null
          opens_count?: number
          recipient_email?: string
          recipient_name?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          answers: Json
          created_at: string
          exam_id: string
          id: string
          passed: boolean
          score: number
          submitted_at: string
          total_marks: number
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          exam_id: string
          id?: string
          passed?: boolean
          score?: number
          submitted_at?: string
          total_marks?: number
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          exam_id?: string
          id?: string
          passed?: boolean
          score?: number
          submitted_at?: string
          total_marks?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_batches: {
        Row: {
          allow_retakes: boolean
          batch_id: string
          created_at: string
          exam_id: string
        }
        Insert: {
          allow_retakes?: boolean
          batch_id: string
          created_at?: string
          exam_id: string
        }
        Update: {
          allow_retakes?: boolean
          batch_id?: string
          created_at?: string
          exam_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_batches_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          correct_index: number
          created_at: string
          display_order: number
          exam_id: string
          id: string
          marks: number
          options: Json
          question_text: string
          updated_at: string
        }
        Insert: {
          correct_index?: number
          created_at?: string
          display_order?: number
          exam_id: string
          id?: string
          marks?: number
          options?: Json
          question_text: string
          updated_at?: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          display_order?: number
          exam_id?: string
          id?: string
          marks?: number
          options?: Json
          question_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          allow_retakes: boolean
          available_from: string | null
          available_until: string | null
          batch_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          id: string
          is_published: boolean
          pass_percentage: number
          title: string
          updated_at: string
        }
        Insert: {
          allow_retakes?: boolean
          available_from?: string | null
          available_until?: string | null
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_published?: boolean
          pass_percentage?: number
          title: string
          updated_at?: string
        }
        Update: {
          allow_retakes?: boolean
          available_from?: string | null
          available_until?: string | null
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_published?: boolean
          pass_percentage?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          background: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          phone: string | null
          source: string
          status: Database["public"]["Enums"]["inquiry_status"]
          student_id: string | null
          updated_at: string
        }
        Insert: {
          background?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          phone?: string | null
          source?: string
          status?: Database["public"]["Enums"]["inquiry_status"]
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          background?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          phone?: string | null
          source?: string
          status?: Database["public"]["Enums"]["inquiry_status"]
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      live_class_settings: {
        Row: {
          batch_id: string | null
          class_description: string | null
          class_title: string
          created_at: string
          duration_minutes: number
          enabled: boolean
          id: string
          last_reminder_sent_for: string | null
          meet_link: string
          next_class_at: string | null
          recurrence_days: number[]
          recurrence_enabled: boolean
          recurrence_time: string
          reminder_minutes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          batch_id?: string | null
          class_description?: string | null
          class_title?: string
          created_at?: string
          duration_minutes?: number
          enabled?: boolean
          id?: string
          last_reminder_sent_for?: string | null
          meet_link?: string
          next_class_at?: string | null
          recurrence_days?: number[]
          recurrence_enabled?: boolean
          recurrence_time?: string
          reminder_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          batch_id?: string | null
          class_description?: string | null
          class_title?: string
          created_at?: string
          duration_minutes?: number
          enabled?: boolean
          id?: string
          last_reminder_sent_for?: string | null
          meet_link?: string
          next_class_at?: string | null
          recurrence_days?: number[]
          recurrence_enabled?: boolean
          recurrence_time?: string
          reminder_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_class_settings_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          conversation_key: string
          created_at: string
          direction: string
          external_message_id: string | null
          id: string
          is_read: boolean
          message_type: string
          platform: string
          raw_payload: Json | null
          sender_id: string | null
          sender_name: string | null
          text: string | null
        }
        Insert: {
          attachments?: Json | null
          conversation_key: string
          created_at?: string
          direction: string
          external_message_id?: string | null
          id?: string
          is_read?: boolean
          message_type?: string
          platform: string
          raw_payload?: Json | null
          sender_id?: string | null
          sender_name?: string | null
          text?: string | null
        }
        Update: {
          attachments?: Json | null
          conversation_key?: string
          created_at?: string
          direction?: string
          external_message_id?: string | null
          id?: string
          is_read?: boolean
          message_type?: string
          platform?: string
          raw_payload?: Json | null
          sender_id?: string | null
          sender_name?: string | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_key_fkey"
            columns: ["conversation_key"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["conversation_key"]
          },
        ]
      }
      module_batches: {
        Row: {
          batch_id: string
          created_at: string
          module_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          module_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_batches_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_versions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          file_path: string | null
          id: string
          module_id: string
          notes: string | null
          slide_count: number
          title: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          module_id: string
          notes?: string | null
          slide_count?: number
          title: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          module_id?: string
          notes?: string | null
          slide_count?: number
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "module_versions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          installment_number: number
          payment_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          proof_url: string | null
          receipt_url: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          transaction_reference: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          id?: string
          installment_number?: number
          payment_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          proof_url?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          installment_number?: number
          payment_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          proof_url?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_credentials: {
        Row: {
          app_secret: string | null
          id: string
          page_access_token: string | null
          updated_at: string
          updated_by: string | null
          verify_token: string | null
          whatsapp_phone_id: string | null
          whatsapp_token: string | null
        }
        Insert: {
          app_secret?: string | null
          id?: string
          page_access_token?: string | null
          updated_at?: string
          updated_by?: string | null
          verify_token?: string | null
          whatsapp_phone_id?: string | null
          whatsapp_token?: string | null
        }
        Update: {
          app_secret?: string | null
          id?: string
          page_access_token?: string | null
          updated_at?: string
          updated_by?: string | null
          verify_token?: string | null
          whatsapp_phone_id?: string | null
          whatsapp_token?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          background: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          background?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          background?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          inquiry_id: string | null
          message: string
          provider_response: Json | null
          recipient_name: string | null
          recipient_phone: string
          sent_by: string | null
          status: string
          student_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          inquiry_id?: string | null
          message: string
          provider_response?: Json | null
          recipient_name?: string | null
          recipient_phone: string
          sent_by?: string | null
          status?: string
          student_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          inquiry_id?: string | null
          message?: string
          provider_response?: Json | null
          recipient_name?: string | null
          recipient_phone?: string
          sent_by?: string | null
          status?: string
          student_id?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          background: string | null
          batch_id: string | null
          created_at: string
          custom_fee: number | null
          email: string
          full_name: string
          id: string
          notes: string | null
          payment_plan: string
          phone: string | null
          profile_id: string | null
          sponsor_organization: string | null
          status: Database["public"]["Enums"]["student_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          background?: string | null
          batch_id?: string | null
          created_at?: string
          custom_fee?: number | null
          email: string
          full_name: string
          id?: string
          notes?: string | null
          payment_plan?: string
          phone?: string | null
          profile_id?: string | null
          sponsor_organization?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          background?: string | null
          batch_id?: string | null
          created_at?: string
          custom_fee?: number | null
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          payment_plan?: string
          phone?: string | null
          profile_id?: string | null
          sponsor_organization?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      video_access_logs: {
        Row: {
          id: string
          opened_at: string
          user_agent: string | null
          user_id: string
          video_id: string
        }
        Insert: {
          id?: string
          opened_at?: string
          user_agent?: string | null
          user_id: string
          video_id: string
        }
        Update: {
          id?: string
          opened_at?: string
          user_agent?: string | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_access_logs_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "video_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      video_batches: {
        Row: {
          batch_id: string
          created_at: string
          video_material_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          video_material_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          video_material_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_batches_video_material_id_fkey"
            columns: ["video_material_id"]
            isOneToOne: false
            referencedRelation: "video_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      video_materials: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          drive_file_id: string
          duration_minutes: number | null
          id: string
          is_published: boolean
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          drive_file_id: string
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          drive_file_id?: string
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      video_terms_acknowledgments: {
        Row: {
          acknowledged_at: string
          id: string
          terms_version: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          terms_version?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_exam: { Args: { _exam_id: string }; Returns: boolean }
      can_retake_exam: { Args: { _exam_id: string }; Returns: boolean }
      get_exam_questions: {
        Args: { _exam_id: string }
        Returns: {
          display_order: number
          id: string
          marks: number
          options: Json
          question_text: string
        }[]
      }
      get_exam_review: {
        Args: { _exam_id: string }
        Returns: {
          correct_index: number
          display_order: number
          id: string
          marks: number
          options: Json
          question_text: string
        }[]
      }
      has_admin_section: {
        Args: {
          _section: Database["public"]["Enums"]["admin_section"]
          _user_id: string
        }
        Returns: boolean
      }
      has_full_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_paid_student: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      student_batch_id: { Args: { _user_id: string }; Returns: string }
      submit_exam_attempt: {
        Args: { _answers: Json; _exam_id: string }
        Returns: {
          passed: boolean
          score: number
          total_marks: number
        }[]
      }
    }
    Enums: {
      admin_section:
        | "dashboard"
        | "inbox"
        | "students"
        | "inquiries"
        | "payments"
        | "batches"
        | "live_class"
        | "modules"
        | "video_materials"
        | "my_courses"
        | "announcements"
        | "reports"
        | "integrations"
        | "team"
        | "exams"
        | "certificates"
      app_role: "admin" | "student"
      inquiry_status: "new" | "contacted" | "converted" | "dropped"
      payment_method: "bank_transfer" | "fonepay" | "ips"
      payment_status:
        | "pending_verification"
        | "verified"
        | "rejected"
        | "overdue"
      student_status:
        | "inquired"
        | "contacted"
        | "enrolled"
        | "payment_received"
        | "installment_2_due"
        | "fully_paid"
        | "active_student"
        | "completed"
        | "certified"
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
      admin_section: [
        "dashboard",
        "inbox",
        "students",
        "inquiries",
        "payments",
        "batches",
        "live_class",
        "modules",
        "video_materials",
        "my_courses",
        "announcements",
        "reports",
        "integrations",
        "team",
        "exams",
        "certificates",
      ],
      app_role: ["admin", "student"],
      inquiry_status: ["new", "contacted", "converted", "dropped"],
      payment_method: ["bank_transfer", "fonepay", "ips"],
      payment_status: [
        "pending_verification",
        "verified",
        "rejected",
        "overdue",
      ],
      student_status: [
        "inquired",
        "contacted",
        "enrolled",
        "payment_received",
        "installment_2_due",
        "fully_paid",
        "active_student",
        "completed",
        "certified",
      ],
    },
  },
} as const
