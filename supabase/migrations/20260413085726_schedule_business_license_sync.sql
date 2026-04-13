/*
  # Schedule Business License Sync Every 2 Hours

  1. New Cron Job
    - sync_all_business_licenses: Calls the sync-business-licenses edge function
    - Runs every 2 hours at minute 0
    - Matches the existing unified sync schedule cadence

  2. Details
    - Uses pg_cron and pg_net (extensions.http_post) to invoke the edge function
    - Authenticates with the service role key
    - Removes any existing job with the same name before creating
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync_all_business_licenses') THEN
    PERFORM cron.unschedule('sync_all_business_licenses');
  END IF;
END $$;

SELECT cron.schedule(
  'sync_all_business_licenses',
  '0 */2 * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/sync-business-licenses',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);