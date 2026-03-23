/*
  # Create User Management Table
  
  1. New Tables
    - `user_management`
      - `id` (integer, primary key) - SharePoint item ID
      - `title` (text) - Title field
      - `employee_first_name` (text) - Employee's first name
      - `employee_last_name` (text) - Employee's last name
      - `business_email` (text, indexed) - Employee's email (used for login matching)
      - `manager_display_name` (text) - Manager's full name
      - `manager_electronic_address` (text) - Manager's email address (QP field)
      - `location_description` (text) - Location/office description
      - `job_assignment_name` (text) - Job assignment/title
      - `division_manager_escalation` (text) - Division manager/escalation contact
      - `created` (timestamptz) - SharePoint created date
      - `modified` (timestamptz) - SharePoint modified date
      - `synced_at` (timestamptz) - Last sync timestamp
      
  2. Security
    - Enable RLS on `user_management` table
    - Allow public read access (needed for QP lookup during permit creation)
    
  3. Indexes
    - Index on business_email for fast lookups
*/

CREATE TABLE IF NOT EXISTS user_management (
  id integer PRIMARY KEY,
  title text,
  employee_first_name text,
  employee_last_name text,
  business_email text,
  manager_display_name text,
  manager_electronic_address text,
  location_description text,
  job_assignment_name text,
  division_manager_escalation text,
  created timestamptz,
  modified timestamptz,
  synced_at timestamptz DEFAULT now()
);

-- Create index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_user_management_business_email 
  ON user_management(business_email);

-- Enable RLS
ALTER TABLE user_management ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read user management data (needed for QP lookups)
CREATE POLICY "Allow public read access to user management"
  ON user_management
  FOR SELECT
  TO anon, authenticated
  USING (true);