/*
  # Add document tracking fields to permit_documents table

  1. Changes
    - Add `document_type` column to distinguish between document types:
      - 'general': Regular uploaded documents
      - 'to_sign': Document uploaded that needs signing
      - 'signed': The signed version of the document
    - Add `uploaded_after_approval` boolean to track post-approval uploads
    - Add `uploaded_at` timestamp with default value
  
  2. Purpose
    - Track which documents were uploaded before vs after permit approval
    - Enable filtering files for SharePoint sync (only send new post-approval files)
    - Distinguish between general documents and signature-required documents
  
  3. Notes
    - Existing records will default to 'general' document type
    - uploaded_after_approval defaults to false for existing records
    - uploaded_at defaults to current timestamp for existing records
*/

DO $$
BEGIN
  -- Add document_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permit_documents' AND column_name = 'document_type'
  ) THEN
    ALTER TABLE permit_documents 
    ADD COLUMN document_type text DEFAULT 'general' CHECK (document_type IN ('general', 'to_sign', 'signed'));
  END IF;

  -- Add uploaded_after_approval column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permit_documents' AND column_name = 'uploaded_after_approval'
  ) THEN
    ALTER TABLE permit_documents 
    ADD COLUMN uploaded_after_approval boolean DEFAULT false;
  END IF;

  -- Add uploaded_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permit_documents' AND column_name = 'uploaded_at'
  ) THEN
    ALTER TABLE permit_documents 
    ADD COLUMN uploaded_at timestamptz DEFAULT now();
  END IF;
END $$;
