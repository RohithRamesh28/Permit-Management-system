/*
  # Add Permit Validity Field

  1. Changes
    - Adds `permit_validity` column to the `permits` table
    - This is an optional date field to track permit expiration/validity date
    - Positioned logically after actual_date_of_completion in the permit workflow

  2. Column Details
    - `permit_validity` (date, nullable) - The date until which the permit is valid
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'permit_validity'
  ) THEN
    ALTER TABLE permits ADD COLUMN permit_validity date;
  END IF;
END $$;