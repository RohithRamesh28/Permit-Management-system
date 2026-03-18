/*
  # Update Permit Fields with Signature Toggle and Field Requirements

  1. Changes to `permits` table
    - Add `requires_signature` (boolean) - Toggle to control if signature is required
    - Update `utility_provider` field to be text-based
    - Update `requester_email` to store email for Power Automate JSON requests
    - Set proper defaults for all fields

  2. Field Requirements (as per specification)
    - All fields mandatory except signature checkbox
    - Utility provider required when permit type is 'Electrical'
    - Dates formatted as MM/DD/YYYY (handled in frontend)
    - Requestor auto-filled from auth (name + email stored)
    - Date of request auto-filled

  3. Security
    - Maintain existing RLS policies
    - No changes to security model

  4. Notes
    - Signature fields remain optional based on `requires_signature` toggle
    - When toggle is on, signatures become mandatory
    - PDF generation will include signatures when present
*/

-- Add requires_signature toggle field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'requires_signature'
  ) THEN
    ALTER TABLE permits ADD COLUMN requires_signature boolean DEFAULT false;
  END IF;
END $$;

-- Add requester_email field to store email for Power Automate
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permits' AND column_name = 'requester_email'
  ) THEN
    ALTER TABLE permits ADD COLUMN requester_email text;
  END IF;
END $$;

-- Update utility_provider to ensure it's text type (should already be, but confirming)
-- This field is required when permit_type = 'Electrical'

-- Add comments for field requirements documentation
COMMENT ON COLUMN permits.requires_signature IS 'Toggle to control if signature is required. When true, signatures become mandatory.';
COMMENT ON COLUMN permits.requester_email IS 'Email of the person who created the permit request. Used for Power Automate JSON requests.';
COMMENT ON COLUMN permits.utility_provider IS 'Required when permit_type is Electrical. Text field for utility provider name.';
COMMENT ON COLUMN permits.requestor IS 'Auto-filled from authenticated user name.';
COMMENT ON COLUMN permits.date_of_request IS 'Auto-filled with current date when permit is created.';

-- All other fields are mandatory:
-- ontivity_project_number, performing_entity, date_of_project_commencement,
-- estimated_completion_date, permit_type, state, county, city, property_owner,
-- end_customer, project_value, detailed_sow

-- Optional fields:
-- actual_completion_date (filled later), requires_signature (checkbox)
-- applicant_signature_data, applicant_signature_date (when requires_signature is true)
-- reviewer_signature_data, reviewer_signature_date (when requires_signature is true)