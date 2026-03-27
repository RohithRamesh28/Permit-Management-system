import { Permit } from '../lib/supabase';

export type PermitAccessLevel = 'none' | 'view' | 'qp_approve' | 'approver_approve' | 'requestor_edit';

export interface PermitPermissions {
  canView: boolean;
  canEdit: boolean;
  canQpApprove: boolean;
  canQpReject: boolean;
  canApproverApprove: boolean;
  canApproverReject: boolean;
  canClose: boolean;
  accessLevel: PermitAccessLevel;
  lockReason?: string;
}

export function getPermitPermissions(
  permit: Permit | null,
  userEmail: string | null
): PermitPermissions {
  const defaultPermissions: PermitPermissions = {
    canView: true,
    canEdit: false,
    canQpApprove: false,
    canQpReject: false,
    canApproverApprove: false,
    canApproverReject: false,
    canClose: false,
    accessLevel: 'view',
    lockReason: undefined,
  };

  if (!permit || !userEmail) {
    return defaultPermissions;
  }

  const normalizedUserEmail = userEmail.toLowerCase().trim();
  const normalizedQpEmail = permit.qp_email?.toLowerCase().trim();
  const normalizedApproverEmail = permit.approver_email?.toLowerCase().trim();
  const normalizedRequestorEmail = permit.requester_email?.toLowerCase().trim();

  const isQp = normalizedQpEmail === normalizedUserEmail;
  const isApprover = normalizedApproverEmail === normalizedUserEmail;
  const isRequestor = normalizedRequestorEmail === normalizedUserEmail;

  switch (permit.current_stage) {
    case 'awaiting_qp':
      if (isQp) {
        return {
          canView: true,
          canEdit: true,
          canQpApprove: true,
          canQpReject: true,
          canApproverApprove: false,
          canApproverReject: false,
          canClose: false,
          accessLevel: 'qp_approve',
        };
      } else {
        return {
          ...defaultPermissions,
          lockReason: `Only the Qualified Person (${permit.qp_name || permit.qp_email}) can review and approve at this stage.`,
        };
      }

    case 'awaiting_approver':
      if (isApprover) {
        return {
          canView: true,
          canEdit: true,
          canApproverApprove: true,
          canApproverReject: true,
          canQpApprove: false,
          canQpReject: false,
          canClose: false,
          accessLevel: 'approver_approve',
        };
      } else {
        return {
          ...defaultPermissions,
          lockReason: `Only the Approver (${permit.approver_name || permit.approver_email}) can review and approve at this stage.`,
        };
      }

    case 'draft':
    case 'rejected_by_qp':
    case 'rejected_by_approver':
      if (isRequestor) {
        return {
          canView: true,
          canEdit: true,
          canQpApprove: false,
          canQpReject: false,
          canApproverApprove: false,
          canApproverReject: false,
          canClose: false,
          accessLevel: 'requestor_edit',
        };
      } else {
        return {
          ...defaultPermissions,
          lockReason: `Only the Requestor (${permit.requestor || permit.requester_email}) can edit and resubmit.`,
        };
      }

    case 'approved':
      if (isQp || isApprover) {
        return {
          canView: true,
          canEdit: false,
          canQpApprove: false,
          canQpReject: false,
          canApproverApprove: false,
          canApproverReject: false,
          canClose: true,
          accessLevel: 'view',
        };
      } else {
        return {
          ...defaultPermissions,
          lockReason: undefined,
        };
      }

    case 'closed':
      return {
        ...defaultPermissions,
        lockReason: 'This permit is closed and cannot be modified.',
      };

    default:
      return defaultPermissions;
  }
}

export function getCurrentReviewer(permit: Permit | null): { name: string; email: string; role: string } | null {
  if (!permit) return null;

  switch (permit.current_stage) {
    case 'awaiting_qp':
      return {
        name: permit.qp_name || 'Unknown',
        email: permit.qp_email || '',
        role: 'Qualified Person',
      };
    case 'awaiting_approver':
      return {
        name: permit.approver_name || 'Unknown',
        email: permit.approver_email || '',
        role: 'Approver',
      };
    case 'draft':
    case 'rejected_by_qp':
    case 'rejected_by_approver':
      return {
        name: permit.requestor || 'Unknown',
        email: permit.requester_email || '',
        role: 'Requestor',
      };
    default:
      return null;
  }
}
