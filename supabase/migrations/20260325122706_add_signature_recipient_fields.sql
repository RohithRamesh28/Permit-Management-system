/*
  # Add Signature Recipient Fields

  1. Changes
    - Add `send_to_qp_for_signature` boolean field (default: false)
    - Add `send_to_approver_for_signature` boolean field (default: false)
  
  2. Purpose
    - These fields control whether signature emails should be sent to the Qualified Person and/or Approver
    - Only relevant when `requires_signature` is true
    - Used to determine email recipients for signature requests
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'send_to_qp_for_signature'
  ) THEN
    ALTER TABLE permits ADD COLUMN send_to_qp_for_signature boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'send_to_approver_for_signature'
  ) THEN
    ALTER TABLE permits ADD COLUMN send_to_approver_for_signature boolean DEFAULT false;
  END IF;
END $$;
