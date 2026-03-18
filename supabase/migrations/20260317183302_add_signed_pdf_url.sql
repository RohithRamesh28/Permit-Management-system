/*
  # Add signed PDF URL to permits table

  1. Changes
    - Add `signed_pdf_url` column to permits table to store the URL of the signed PDF document
    - This will be populated when a permit is approved with a signature
  
  2. Notes
    - Column is nullable since not all permits will have signed PDFs (only approved ones with signatures)
*/

ALTER TABLE permits
ADD COLUMN IF NOT EXISTS signed_pdf_url text;