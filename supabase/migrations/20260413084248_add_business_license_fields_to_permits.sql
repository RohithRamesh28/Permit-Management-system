/*
  # Add Business License Fields to Permits Table

  Adds two new columns to the permits table to track whether a permit
  is associated with a business license and store the selected license number.

  1. Modified Tables
    - `permits`
      - `is_business_license` (boolean, default false) - Whether user checked the business license checkbox
      - `business_license_number` (text, nullable) - The license number selected or manually entered

  2. Important Notes
    - Both columns are nullable/have defaults so existing permits are unaffected
    - No destructive changes to existing data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'is_business_license'
  ) THEN
    ALTER TABLE permits ADD COLUMN is_business_license boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'business_license_number'
  ) THEN
    ALTER TABLE permits ADD COLUMN business_license_number text;
  END IF;
END $$;
