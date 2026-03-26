/*
  # Add Two-Level Approval Workflow Support

  1. Overview
    - Implements a two-level approval workflow where permits can go through QP (Qualified Person) 
      and/or Approver review stages before becoming active
    - Tracks approval/rejection at each stage with timestamps and notes
    
  2. New Columns on `permits` table
    - `current_stage` (text): Tracks workflow stage - awaiting_qp, awaiting_approver, active, rejected
    - `send_to_qp` (boolean): Whether permit should go through QP review first (default true)
    - `is_qp_signature_required` (boolean): Whether QP must sign the document
    - `is_approver_signature_required` (boolean): Whether Approver must sign the document
    - `qp_approved_at` (timestamptz): When QP approved
    - `qp_approved_by` (text): QP name who approved
    - `qp_rejected_at` (timestamptz): When QP rejected
    - `qp_rejected_by` (text): QP name who rejected  
    - `qp_rejection_notes` (text): QP's rejection reason
    - `approver_approved_at` (timestamptz): When Approver approved
    - `approver_rejected_at` (timestamptz): When Approver rejected
    - `approver_rejection_notes` (text): Approver's rejection reason
    - `resubmission_count` (integer): Number of times permit has been resubmitted
    - `closed_at` (timestamptz): When permit was closed
    - `closed_by` (text): Who closed the permit
    - `close_notes` (text): Notes when closing

  3. Security
    - No changes to RLS policies (existing policies apply)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'current_stage'
  ) THEN
    ALTER TABLE permits ADD COLUMN current_stage text DEFAULT 'awaiting_qp';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'send_to_qp'
  ) THEN
    ALTER TABLE permits ADD COLUMN send_to_qp boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'is_qp_signature_required'
  ) THEN
    ALTER TABLE permits ADD COLUMN is_qp_signature_required boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'is_approver_signature_required'
  ) THEN
    ALTER TABLE permits ADD COLUMN is_approver_signature_required boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'qp_approved_at'
  ) THEN
    ALTER TABLE permits ADD COLUMN qp_approved_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'qp_approved_by'
  ) THEN
    ALTER TABLE permits ADD COLUMN qp_approved_by text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'qp_rejected_at'
  ) THEN
    ALTER TABLE permits ADD COLUMN qp_rejected_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'qp_rejected_by'
  ) THEN
    ALTER TABLE permits ADD COLUMN qp_rejected_by text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'qp_rejection_notes'
  ) THEN
    ALTER TABLE permits ADD COLUMN qp_rejection_notes text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'approver_approved_at'
  ) THEN
    ALTER TABLE permits ADD COLUMN approver_approved_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'approver_rejected_at'
  ) THEN
    ALTER TABLE permits ADD COLUMN approver_rejected_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'approver_rejection_notes'
  ) THEN
    ALTER TABLE permits ADD COLUMN approver_rejection_notes text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'resubmission_count'
  ) THEN
    ALTER TABLE permits ADD COLUMN resubmission_count integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'closed_at'
  ) THEN
    ALTER TABLE permits ADD COLUMN closed_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'closed_by'
  ) THEN
    ALTER TABLE permits ADD COLUMN closed_by text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permits' AND column_name = 'close_notes'
  ) THEN
    ALTER TABLE permits ADD COLUMN close_notes text;
  END IF;
END $$;

COMMENT ON COLUMN permits.current_stage IS 'Workflow stage: awaiting_qp, awaiting_approver, active, rejected, closed';
COMMENT ON COLUMN permits.send_to_qp IS 'If true, permit goes to QP first; if false, goes directly to approver';
COMMENT ON COLUMN permits.is_qp_signature_required IS 'QP must sign the document during approval';
COMMENT ON COLUMN permits.is_approver_signature_required IS 'Approver must sign the document during approval';
COMMENT ON COLUMN permits.resubmission_count IS 'Number of times this permit has been resubmitted after rejection';
