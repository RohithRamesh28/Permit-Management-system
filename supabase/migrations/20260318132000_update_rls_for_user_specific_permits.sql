/*
  # Update RLS Policies for User-Specific Permit Access

  1. Changes
    - Drop existing permissive policies on permits table
    - Add user_email column to permits (already exists as requester_email)
    - Create RLS policies:
      - Regular users can only see permits where requester_email matches their email
      - Admin user (atcautomation@Ontibity.com) can see all permits
    - Apply same logic to permit_documents and permit_audit_log tables
  
  2. Security
    - Users can only view/manage their own permits
    - Admin has full visibility
    - Maintains data privacy between users
*/

-- ============================================
-- UPDATE PERMITS TABLE POLICIES
-- ============================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow permit operations" ON permits;
DROP POLICY IF EXISTS "Allow all operations on permits" ON permits;

-- Create user-specific read policy
CREATE POLICY "Users can view their own permits"
ON permits FOR SELECT
TO public
USING (
  requester_email = current_setting('request.jwt.claims', true)::json->>'email'
  OR current_setting('request.jwt.claims', true)::json->>'email' = 'atcautomation@Ontibity.com'
);

-- Create user-specific insert policy
CREATE POLICY "Users can create their own permits"
ON permits FOR INSERT
TO public
WITH CHECK (
  requester_email = current_setting('request.jwt.claims', true)::json->>'email'
  OR current_setting('request.jwt.claims', true)::json->>'email' = 'atcautomation@Ontibity.com'
);

-- Create user-specific update policy
CREATE POLICY "Users can update their own permits"
ON permits FOR UPDATE
TO public
USING (
  requester_email = current_setting('request.jwt.claims', true)::json->>'email'
  OR current_setting('request.jwt.claims', true)::json->>'email' = 'atcautomation@Ontibity.com'
)
WITH CHECK (
  requester_email = current_setting('request.jwt.claims', true)::json->>'email'
  OR current_setting('request.jwt.claims', true)::json->>'email' = 'atcautomation@Ontibity.com'
);

-- Create user-specific delete policy
CREATE POLICY "Users can delete their own permits"
ON permits FOR DELETE
TO public
USING (
  requester_email = current_setting('request.jwt.claims', true)::json->>'email'
  OR current_setting('request.jwt.claims', true)::json->>'email' = 'atcautomation@Ontibity.com'
);

-- ============================================
-- UPDATE PERMIT_DOCUMENTS TABLE POLICIES
-- ============================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow document operations" ON permit_documents;
DROP POLICY IF EXISTS "Allow all operations on permit_documents" ON permit_documents;

-- Create user-specific read policy (through permits join)
CREATE POLICY "Users can view documents for their permits"
ON permit_documents FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM permits
    WHERE permits.id = permit_documents.permit_id
    AND (
      permits.requester_email = current_setting('request.jwt.claims', true)::json->>'email'
      OR current_setting('request.jwt.claims', true)::json->>'email' = 'atcautomation@Ontibity.com'
    )
  )
);

-- Create user-specific insert policy
CREATE POLICY "Users can upload documents to their permits"
ON permit_documents FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM permits
    WHERE permits.id = permit_documents.permit_id
    AND (
      permits.requester_email = current_setting('request.jwt.claims', true)::json->>'email'
      OR current_setting('request.jwt.claims', true)::json->>'email' = 'atcautomation@Ontibity.com'
    )
  )
);

-- Create user-specific update policy
CREATE POLICY "Users can update documents for their permits"
ON permit_documents FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM permits
    WHERE permits.id = permit_documents.permit_id
    AND (
      permits.requester_email = current_setting('request.jwt.claims', true)::json->>'email'
      OR current_setting('request.jwt.claims', true)::json->>'email' = 'atcautomation@Ontibity.com'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM permits
    WHERE permits.id = permit_documents.permit_id
    AND (
      permits.requester_email = current_setting('request.jwt.claims', true)::json->>'email'
      OR current_setting('request.jwt.claims', true)::json->>'email' = 'atcautomation@Ontibity.com'
    )
  )
);

-- Create user-specific delete policy
CREATE POLICY "Users can delete documents from their permits"
ON permit_documents FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM permits
    WHERE permits.id = permit_documents.permit_id
    AND (
      permits.requester_email = current_setting('request.jwt.claims', true)::json->>'email'
      OR current_setting('request.jwt.claims', true)::json->>'email' = 'atcautomation@Ontibity.com'
    )
  )
);

-- ============================================
-- UPDATE PERMIT_AUDIT_LOG TABLE POLICIES
-- ============================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow audit log operations" ON permit_audit_log;
DROP POLICY IF EXISTS "Allow all operations on permit_audit_log" ON permit_audit_log;

-- Create user-specific read policy (through permits join)
CREATE POLICY "Users can view audit logs for their permits"
ON permit_audit_log FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM permits
    WHERE permits.id = permit_audit_log.permit_id
    AND (
      permits.requester_email = current_setting('request.jwt.claims', true)::json->>'email'
      OR current_setting('request.jwt.claims', true)::json->>'email' = 'atcautomation@Ontibity.com'
    )
  )
);

-- Create user-specific insert policy
CREATE POLICY "Users can create audit logs for their permits"
ON permit_audit_log FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM permits
    WHERE permits.id = permit_audit_log.permit_id
    AND (
      permits.requester_email = current_setting('request.jwt.claims', true)::json->>'email'
      OR current_setting('request.jwt.claims', true)::json->>'email' = 'atcautomation@Ontibity.com'
    )
  )
);

-- Create user-specific update policy
CREATE POLICY "Users can update audit logs for their permits"
ON permit_audit_log FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM permits
    WHERE permits.id = permit_audit_log.permit_id
    AND (
      permits.requester_email = current_setting('request.jwt.claims', true)::json->>'email'
      OR current_setting('request.jwt.claims', true)::json->>'email' = 'atcautomation@Ontibity.com'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM permits
    WHERE permits.id = permit_audit_log.permit_id
    AND (
      permits.requester_email = current_setting('request.jwt.claims', true)::json->>'email'
      OR current_setting('request.jwt.claims', true)::json->>'email' = 'atcautomation@Ontibity.com'
    )
  )
);

-- Create user-specific delete policy
CREATE POLICY "Users can delete audit logs for their permits"
ON permit_audit_log FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM permits
    WHERE permits.id = permit_audit_log.permit_id
    AND (
      permits.requester_email = current_setting('request.jwt.claims', true)::json->>'email'
      OR current_setting('request.jwt.claims', true)::json->>'email' = 'atcautomation@Ontibity.com'
    )
  )
);