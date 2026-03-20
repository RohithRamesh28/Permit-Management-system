/*
  # Add signature data URL column
  
  1. Changes
    - Add `signature_data_url` column to permits table to store the base64-encoded signature image
    - This allows us to embed signatures directly in PDFs without requiring external storage
  
  2. Notes
    - Column is nullable since not all permits will have signatures
    - Stores the signature as a data URL (base64-encoded PNG)
*/

ALTER TABLE permits
ADD COLUMN IF NOT EXISTS signature_data_url text;