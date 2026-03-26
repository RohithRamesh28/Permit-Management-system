/*
  # Unified Sync Schedule - All Functions Run Every 2 Hours Simultaneously

  1. Schedule Update
    - Removes old cron jobs for licensing sync (hourly schedule)
    - Updates all three sync functions to run every 2 hours at the same time
    - Schedule: Every 2 hours at minute 0 (12:00 AM, 2:00 AM, 4:00 AM, etc.)

  2. Sync Functions Scheduled
    - sync-sharepoint-jobs: Updates job cache
    - sync-licensing-data: Updates licensing cache
    - sync-user-management: Updates user management data

  3. Error Handling
    - All functions now include validation checks
    - Failures trigger email notifications to Rohith@katprotech.com
    - Old data is preserved if sync fails (no deletion on error)

  4. Validation Features
    - Minimum record count checks
    - Required field validation
    - Zero-record detection
    - Automatic retry on next scheduled run
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-licensing-data') THEN
    PERFORM cron.unschedule('sync-licensing-data');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync_sharepoint_jobs_every_2h') THEN
    PERFORM cron.unschedule('sync_sharepoint_jobs_every_2h');
  END IF;
END $$;

SELECT cron.schedule(
  'sync_all_sharepoint_jobs',
  '0 */2 * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/sync-sharepoint-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'sync_all_licensing_data',
  '0 */2 * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/sync-licensing-data',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'sync_all_user_management',
  '0 */2 * * *',
  $$
  SELECT extensions.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/sync-user-management',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
