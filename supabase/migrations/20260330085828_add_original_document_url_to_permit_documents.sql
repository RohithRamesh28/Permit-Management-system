/*
  # Add Original Document URL to Permit Documents

  1. Changes
    - Adds `original_document_url` column to `permit_documents` table
    - This column stores the URL of the original unsigned PDF backup
    - Used to restore the original document when a permit is rejected

  2. Purpose
    - When a permit is rejected (by QP or Approver), the original unsigned PDF needs to be restored
    - This column keeps the original document tightly linked to the working document record
    - Ensures the original can always be restored regardless of how many times the document was signed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permit_documents' AND column_name = 'original_document_url'
  ) THEN
    ALTER TABLE permit_documents ADD COLUMN original_document_url text;
  END IF;
END $$;

COMMENT ON COLUMN permit_documents.original_document_url IS 'URL of the original unsigned document backup, used for restoration on rejection';