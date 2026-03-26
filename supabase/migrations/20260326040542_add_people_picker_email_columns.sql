/*
  # Add People Picker Email Columns to User Management

  1. Changes to `user_management` table
    - Add `employee_display_name` (text) - Display name from BusinessEmail0 people picker (used for Division dropdown)
    - Add `business_email_lookup` (text) - Actual email address extracted from BusinessEmail0 people picker
    - Add `manager_email_lookup` (text) - Actual email address extracted from Manageremail people picker
    - Add `division_manager_email_lookup` (text) - Actual email address extracted from DivisionManager_x002f_Escalation people picker

  2. Purpose
    - Store display names from people picker fields for UI display
    - Track actual email addresses internally for future use
    - Keep existing columns for backward compatibility
    - Support duplicate display names in dropdowns

  3. Indexes
    - Add index on employee_display_name for fast sorting/filtering
    - Add index on business_email_lookup for lookups

  4. Notes
    - Old columns (employee_first_name, employee_last_name, etc.) are kept for backward compatibility
    - Division dropdown will now use employee_display_name instead of concatenated first+last name
    - All email lookups are tracked internally for future automation features
*/

-- Add new columns for people picker data
ALTER TABLE user_management
  ADD COLUMN IF NOT EXISTS employee_display_name text,
  ADD COLUMN IF NOT EXISTS business_email_lookup text,
  ADD COLUMN IF NOT EXISTS manager_email_lookup text,
  ADD COLUMN IF NOT EXISTS division_manager_email_lookup text;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_management_employee_display_name
  ON user_management(employee_display_name);

CREATE INDEX IF NOT EXISTS idx_user_management_business_email_lookup
  ON user_management(business_email_lookup);

-- Add helpful comment
COMMENT ON COLUMN user_management.employee_display_name IS 'Display name from BusinessEmail0 people picker - shown in Division dropdown';
COMMENT ON COLUMN user_management.business_email_lookup IS 'Email address from BusinessEmail0 people picker - tracked for internal use';
COMMENT ON COLUMN user_management.manager_email_lookup IS 'Email address from Manageremail people picker - tracked for internal use';
COMMENT ON COLUMN user_management.division_manager_email_lookup IS 'Email address from DivisionManager_x002f_Escalation people picker - tracked for internal use';
