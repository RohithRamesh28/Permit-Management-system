/*
  # Rename property_owner to land_owner and add tower_owner field

  1. Changes to `permits` table
    - Rename `property_owner` column to `land_owner`
    - Make `land_owner` nullable (optional field)
    - Add new `tower_owner` column as TEXT (mandatory field)
  
  2. Notes
    - The `land_owner` field will be labeled as "Land Owner (if applicable)" in the UI
    - The `tower_owner` field is required and will be enforced at the application level
*/

-- Rename property_owner to land_owner
ALTER TABLE permits
  RENAME COLUMN property_owner TO land_owner;

-- Make land_owner nullable (optional)
ALTER TABLE permits
  ALTER COLUMN land_owner DROP NOT NULL;

-- Add tower_owner column as mandatory field (NOT NULL with default for existing rows)
ALTER TABLE permits
  ADD COLUMN IF NOT EXISTS tower_owner TEXT;

-- For existing rows, set a default value
UPDATE permits SET tower_owner = '' WHERE tower_owner IS NULL;

-- Now make it NOT NULL
ALTER TABLE permits
  ALTER COLUMN tower_owner SET NOT NULL;
