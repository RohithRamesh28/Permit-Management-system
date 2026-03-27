import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ApprovalStage = 'draft' | 'awaiting_qp' | 'awaiting_approver' | 'rejected_by_qp' | 'rejected_by_approver' | 'approved' | 'closed';

export interface Permit {
  id: string;
  permit_id: string;
  requestor: string;
  requester_type?: string;
  requester_email?: string;
  ontivity_project_number: string;
  performing_entity: string;
  date_of_request: string;
  date_of_project_commencement: string;
  estimated_date_of_completion: string;
  type_of_permit: string;
  utility_provider?: string;
  state: string;
  county_or_parish: string;
  city: string;
  land_owner?: string;
  tower_owner: string;
  end_customer: string;
  project_value: number;
  actual_date_of_completion?: string;
  detailed_sow: string;
  current_stage: ApprovalStage;
  rejection_notes?: string;
  requires_signature: boolean;
  signature_image_url?: string;
  signed_by?: string;
  signed_at?: string;
  signed_pdf_url?: string;
  signed_document_url?: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
  permit_jurisdiction_type?: string;
  permit_jurisdiction?: string;
  qp_name?: string;
  qp_email?: string;
  license_list_used?: string;
  matched_license_item_id?: string;
  approver_name?: string;
  approver_email?: string;
  approver_manager_email?: string;
  approver_division_manager_email?: string;
  send_to_qp_for_signature?: boolean;
  send_to_approver_for_signature?: boolean;
  requestor_name?: string;
  send_to_qp?: boolean;
  is_qp_signature_required?: boolean;
  is_approver_signature_required?: boolean;
  qp_approved_at?: string;
  qp_approved_by?: string;
  qp_rejected_at?: string;
  qp_rejected_by?: string;
  qp_rejection_notes?: string;
  approver_approved_at?: string;
  approver_rejected_at?: string;
  approver_rejection_notes?: string;
  resubmission_count?: number;
  closed_at?: string;
  closed_by?: string;
  close_notes?: string;
}

export interface PermitDocument {
  id: string;
  permit_id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
  uploaded_after_approval?: boolean;
}

export interface PermitAuditLog {
  id: string;
  permit_id: string;
  action: string;
  performed_by: string;
  notes?: string;
  created_at: string;
}
