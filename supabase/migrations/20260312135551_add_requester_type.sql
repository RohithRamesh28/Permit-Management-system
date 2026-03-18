/*
  # Add Requester Type Field

  1. Changes to permits table
    - `requester_type` (text) - Type of requester (e.g., Internal, External, Contractor, etc.)

  2. Notes
    - This field will store the type/category of the person requesting the permit
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'requester_type'
  ) THEN
    ALTER TABLE permits ADD COLUMN requester_type text;
  END IF;
END $$;