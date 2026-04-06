/*
  # Fix Permit Validity Date Format

  1. Changes
    - Converts `permit_validity` column from `date` type to `text` type
    - This allows storing dates in MM/DD/YYYY format without PostgreSQL automatic conversion
    - Preserves existing data by converting any YYYY-MM-DD dates to MM/DD/YYYY format

  2. Migration Steps
    - Convert existing date values to MM/DD/YYYY text format
    - Change column type from date to text
    - This ensures the user-entered MM/DD/YYYY format is preserved throughout the application

  3. Rationale
    - Application expects MM/DD/YYYY format for all date inputs and displays
    - PostgreSQL date type automatically converts to YYYY-MM-DD (ISO format)
    - Using text type maintains consistent formatting without conversion
*/

-- Convert existing permit_validity dates to MM/DD/YYYY format and change to text type
DO $$
BEGIN
  -- First, add a temporary text column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'permit_validity_temp'
  ) THEN
    ALTER TABLE permits ADD COLUMN permit_validity_temp text;
  END IF;

  -- Copy and convert existing date data to MM/DD/YYYY format
  UPDATE permits
  SET permit_validity_temp = TO_CHAR(permit_validity, 'MM/DD/YYYY')
  WHERE permit_validity IS NOT NULL;

  -- Drop the old date column
  ALTER TABLE permits DROP COLUMN IF EXISTS permit_validity;

  -- Rename the temp column to permit_validity
  ALTER TABLE permits RENAME COLUMN permit_validity_temp TO permit_validity;
END $$;
