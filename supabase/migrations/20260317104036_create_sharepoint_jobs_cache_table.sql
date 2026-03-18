/*
  # SharePoint Jobs Cache Table

  1. New Tables
    - `sharepoint_jobs_cache`
      - `id` (uuid, primary key) - Unique identifier
      - `job_title` (text) - Job title from SharePoint list
      - `sharepoint_id` (text, unique) - SharePoint item ID
      - `last_synced_at` (timestamptz) - When this record was last synced
      - `created_at` (timestamptz) - When this record was created
      - `updated_at` (timestamptz) - When this record was last updated

  2. Security
    - Enable RLS on `sharepoint_jobs_cache` table
    - Add policy for authenticated users to read all job data
    - Only system can write (edge function will use service role)

  3. Indexes
    - Index on `job_title` for fast searching
    - Index on `sharepoint_id` for lookups
*/

CREATE TABLE IF NOT EXISTS sharepoint_jobs_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title text NOT NULL,
  sharepoint_id text UNIQUE NOT NULL,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE sharepoint_jobs_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all jobs
CREATE POLICY "Authenticated users can read all jobs"
  ON sharepoint_jobs_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sharepoint_jobs_title ON sharepoint_jobs_cache(job_title);
CREATE INDEX IF NOT EXISTS idx_sharepoint_jobs_sp_id ON sharepoint_jobs_cache(sharepoint_id);
CREATE INDEX IF NOT EXISTS idx_sharepoint_jobs_synced ON sharepoint_jobs_cache(last_synced_at);
