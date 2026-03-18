/*
  # Enable pg_cron and Schedule Automatic SharePoint Sync

  1. Extension Setup
    - Enable the pg_cron extension for scheduled job execution
  
  2. Scheduled Job Configuration
    - Create a cron job that runs every 2 hours
    - The job calls the sync-sharepoint-jobs edge function using pg_net
    - Runs automatically without any manual triggers
  
  3. Job Details
    - Job Name: sync_sharepoint_jobs_every_2h
    - Schedule: Every 2 hours
    - Action: HTTP POST to Supabase Edge Function
    - Uses service role key for authentication
  
  4. Notes
    - The edge function handles fetching all items from SharePoint
    - Upserts new/updated records into sharepoint_jobs_cache
    - Updates sync_metadata with status and timestamps
*/

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension (needed for HTTP requests from cron jobs)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule the job to run every 2 hours
SELECT cron.schedule(
  'sync_sharepoint_jobs_every_2h',
  '0 */2 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://jvsyugwllozxglydamgq.supabase.co/functions/v1/sync-sharepoint-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c3l1Z3dsbG96eGdseWRhbWdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzMxNDU5MCwiZXhwIjoyMDg4ODkwNTkwfQ.H3GZnOMpJQYC5L1CvePo-9P0bFzfNQkjOwywGIRNrNM'
    ),
    body := '{}'::jsonb
  );
  $$
);