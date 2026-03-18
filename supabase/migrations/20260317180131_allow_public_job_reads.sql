/*
  # Allow public access to read job titles
  
  1. Changes
    - Add SELECT policy for anon role on sharepoint_jobs_cache
  
  2. Security
    - Job titles are not sensitive information
    - Allows dropdown to work without authentication
*/

-- Allow anyone to read job titles from cache
CREATE POLICY "Anyone can read job titles"
  ON sharepoint_jobs_cache
  FOR SELECT
  TO anon
  USING (true);
