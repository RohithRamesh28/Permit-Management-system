/*
  # Create Business License Cache Table

  This table caches data from the SharePoint "County & City Level Business Licenses" list
  on the OntivityLicensing site. It is used to look up business license numbers when a
  user checks the "Is this a Business License?" checkbox on the permit form.

  1. New Tables
    - `business_license_cache`
      - `id` (uuid, primary key) - Unique identifier
      - `sp_item_id` (text, not null) - SharePoint list item ID (unique for upsert)
      - `status` (text) - License status (Active, Pending, etc.)
      - `subsidiary` (text) - Performing entity / subsidiary name
      - `state` (text) - State name
      - `county_city_title` (text) - Full County/City title (e.g., "City of Chickasaw")
      - `license_type` (text) - License type value (e.g., "Business License")
      - `classification` (text) - Classification field
      - `license_number` (text) - The actual license number
      - `expiration_date` (timestamptz) - License expiration date
      - `qp_lookup_id` (text) - Raw QP lookup ID from SharePoint
      - `qp_name` (text) - Resolved qualifying party name
      - `qp_email` (text) - Resolved qualifying party email
      - `raw_fields` (jsonb) - Full raw SharePoint fields for debugging
      - `last_synced` (timestamptz) - Last sync timestamp
      - `created_at` (timestamptz) - Record creation timestamp

  2. Indexes
    - Index on subsidiary for subsidiary matching
    - Index on state for state filtering
    - Index on status for active/pending filtering
    - Index on county_city_title for county/city lookups
    - Unique index on sp_item_id for upsert operations

  3. Security
    - Enable RLS on business_license_cache table
    - Add read-only policy for authenticated users
    - Add read-only policy for anonymous users (form is publicly accessible)
*/

CREATE TABLE IF NOT EXISTS business_license_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sp_item_id text NOT NULL,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_license_cache_sp_item
  ON business_license_cache(sp_item_id);

CREATE INDEX IF NOT EXISTS idx_business_license_cache_subsidiary
  ON business_license_cache(subsidiary);

CREATE INDEX IF NOT EXISTS idx_business_license_cache_state
  ON business_license_cache(state);

CREATE INDEX IF NOT EXISTS idx_business_license_cache_status
  ON business_license_cache(status);

CREATE INDEX IF NOT EXISTS idx_business_license_cache_county_city
  ON business_license_cache(county_city_title);

ALTER TABLE business_license_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read business licenses"
  ON business_license_cache FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anonymous users can read business licenses"
  ON business_license_cache FOR SELECT
  TO anon
  USING (true);
