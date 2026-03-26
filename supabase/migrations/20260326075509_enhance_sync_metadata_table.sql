/*
  # Enhance sync_metadata Table for Better Error Tracking

  1. New Columns
    - validation_errors: JSONB field to store detailed validation errors
    - retry_count: Track number of retry attempts
    - last_successful_sync: Timestamp of the last successful completion
    - error_notified: Boolean flag to track if error notification was sent

  2. Purpose
    - Provides detailed error tracking for debugging
    - Enables retry monitoring and alerting
    - Separates last attempt from last success for better visibility
    - Prevents duplicate error notifications
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sync_metadata' AND column_name = 'validation_errors'
  ) THEN
    ALTER TABLE sync_metadata ADD COLUMN validation_errors JSONB DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sync_metadata' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE sync_metadata ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sync_metadata' AND column_name = 'last_successful_sync'
  ) THEN
    ALTER TABLE sync_metadata ADD COLUMN last_successful_sync TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sync_metadata' AND column_name = 'error_notified'
  ) THEN
    ALTER TABLE sync_metadata ADD COLUMN error_notified BOOLEAN DEFAULT FALSE;
  END IF;
END $$;
