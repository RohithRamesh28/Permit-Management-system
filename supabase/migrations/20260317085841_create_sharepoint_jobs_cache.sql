/*
  # Create SharePoint Jobs Cache Table

  1. New Tables
    - `sharepoint_jobs`
      - `id` (uuid, primary key)
      - `title` (text, not null) - The job title from SharePoint "All Divisions Job List"
      - `synced_at` (timestamptz) - When this record was last synced
      - `created_at` (timestamptz) - When this record was first created

    - `sync_metadata`
      - `id` (uuid, primary key)
      - `sync_type` (text, unique) - Type of sync (e.g., 'sharepoint_jobs')
      - `last_synced_at` (timestamptz) - Last successful sync timestamp
      - `item_count` (integer) - Number of items synced
      - `status` (text) - Status of the last sync

  2. Security
    - Enable RLS on both tables
    - Allow anonymous read access to sharepoint_jobs for the permit form dropdown
    - Restrict writes to service role only

  3. Indexes
    - Trigram index on sharepoint_jobs.title for fast search
*/

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS sharepoint_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text UNIQUE NOT NULL,
  last_synced_at timestamptz DEFAULT now(),
  item_count integer DEFAULT 0,
  status text DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_sharepoint_jobs_title ON sharepoint_jobs USING gin (title gin_trgm_ops);

ALTER TABLE sharepoint_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sharepoint jobs"
  ON sharepoint_jobs
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Only service role can insert sharepoint jobs"
  ON sharepoint_jobs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Only service role can update sharepoint jobs"
  ON sharepoint_jobs
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Only service role can delete sharepoint jobs"
  ON sharepoint_jobs
  FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "Anyone can read sync metadata"
  ON sync_metadata
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Only service role can insert sync metadata"
  ON sync_metadata
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Only service role can update sync metadata"
  ON sync_metadata
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
