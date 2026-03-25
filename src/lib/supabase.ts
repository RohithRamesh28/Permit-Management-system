import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  property_owner: string;
  end_customer: string;
  project_value: number;
  actual_date_of_completion?: string;
  detailed_sow: string;
  status: 'Pending Approval' | 'Active' | 'Rejected' | 'Closed';
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
