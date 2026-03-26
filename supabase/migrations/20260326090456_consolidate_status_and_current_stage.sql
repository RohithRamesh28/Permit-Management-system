/*
  # Consolidate Status and Current Stage Fields

  1. Overview
    - Removes the `status` column from permits table
    - Uses `current_stage` as the single source of truth for permit workflow state
    - Updates current_stage values to be more descriptive and user-friendly
    - Migrates existing data from status to current_stage where needed

  2. Changes to `permits` table
    - Drop `status` column (after migrating data)
    - Update `current_stage` to NOT NULL with expanded values
    - New current_stage values:
      - 'draft' - Initial state when permit is being created
      - 'awaiting_qp' - Waiting for Qualified Person review/approval
      - 'awaiting_approver' - Waiting for Approver review/approval
      - 'rejected_by_qp' - QP rejected the permit
      - 'rejected_by_approver' - Approver rejected the permit
      - 'approved' - Permit fully approved and active
      - 'closed' - Permit has been closed

  3. Data Migration
    - Migrate existing permits based on status and current_stage combination
    - Ensure no data loss during migration

  4. Security
    - No changes to RLS policies (existing policies continue to work)
*/

-- Step 1: Update current_stage to handle all workflow states
-- Migrate existing data where current_stage might not be set correctly

-- For permits with status='Rejected', set appropriate rejected stage
UPDATE permits
SET current_stage = CASE
  WHEN qp_rejected_at IS NOT NULL THEN 'rejected_by_qp'
  WHEN approver_rejected_at IS NOT NULL THEN 'rejected_by_approver'
  ELSE 'rejected_by_qp'
END
WHERE status = 'Rejected' AND current_stage NOT IN ('rejected_by_qp', 'rejected_by_approver');

-- For permits with status='Active', set to approved
UPDATE permits
SET current_stage = 'approved'
WHERE status = 'Active' AND current_stage NOT IN ('approved', 'active');

-- Handle 'active' as 'approved' (normalize)
UPDATE permits
SET current_stage = 'approved'
WHERE current_stage = 'active';

-- For permits with status='Closed', set to closed
UPDATE permits
SET current_stage = 'closed'
WHERE status = 'Closed' AND current_stage != 'closed';

-- For permits with status='Pending Approval', use existing current_stage or default to awaiting_qp
UPDATE permits
SET current_stage = COALESCE(
  CASE
    WHEN current_stage IN ('awaiting_qp', 'awaiting_approver') THEN current_stage
    WHEN send_to_qp = true THEN 'awaiting_qp'
    ELSE 'awaiting_approver'
  END,
  'awaiting_qp'
)
WHERE status = 'Pending Approval' AND current_stage NOT IN ('awaiting_qp', 'awaiting_approver');

-- Handle any NULL current_stage values
UPDATE permits
SET current_stage = 'awaiting_qp'
WHERE current_stage IS NULL;

-- Step 2: Make current_stage NOT NULL and set a default
ALTER TABLE permits ALTER COLUMN current_stage SET NOT NULL;
ALTER TABLE permits ALTER COLUMN current_stage SET DEFAULT 'draft';

-- Step 3: Drop the status column
ALTER TABLE permits DROP COLUMN IF EXISTS status;

-- Step 4: Add comment explaining the current_stage values
COMMENT ON COLUMN permits.current_stage IS 'Workflow state: draft, awaiting_qp, awaiting_approver, rejected_by_qp, rejected_by_approver, approved, closed';
