/*
  # Allow Anonymous Read Access to Licensing Cache

  1. Changes
    - Add RLS policy to allow anonymous (unauthenticated) users to read from licensing_cache
    - This is needed because the permit form is accessible to all users (not just authenticated)
    - The licensing data is not sensitive and needs to be publicly readable

  2. Security
    - Read-only access (SELECT only)
    - No write access for anonymous users
    - Data is public information (license status, QP info) so this is safe
*/

-- Drop existing policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'licensing_cache'
    AND policyname = 'Allow anonymous read'
  ) THEN
    DROP POLICY "Allow anonymous read" ON licensing_cache;
  END IF;
END $$;

-- Allow anonymous users to read licensing cache data
CREATE POLICY "Allow anonymous read"
  ON licensing_cache FOR SELECT
  TO anon
  USING (true);
