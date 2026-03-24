/*
  # Add Permit Jurisdiction Type Field

  1. Changes
    - Add `permit_jurisdiction_type` column to `permits` table
      - Type: text
      - Default: 'State'
      - Values: 'State' or 'County/City'
    - Make `county_or_parish` column nullable
    - Make `city` column nullable
  
  2. Purpose
    - Allow users to specify if permit is for State or County/City jurisdiction
    - When State jurisdiction is selected, county and city fields are not required
    - Default to State jurisdiction for new permits
  
  3. Notes
    - Existing permits will default to 'State' jurisdiction type
    - County and city fields remain in database but become optional
    - Form validation will enforce requirements based on jurisdiction type
*/

-- Add permit_jurisdiction_type column with default value
ALTER TABLE permits 
ADD COLUMN IF NOT EXISTS permit_jurisdiction_type text DEFAULT 'State';

-- Make county_or_parish nullable
DO $$
BEGIN
  ALTER TABLE permits 
  ALTER COLUMN county_or_parish DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Make city nullable
DO $$
BEGIN
  ALTER TABLE permits 
  ALTER COLUMN city DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;