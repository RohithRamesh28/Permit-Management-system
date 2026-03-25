/*
  # Create Licensing Cache Table

  1. New Tables
    - `licensing_cache`
      - `id` (uuid, primary key) - Unique identifier
      - `source_list` (text) - Which SharePoint list this came from (state_contractor, state_electrical, county_contractor, county_electrical)
      - `sp_item_id` (text) - Original SharePoint list item ID
      - `status` (text) - License status (Active, Pending, etc.)
      - `subsidiary` (text) - Performing entity/subsidiary name
      - `state` (text) - State name
      - `county_city_title` (text) - Full County/City title (county lists only, null for state)
      - `license_type` (text) - License type value
      - `classification` (text) - Classification field
      - `license_number` (text) - License number
      - `expiration_date` (timestamptz) - License expiration date
      - `qp_lookup_id` (text) - Raw lookup ID from SharePoint
      - `qp_name` (text) - Resolved QP name
      - `qp_email` (text) - Resolved QP email
      - `raw_fields` (jsonb) - Full raw SharePoint fields for debugging
      - `last_synced` (timestamptz) - Last sync timestamp
      - `created_at` (timestamptz) - Record creation timestamp

  2. Indexes
    - Index on source_list for fast filtering by list type
    - Index on subsidiary for subsidiary matching
    - Index on state for state filtering
    - Index on status for active/pending filtering
    - Index on county_city_title for county/city lookups
    - Unique index on (source_list, sp_item_id) for upsert operations

  3. Security
    - Enable RLS on licensing_cache table
    - Add policy for authenticated users to read (no user writes allowed)
*/

CREATE TABLE IF NOT EXISTS licensing_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_list text NOT NULL,
  sp_item_id text,
  status text,
  subsidiary text,
  state text,
  county_city_title text,
  license_type text,
  classification text,
  license_number text,
  expiration_date timestamptz,
  qp_lookup_id text,
  qp_name text,
  qp_email text,
  raw_fields jsonb,
  last_synced timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for fast cascade filtering
CREATE INDEX IF NOT EXISTS idx_licensing_cache_source ON licensing_cache(source_list);
CREATE INDEX IF NOT EXISTS idx_licensing_cache_subsidiary ON licensing_cache(subsidiary);
CREATE INDEX IF NOT EXISTS idx_licensing_cache_state ON licensing_cache(state);
CREATE INDEX IF NOT EXISTS idx_licensing_cache_status ON licensing_cache(status);
CREATE INDEX IF NOT EXISTS idx_licensing_cache_county_city ON licensing_cache(county_city_title);

-- Unique constraint to allow upsert on sync
CREATE UNIQUE INDEX IF NOT EXISTS idx_licensing_cache_sp_item
  ON licensing_cache(source_list, sp_item_id);

-- Enable RLS
ALTER TABLE licensing_cache ENABLE ROW LEVEL SECURITY;

-- Policy: read-only for all authenticated users, no user writes
CREATE POLICY "Allow authenticated read"
  ON licensing_cache FOR SELECT
  TO authenticated
  USING (true);
