/*
  # Final Security Cleanup - Remove All Insecure Policies

  ## Overview
  This migration performs a complete cleanup of all RLS policies to eliminate
  security vulnerabilities. It removes ALL existing policies (including duplicates)
  and creates a single set of secure policies.

  ## Security Issues Addressed
  1. ✅ Foreign key indexes (already added in previous migrations)
  2. ✅ Function search path (already fixed in previous migrations)
  3. ✅ Remove ALL policies with `USING (true)` that don't require authentication
  4. ✅ Implement proper authentication-based restrictions

  ## New Security Model
  - Service role: Full access (for backend operations with Azure AD)
  - No anon or public access
  - Application will use service role key secured by Azure AD authentication

  ## Changes Made
  ### Permits Table
  - Remove all 7+ existing policies (including duplicates)
  - Add single service role policy

  ### Permit Documents Table
  - Remove all 5+ existing policies (including duplicates)  
  - Add single service role policy

  ### Permit Audit Log Table
  - Remove all 3+ existing policies (including duplicates)
  - Add single service role policy
*/

-- ============================================================================
-- STEP 1: Drop ALL existing policies (including all duplicates)
-- ============================================================================

-- Drop ALL permits policies
DROP POLICY IF EXISTS "Anyone can view permits" ON public.permits;
DROP POLICY IF EXISTS "Anyone can insert permits" ON public.permits;
DROP POLICY IF EXISTS "Anyone can update permits" ON public.permits;
DROP POLICY IF EXISTS "Anyone can delete permits" ON public.permits;
DROP POLICY IF EXISTS "Anyone can read permits" ON public.permits;
DROP POLICY IF EXISTS "Authenticated users can view permits" ON public.permits;
DROP POLICY IF EXISTS "Authenticated users can create permits" ON public.permits;
DROP POLICY IF EXISTS "Authenticated users can edit permits" ON public.permits;
DROP POLICY IF EXISTS "Authenticated users can remove permits" ON public.permits;
DROP POLICY IF EXISTS "Authenticated users can insert their own permits" ON public.permits;
DROP POLICY IF EXISTS "Authenticated users can update permits" ON public.permits;
DROP POLICY IF EXISTS "Authenticated users can delete their own permits" ON public.permits;
DROP POLICY IF EXISTS "Authenticated users can read all permits" ON public.permits;
DROP POLICY IF EXISTS "Service role full access to permits" ON public.permits;

-- Drop ALL permit_documents policies
DROP POLICY IF EXISTS "Anyone can view permit documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Anyone can insert permit documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Anyone can update permit documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Anyone can delete permit documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Anyone can read permit documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Authenticated users can modify documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Authenticated users can remove documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Authenticated users can insert permit documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Authenticated users can update permit documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Authenticated users can delete permit documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Authenticated users can read permit documents" ON public.permit_documents;
DROP POLICY IF EXISTS "Service role full access to permit documents" ON public.permit_documents;

-- Drop ALL permit_audit_log policies
DROP POLICY IF EXISTS "Anyone can view audit log" ON public.permit_audit_log;
DROP POLICY IF EXISTS "Anyone can insert audit log entries" ON public.permit_audit_log;
DROP POLICY IF EXISTS "Anyone can read audit log entries" ON public.permit_audit_log;
DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON public.permit_audit_log;
DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON public.permit_audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.permit_audit_log;
DROP POLICY IF EXISTS "Authenticated users can read audit logs" ON public.permit_audit_log;
DROP POLICY IF EXISTS "Service role full access to audit log" ON public.permit_audit_log;

-- ============================================================================
-- STEP 2: Create single secure policy per table (service role only)
-- ============================================================================

-- Service role has full access to permits
-- Application backend uses service role with Azure AD authentication
CREATE POLICY "Service role manages permits"
  ON public.permits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role has full access to permit documents  
CREATE POLICY "Service role manages documents"
  ON public.permit_documents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role has full access to audit log
CREATE POLICY "Service role manages audit log"
  ON public.permit_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);