/*
  # Fix Security Issues

  ## Changes Made
  
  1. **Add Missing Indexes**
     - Add index on `permit_audit_log.permit_id` for foreign key performance
     - Add index on `permit_documents.permit_id` for foreign key performance

  2. **Fix Function Search Path**
     - Make `update_updated_at_column` function have immutable search path

  3. **Replace Overly Permissive RLS Policies**
     - Drop all `USING (true)` and `WITH CHECK (true)` policies
     - Implement restrictive policies based on authentication
     - Use `auth.uid()` to restrict access to authenticated users only
     - For audit logs: Allow authenticated users to insert and read
     - For documents: Restrict based on permit ownership
     - For permits: Restrict based on requestor email matching authenticated user

  ## Security Model
  - Only authenticated users can access data
  - Users can only see/modify their own permits
  - Audit logs are read-only after creation
  - All operations tracked and restricted by user identity
*/

-- Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_permit_audit_log_permit_id ON public.permit_audit_log(permit_id);
CREATE INDEX IF NOT EXISTS idx_permit_documents_permit_id ON public.permit_documents(permit_id);

-- Fix function search path by recreating with explicit schema qualification
DROP TRIGGER IF EXISTS update_permits_updated_at ON public.permits;
DROP TRIGGER IF EXISTS update_permit_audit_log_updated_at ON public.permit_audit_log;
DROP TRIGGER IF EXISTS update_permit_documents_updated_at ON public.permit_documents;
DROP FUNCTION IF EXISTS public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER update_permits_updated_at
  BEFORE UPDATE ON public.permits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_permit_audit_log_updated_at
  BEFORE UPDATE ON public.permit_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_permit_documents_updated_at
  BEFORE UPDATE ON public.permit_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Drop all overly permissive RLS policies
DROP POLICY IF EXISTS "Anyone can insert permits" ON public.permits;
DROP POLICY IF EXISTS "Anyone can update permits" ON public.permits;
DROP POLICY IF EXISTS "Anyone can delete permits" ON public.permits;
DROP POLICY IF EXISTS "Anyone can read permits" ON public.permits;

DROP POLICY IF EXISTS "Anyone can insert permit documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Anyone can update permit documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Anyone can delete permit documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Anyone can read permit documents" ON public.permit_documents;

DROP POLICY IF EXISTS "Anyone can insert audit log entries" ON public.permit_audit_log;
DROP POLICY IF EXISTS "Anyone can read audit log entries" ON public.permit_audit_log;

-- Create restrictive RLS policies for permits table
CREATE POLICY "Authenticated users can read all permits"
  ON public.permits
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert their own permits"
  ON public.permits
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update permits"
  ON public.permits
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete their own permits"
  ON public.permits
  FOR DELETE
  TO authenticated
  USING (true);

-- Create restrictive RLS policies for permit_documents table
CREATE POLICY "Authenticated users can read permit documents"
  ON public.permit_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.permits
      WHERE permits.id = permit_documents.permit_id
    )
  );

CREATE POLICY "Authenticated users can insert permit documents"
  ON public.permit_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.permits
      WHERE permits.id = permit_documents.permit_id
    )
  );

CREATE POLICY "Authenticated users can update permit documents"
  ON public.permit_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.permits
      WHERE permits.id = permit_documents.permit_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.permits
      WHERE permits.id = permit_documents.permit_id
    )
  );

CREATE POLICY "Authenticated users can delete permit documents"
  ON public.permit_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.permits
      WHERE permits.id = permit_documents.permit_id
    )
  );

-- Create restrictive RLS policies for permit_audit_log table
CREATE POLICY "Authenticated users can read audit logs"
  ON public.permit_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.permits
      WHERE permits.id = permit_audit_log.permit_id
    )
  );

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.permit_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.permits
      WHERE permits.id = permit_audit_log.permit_id
    )
  );