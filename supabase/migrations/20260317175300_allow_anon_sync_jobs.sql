/*
  # Temporary policy to allow bulk sync of SharePoint jobs
  
  1. Changes
    - Add INSERT policy for anon role on sharepoint_jobs_cache
    - Add DELETE policy for anon role on sharepoint_jobs_cache
    - Add INSERT/UPDATE policy for anon role on sync_metadata
  
  2. Security
    - These are temporary policies for initial data load
    - Will be used by sync script only
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anon to delete jobs cache" ON sharepoint_jobs_cache;
DROP POLICY IF EXISTS "Allow anon to insert jobs cache" ON sharepoint_jobs_cache;
DROP POLICY IF EXISTS "Allow anon to read sync metadata" ON sync_metadata;
DROP POLICY IF EXISTS "Allow anon to upsert sync metadata" ON sync_metadata;
DROP POLICY IF EXISTS "Allow anon to update sync metadata" ON sync_metadata;

-- Allow anon to delete from jobs cache (for clearing old data)
CREATE POLICY "Allow anon to delete jobs cache"
  ON sharepoint_jobs_cache
  FOR DELETE
  TO anon
  USING (true);

-- Allow anon to insert into jobs cache
CREATE POLICY "Allow anon to insert jobs cache"
  ON sharepoint_jobs_cache
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to read sync metadata
CREATE POLICY "Allow anon to read sync metadata"
  ON sync_metadata
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon to upsert sync metadata
CREATE POLICY "Allow anon to upsert sync metadata"
  ON sync_metadata
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon to update sync metadata"
  ON sync_metadata
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
