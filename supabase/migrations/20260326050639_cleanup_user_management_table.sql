/*
  # Cleanup User Management Table

  1. Changes
    - Remove unnecessary columns: employee_first_name, employee_last_name, business_email, manager_display_name, manager_electronic_address, title
    - Keep only essential columns:
      - id (primary key)
      - location_description (division/location)
      - job_assignment_name (job title)
      - employee_display_name (from BusinessEmail0 people picker)
      - business_email_lookup (email from BusinessEmail0 people picker)
      - manager_email_lookup (email from Manageremail people picker)
      - division_manager_email_lookup (email from DivisionManager/Escalation people picker)
      - created, modified, synced_at (timestamps)

  2. Notes
    - This simplifies the table to only store people picker data
    - All display names and emails will come from SharePoint people picker fields
*/

-- Drop unnecessary columns
ALTER TABLE user_management 
  DROP COLUMN IF EXISTS employee_first_name,
  DROP COLUMN IF EXISTS employee_last_name,
  DROP COLUMN IF EXISTS business_email,
  DROP COLUMN IF EXISTS manager_display_name,
  DROP COLUMN IF EXISTS manager_electronic_address,
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS division_manager_escalation;