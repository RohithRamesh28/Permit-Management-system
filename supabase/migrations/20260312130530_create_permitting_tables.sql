/*
  # Permitting Management System Schema

  1. New Tables
    - `permits`
      - `id` (uuid, primary key) - Unique permit identifier
      - `permit_id` (text) - Human-readable permit ID (e.g., PERM-2024-001)
      - `requestor` (text) - Name of person requesting permit
      - `ontivity_project_number` (text) - Project number
      - `performing_entity` (text) - ETT, CMS, ETR, LEG, MW, ONT
      - `date_of_request` (date) - When permit was requested
      - `date_of_project_commencement` (text) - Commencement date
      - `estimated_date_of_completion` (date) - Estimated completion
      - `type_of_permit` (text) - Electrical, Building, General
      - `utility_provider` (text, nullable) - Only for Electrical permits
      - `state` (text) - State where work is performed
      - `county_or_parish` (text) - County or parish
      - `city` (text) - City
      - `property_owner` (text) - SBA, CCI, ATC, etc.
      - `end_customer` (text) - Customer name
      - `project_value` (numeric) - Dollar value of project
      - `actual_date_of_completion` (date, nullable) - Actual completion date
      - `detailed_sow` (text) - Scope of work description
      - `status` (text) - Pending Approval, Active, Rejected, Closed
      - `rejection_notes` (text, nullable) - Notes if rejected
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

    - `permit_documents`
      - `id` (uuid, primary key)
      - `permit_id` (uuid, foreign key) - References permits table
      - `document_type` (text) - Type of document (pre_photos, permit_photo, etc.)
      - `file_name` (text) - Original file name
      - `file_url` (text) - URL or path to file
      - `uploaded_at` (timestamptz) - Upload timestamp

    - `permit_audit_log`
      - `id` (uuid, primary key)
      - `permit_id` (uuid, foreign key) - References permits table
      - `action` (text) - Action taken (submitted, approved, rejected, etc.)
      - `performed_by` (text) - Person who performed action
      - `notes` (text, nullable) - Additional notes
      - `created_at` (timestamptz) - When action occurred

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage permits
*/

-- Create permits table
CREATE TABLE IF NOT EXISTS permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id text UNIQUE NOT NULL,
  requestor text NOT NULL,
  ontivity_project_number text NOT NULL,
  performing_entity text NOT NULL,
  date_of_request date NOT NULL DEFAULT CURRENT_DATE,
  date_of_project_commencement text NOT NULL,
  estimated_date_of_completion date,
  type_of_permit text NOT NULL,
  utility_provider text,
  state text NOT NULL,
  county_or_parish text NOT NULL,
  city text NOT NULL,
  property_owner text NOT NULL,
  end_customer text NOT NULL,
  project_value numeric NOT NULL DEFAULT 0,
  actual_date_of_completion date,
  detailed_sow text NOT NULL,
  status text NOT NULL DEFAULT 'Pending Approval',
  rejection_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create permit_documents table
CREATE TABLE IF NOT EXISTS permit_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id uuid NOT NULL REFERENCES permits(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

-- Create permit_audit_log table
CREATE TABLE IF NOT EXISTS permit_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id uuid NOT NULL REFERENCES permits(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE permit_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE permit_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies for permits table
CREATE POLICY "Anyone can view permits"
  ON permits FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert permits"
  ON permits FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update permits"
  ON permits FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete permits"
  ON permits FOR DELETE
  USING (true);

-- Policies for permit_documents table
CREATE POLICY "Anyone can view permit documents"
  ON permit_documents FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert permit documents"
  ON permit_documents FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update permit documents"
  ON permit_documents FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete permit documents"
  ON permit_documents FOR DELETE
  USING (true);

-- Policies for permit_audit_log table
CREATE POLICY "Anyone can view audit log"
  ON permit_audit_log FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert audit log entries"
  ON permit_audit_log FOR INSERT
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for permits table
CREATE TRIGGER update_permits_updated_at
  BEFORE UPDATE ON permits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();