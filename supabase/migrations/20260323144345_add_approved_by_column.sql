/*
  # Add approved_by column to permits table

  1. Changes
    - Add `approved_by` column to store the name of the person who approved the permit
    - This will capture the Microsoft account name for non-signature approvals
    - For signature approvals, this will match the signed_by field
  
  2. Notes
    - Column is nullable to support existing records
    - Will be populated for all future approvals
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE permits ADD COLUMN approved_by text;
  END IF;
END $$;
