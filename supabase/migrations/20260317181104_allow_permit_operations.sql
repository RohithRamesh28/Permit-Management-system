/*
  # Allow permit operations for users
  
  1. Changes
    - Add INSERT policy for authenticated and anon users on permits table
    - Add SELECT policy for authenticated and anon users to read permits
    - Add UPDATE policy for authenticated users to update permits
  
  2. Security
    - Users can create new permits
    - Users can read all permits (for admin dashboard)
    - Users can update permits
*/

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can create permits" ON permits;
  DROP POLICY IF EXISTS "Anyone can read permits" ON permits;
  DROP POLICY IF EXISTS "Authenticated users can update permits" ON permits;
  DROP POLICY IF EXISTS "Anyone can insert permit documents" ON permit_documents;
  DROP POLICY IF EXISTS "Anyone can read permit documents" ON permit_documents;
  DROP POLICY IF EXISTS "Anyone can insert audit logs" ON permit_audit_log;
  DROP POLICY IF EXISTS "Anyone can read audit logs" ON permit_audit_log;
END $$;

-- Allow anyone to insert new permits
CREATE POLICY "Anyone can create permits"
  ON permits
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Allow anyone to read permits
CREATE POLICY "Anyone can read permits"
  ON permits
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Allow authenticated users to update permits
CREATE POLICY "Authenticated users can update permits"
  ON permits
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow permit document operations
CREATE POLICY "Anyone can insert permit documents"
  ON permit_documents
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read permit documents"
  ON permit_documents
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Allow permit audit log operations
CREATE POLICY "Anyone can insert audit logs"
  ON permit_audit_log
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read audit logs"
  ON permit_audit_log
  FOR SELECT
  TO authenticated, anon
  USING (true);
