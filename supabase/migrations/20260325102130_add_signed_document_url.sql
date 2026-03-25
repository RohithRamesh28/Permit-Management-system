/*
  # Add signed document URL to permits table

  1. Changes
    - Add `signed_document_url` column to store the URL of the uploaded document after it's been signed

  2. Security
    - No changes to RLS policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'signed_document_url'
  ) THEN
    ALTER TABLE permits ADD COLUMN signed_document_url text;
  END IF;
END $$;
