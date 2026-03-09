import type { Pool } from 'pg';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── DB row types ─────────────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  site_id: string;
  clerk_id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  notification_prefs: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  site_id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  internal_identifier: string | null;
  referral_source_id: string | null;
  referral_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Trial {
  id: string;
  site_id: string;
  name: string;
  protocol_number: string | null;
  specialty: string | null;
  recruiting_status: string;
  description: string | null;
  inclusion_criteria: string | null;
  exclusion_criteria: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScreeningCase {
  id: string;
  site_id: string;
  patient_id: string;
  trial_id: string;
  status: string;
  assigned_user_id: string | null;
  fail_reason_id: string | null;
  fail_reason_text: string | null;
  what_would_change_text: string | null;
  revisit_date: string | null;
  next_action_date: string | null;
  last_touched_at: string;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  site_id: string;
  user_id: string;
  title: string;
  content: string;
  color: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReferralSource {
  id: string;
  site_id: string;
  name: string;
  type: string;
  contact_info: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ScreenFailReason {
  id: string;
  site_id: string;
  specialty: string | null;
  code: string;
  label: string;
  explanation_template: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignalType {
  id: string;
  site_id: string;
  name: string;
  label: string;
  value_type: 'NUMBER' | 'TEXT' | 'ENUM';
  unit: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientSignal {
  id: string;
  site_id: string;
  patient_id: string;
  signal_type_id: string;
  value_number: number | null;
  value_text: string | null;
  value_enum: string | null;
  collected_at: string;
  source: string | null;
  entered_by_user_id: string;
  created_at: string;
}

export interface PendingItem {
  id: string;
  site_id: string;
  screening_case_id: string;
  type: string;
  name: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationEvent {
  id: string;
  site_id: string;
  type: string;
  patient_id: string | null;
  screening_case_id: string | null;
  payload: string;
  dedup_key: string;
  processed_at: string | null;
  created_at: string;
}

export interface PatientDocument {
  id: string;
  site_id: string;
  patient_id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  document_type: string;
  notes: string | null;
  uploaded_by_user_id: string;
  created_at: string;
}

export interface TrialProtocol {
  id: string;
  site_id: string;
  trial_id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  version: string | null;
  uploaded_by_user_id: string;
  created_at: string;
}

export interface TrialSignalRule {
  id: string;
  site_id: string;
  trial_id: string;
  signal_type_id: string;
  operator: string;
  threshold_number: number | null;
  threshold_text: string | null;
  threshold_list: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VisitTemplate {
  id: string;
  site_id: string;
  trial_id: string;
  visit_name: string;
  day_offset: number;
  window_before: number;
  window_after: number;
  reminder_days_before: number;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

export interface PatientVisit {
  id: string;
  site_id: string;
  screening_case_id: string;
  visit_template_id: string;
  scheduled_date: string;
  actual_date: string | null;
  status: string;
  notes: string | null;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

// ── Express augmentation ──────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Locals {
      db: Pool;
      supabase: SupabaseClient;
    }
    interface Request {
      user: DbUser;
    }
  }
}

export type AuditLogParams = {
  siteId: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  diff?: Record<string, unknown>;
};
