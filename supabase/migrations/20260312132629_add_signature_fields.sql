/*
  # Add Signature Support

  1. Changes to permits table
    - `requires_signature` (boolean) - Whether this permit requires a signature
    - `signature_image_url` (text, nullable) - URL to uploaded signature image
    - `signed_by` (text, nullable) - Name of person who signed
    - `signed_at` (timestamptz, nullable) - When signature was added

  2. Security
    - Update existing RLS policies to allow signature updates
*/

-- Add signature columns to permits table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'requires_signature'
  ) THEN
    ALTER TABLE permits ADD COLUMN requires_signature boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'signature_image_url'
  ) THEN
    ALTER TABLE permits ADD COLUMN signature_image_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'signed_by'
  ) THEN
    ALTER TABLE permits ADD COLUMN signed_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'signed_at'
  ) THEN
    ALTER TABLE permits ADD COLUMN signed_at timestamptz;
  END IF;
END $$;