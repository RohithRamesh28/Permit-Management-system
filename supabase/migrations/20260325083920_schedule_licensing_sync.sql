/*
  # Schedule Licensing Data Sync

  1. Scheduled Job
    - Sets up pg_cron job to run sync-licensing-data Edge Function every hour
    - Runs at the top of every hour (0 * * * *)
    - Uses service role key for authentication

  2. Implementation
    - Uses net.http_post to trigger Edge Function endpoint
    - Passes empty JSON body
    - Includes proper authentication headers
*/

SELECT cron.schedule(
  'sync-licensing-data',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/sync-licensing-data',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    )
  $$
);
