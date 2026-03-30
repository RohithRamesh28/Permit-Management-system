/*
  # Add updated_at Column to permit_documents Table

  1. Changes
    - Adds `updated_at` column to `permit_documents` table
    - Sets default value to `now()` for new records
    - Backfills existing rows with their `uploaded_at` value

  2. Purpose
    - Enables the existing `update_permit_documents_updated_at` trigger to function correctly
    - Fixes 400 Bad Request errors when updating document URLs during resubmit flow
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permit_documents' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE permit_documents ADD COLUMN updated_at timestamptz DEFAULT now();
    
    UPDATE permit_documents SET updated_at = uploaded_at WHERE updated_at IS NULL;
  END IF;
END $$;
