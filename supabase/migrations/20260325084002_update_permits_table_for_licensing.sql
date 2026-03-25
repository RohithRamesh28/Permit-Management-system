/*
  # Update Permits Table for Licensing Integration

  1. New Columns
    - `qp_name` (text) - Qualified Person name from licensing cache
    - `qp_email` (text) - Qualified Person email from licensing cache
    - `license_list_used` (text) - Which SharePoint list was used for this permit
    - `matched_license_item_id` (text) - SharePoint item ID that matched
    - `permit_jurisdiction` (text) - Unified jurisdiction field (replaces separate city/county)

  2. Column Removal
    - Remove `city` column (consolidated into permit_jurisdiction)
    - Remove `county_or_parish` column (consolidated into permit_jurisdiction)

  3. Data Migration
    - Migrate existing data from city/county_or_parish to permit_jurisdiction before dropping columns
*/

-- Add new columns for licensing integration
ALTER TABLE permits
  ADD COLUMN IF NOT EXISTS qp_name text,
  ADD COLUMN IF NOT EXISTS qp_email text,
  ADD COLUMN IF NOT EXISTS license_list_used text,
  ADD COLUMN IF NOT EXISTS matched_license_item_id text,
  ADD COLUMN IF NOT EXISTS permit_jurisdiction text;

-- Migrate existing data to new unified jurisdiction field
UPDATE permits
SET permit_jurisdiction = CASE
  WHEN permit_jurisdiction_type = 'State' THEN state
  WHEN permit_jurisdiction_type = 'County/City' AND county_or_parish IS NOT NULL AND city IS NOT NULL 
    THEN city || ', ' || state
  WHEN permit_jurisdiction_type = 'County/City' AND county_or_parish IS NOT NULL 
    THEN county_or_parish || ', ' || state
  WHEN permit_jurisdiction_type = 'County/City' AND city IS NOT NULL 
    THEN city || ', ' || state
  ELSE state
END
WHERE permit_jurisdiction IS NULL;

-- Drop old separate city/county columns
ALTER TABLE permits
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS county_or_parish;
