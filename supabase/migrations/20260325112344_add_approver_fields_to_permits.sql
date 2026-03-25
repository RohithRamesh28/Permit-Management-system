/*
  # Add Approver Fields to Permits Table

  1. Changes
    - Add `approver_name` (text) - Full name of the selected approver (First + Last)
    - Add `approver_email` (text) - Business email of the approver
    - Add `approver_manager_email` (text) - Manager's electronic address
    - Add `approver_division_manager_email` (text) - Division manager escalation email
  
  2. Notes
    - These fields store the approver selection information from the user_management table
    - The approver_name is displayed to users, while emails are used for notifications
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'approver_name'
  ) THEN
    ALTER TABLE permits ADD COLUMN approver_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'approver_email'
  ) THEN
    ALTER TABLE permits ADD COLUMN approver_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'approver_manager_email'
  ) THEN
    ALTER TABLE permits ADD COLUMN approver_manager_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'approver_division_manager_email'
  ) THEN
    ALTER TABLE permits ADD COLUMN approver_division_manager_email text;
  END IF;
END $$;
