import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, FileText, Clock, Eye, PlusCircle, CreditCard as Edit2, AlertCircle, Upload, User, Lock, Loader2 } from 'lucide-react';
import { supabase, Permit, PermitDocument, PermitAuditLog } from '../lib/supabase';
import { SignaturePad, SignaturePadRef } from './SignaturePad';
import { generatePermitPDF, downloadPDF, mergePDFs, embedMultipleSignaturesInPDF, SignatureData } from '../services/pdfGenerator';
import DocumentPreviewModal from './DocumentPreviewModal';
import PdfSigningModal from './PdfSigningModal';
import SearchableDropdown from './SearchableDropdown';
import { useSharePointJobs } from '../hooks/useSharePointJobs';
import { useSharePointJobDetails } from '../hooks/useSharePointJobDetails';
import DateInput from './DateInput';
import { useAuth } from '../contexts/AuthContext';
import { getPermitPermissions, getCurrentReviewer } from '../utils/permitPermissions';
import { getAvailableStates, getCountyCityOptions, getQPForSelection } from '../services/licensingService';
import { useApprovers, ApproverInfo } from '../hooks/useApprovers';
import { restoreOriginalDocument, clearPermitSignatures, deleteOldOriginalAndUploadNew } from '../services/documentService';

interface PermitDetailViewProps {
  permitId: string;
  onNavigate: (view: string) => void;
  readOnlyMode?: boolean;
}

export default function PermitDetailView({ permitId, onNavigate, readOnlyMode = false }: PermitDetailViewProps) {
  const [permit, setPermit] = useState<Permit | null>(null);
  const [documents, setDocuments] = useState<PermitDocument[]>([]);
  const [auditLog, setAuditLog] = useState<PermitAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);
  const [signerName, setSignerName] = useState('');
  const signaturePadRef = useRef<SignaturePadRef>(null);
  const [previewDocument, setPreviewDocument] = useState<{url: string; name: string; type: string} | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const { jobs, loading: jobsLoading } = useSharePointJobs();
  const [editFormData, setEditFormData] = useState<any>(null);
  const [showResubmitConfirmModal, setShowResubmitConfirmModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const { userName, userEmail } = useAuth();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showPdfSignModal, setShowPdfSignModal] = useState(false);
  const [pdfToSign, setPdfToSign] = useState<{ url: string; name: string } | null>(null);
  const [signaturePosition, setSignaturePosition] = useState<{ x: number; y: number } | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');
  const [currentApprovalAction, setCurrentApprovalAction] = useState<'qp' | 'approver' | null>(null);
  const [showQpRejectModal, setShowQpRejectModal] = useState(false);
  const [qpRejectionNotes, setQpRejectionNotes] = useState('');
  const [showApproverRejectModal, setShowApproverRejectModal] = useState(false);
  const [approverRejectionNotes, setApproverRejectionNotes] = useState('');

  const [editSelectedJobTitle, setEditSelectedJobTitle] = useState<string | null>(null);
  const { details: editJobDetails, loading: editJobDetailsLoading } = useSharePointJobDetails(editSelectedJobTitle);
  const [editPerformingEntityLocked, setEditPerformingEntityLocked] = useState(false);
  const [editPermitLevel, setEditPermitLevel] = useState<'State' | 'CountyCity'>('State');
  const [editPermitType, setEditPermitType] = useState<'General' | 'Electrical' | 'Specialty' | null>(null);
  const [editSelectedState, setEditSelectedState] = useState<string | null>(null);
  const [editSelectedCountyCityTitle, setEditSelectedCountyCityTitle] = useState<string | null>(null);
  const [editAvailableStates, setEditAvailableStates] = useState<string[]>([]);
  const [editAvailableCountyCities, setEditAvailableCountyCities] = useState<Array<{ title: string; qpName: string | null; qpEmail: string | null; spItemId: string | null }>>([]);
  const [editQpName, setEditQpName] = useState<string | null>(null);
  const [editQpEmail, setEditQpEmail] = useState<string | null>(null);
  const [editMatchedItemId, setEditMatchedItemId] = useState<string | null>(null);
  const [editLicenseListUsed, setEditLicenseListUsed] = useState<string | null>(null);
  const [editStatesLoading, setEditStatesLoading] = useState(false);
  const [editCountiesLoading, setEditCountiesLoading] = useState(false);
  const [editQpLoading, setEditQpLoading] = useState(false);
  const [editStatesError, setEditStatesError] = useState<string | null>(null);
  const [editApproverName, setEditApproverName] = useState<string>('');
  const [editSelectedApprover, setEditSelectedApprover] = useState<ApproverInfo | null>(null);
  const [editSendRequestToQp, setEditSendRequestToQp] = useState(true);
  const [editRequiresSignature, setEditRequiresSignature] = useState(false);
  const [editSendToQpForSignature, setEditSendToQpForSignature] = useState(false);
  const [editSendToApproverForSignature, setEditSendToApproverForSignature] = useState(false);
  const [editUploadedFiles, setEditUploadedFiles] = useState<File[]>([]);
  const [editDocumentToSign, setEditDocumentToSign] = useState<File | null>(null);
  const [editShowDocumentError, setEditShowDocumentError] = useState(false);
  const [editShowSignatureError, setEditShowSignatureError] = useState(false);
  const [editValidationError, setEditValidationError] = useState<string | null>(null);
  const [showRemoveDocumentModal, setShowRemoveDocumentModal] = useState(false);
  const [documentToRemove, setDocumentToRemove] = useState<{ url: string; name: string } | null>(null);
  const [editInitialStateLoaded, setEditInitialStateLoaded] = useState(false);
  const [showReplaceDocumentModal, setShowReplaceDocumentModal] = useState(false);
  const [sharePointUploading, setSharePointUploading] = useState(false);
  const [sharePointUploadFailed, setSharePointUploadFailed] = useState(false);
  const [sharePointRetryCount, setSharePointRetryCount] = useState(0);
  const [sidebarPermitValidity, setSidebarPermitValidity] = useState('');
  const [savingPermitValidity, setSavingPermitValidity] = useState(false);

  const { approvers, loading: loadingApprovers } = useApprovers();

  const permissions = getPermitPermissions(permit, userEmail);
  const currentReviewer = getCurrentReviewer(permit);

  useEffect(() => {
    fetchPermitDetails();
  }, [permitId]);

  useEffect(() => {
    if (permit) {
      setSidebarPermitValidity(permit.permit_validity || '');
    }
  }, [permit?.permit_validity]);

  useEffect(() => {
    if (permit && isEditMode) {
      setEditFormData({
        permit_jurisdiction_type: permit.permit_jurisdiction_type || 'State',
        ontivity_project_number: permit.ontivity_project_number || '',
        performing_entity: permit.performing_entity || '',
        date_of_project_commencement: permit.date_of_project_commencement || '',
        estimated_date_of_completion: permit.estimated_date_of_completion || '',
        type_of_permit: permit.type_of_permit || '',
        utility_provider: permit.utility_provider || '',
        state: permit.state || '',
        permit_jurisdiction: permit.permit_jurisdiction || '',
        land_owner: permit.land_owner || '',
        tower_owner: permit.tower_owner || '',
        end_customer: permit.end_customer || '',
        project_value: permit.project_value?.toString() || '',
        actual_date_of_completion: permit.actual_date_of_completion || '',
        permit_validity: permit.permit_validity || '',
        detailed_sow: permit.detailed_sow || '',
        requester_type: permit.requester_type || '',
      });

      const storedLevel = permit.permit_jurisdiction_type === 'County/City' ? 'CountyCity' : 'State';
      setEditPermitLevel(storedLevel);

      const typeMap: Record<string, 'General' | 'Electrical' | 'Specialty'> = {
        'General Permit': 'General',
        'Electrical Permit': 'Electrical',
        'Specialty/Tower Permit': 'Specialty',
      };
      const mappedType = permit.type_of_permit ? (typeMap[permit.type_of_permit] || null) : null;
      setEditPermitType(mappedType);

      setEditSelectedState(permit.state || null);

      if (storedLevel === 'CountyCity' && permit.permit_jurisdiction && permit.permit_jurisdiction !== permit.state) {
        const countyPart = permit.permit_jurisdiction.split(',')[0]?.trim() || null;
        setEditSelectedCountyCityTitle(countyPart);
      } else {
        setEditSelectedCountyCityTitle(null);
      }

      setEditQpName(permit.qp_name || null);
      setEditQpEmail(permit.qp_email || null);
      setEditPerformingEntityLocked(true);
      setEditApproverName(permit.approver_name || '');
      setEditSelectedApprover(null);
      setEditSendRequestToQp(permit.send_to_qp ?? true);
      setEditRequiresSignature(permit.requires_signature ?? false);
      setEditSendToQpForSignature(permit.is_qp_signature_required ?? false);
      setEditSendToApproverForSignature(permit.is_approver_signature_required ?? false);
      setEditUploadedFiles([]);
      setEditDocumentToSign(null);
      setEditShowDocumentError(false);
      setEditShowSignatureError(false);
      setEditValidationError(null);
      setEditAvailableStates([]);
      setEditAvailableCountyCities([]);
      setEditStatesError(null);
      setEditInitialStateLoaded(false);
    }
  }, [permit, isEditMode]);

  const fetchPermitDetails = async () => {
    try {
      const { data: permitData, error: permitError } = await supabase
        .from('permits')
        .select('*')
        .eq('id', permitId)
        .single();

      if (permitError) throw permitError;
      setPermit(permitData);

      const { data: docsData, error: docsError } = await supabase
        .from('permit_documents')
        .select('*')
        .eq('permit_id', permitId)
        .order('uploaded_at', { ascending: false });

      if (docsError) throw docsError;
      setDocuments(docsData || []);

      const { data: auditData, error: auditError } = await supabase
        .from('permit_audit_log')
        .select('*')
        .eq('permit_id', permitId)
        .order('created_at', { ascending: true });

      if (auditError) throw auditError;
      setAuditLog(auditData || []);
    } catch (error) {
      console.error('Error fetching permit details:', error);
    } finally {
      setLoading(false);
    }
  };


  const getMostRecentToSignDocument = () => {
    const toSignDocs = documents.filter(doc => doc.document_type === 'to_sign');
    if (toSignDocs.length === 0) return null;
    return toSignDocs.reduce((mostRecent, doc) => {
      if (!mostRecent) return doc;
      const mostRecentDate = new Date(mostRecent.uploaded_at || 0);
      const docDate = new Date(doc.uploaded_at || 0);
      return docDate > mostRecentDate ? doc : mostRecent;
    }, toSignDocs[0]);
  };

  const getDocumentToSignUrl = () => {
    if (permit?.signed_document_url) {
      return permit.signed_document_url;
    }
    const documentToSign = getMostRecentToSignDocument();
    return documentToSign?.file_url || null;
  };

  const handleQpApproveClick = () => {
    if (!permissions.canQpApprove) {
      alert('You do not have permission to approve as QP. Only the assigned Qualified Person can approve at this stage.');
      return;
    }
    setCurrentApprovalAction('qp');
    const docUrl = getDocumentToSignUrl();
    const documentToSign = getMostRecentToSignDocument();

    if (permit?.is_qp_signature_required && docUrl) {
      setPdfToSign({ url: docUrl, name: documentToSign?.file_name || 'Permit Application' });
      setShowPdfSignModal(true);
    } else {
      handleQpApprove();
    }
  };

  const handleApproverApproveClick = () => {
    if (!permissions.canApproverApprove) {
      alert('You do not have permission to approve. Only the assigned Approver can approve at this stage.');
      return;
    }
    setCurrentApprovalAction('approver');
    const docUrl = getDocumentToSignUrl();
    const documentToSign = getMostRecentToSignDocument();

    if (permit?.is_approver_signature_required && docUrl) {
      setPdfToSign({ url: docUrl, name: documentToSign?.file_name || 'Permit Application' });
      setShowPdfSignModal(true);
    } else {
      handleApproverApprove();
    }
  };

  const handleApproveClick = () => {
    const documentToSign = getMostRecentToSignDocument();

    if (documentToSign && !permit?.signature_image_url) {
      setPdfToSign({ url: documentToSign.file_url, name: documentToSign.file_name });
      setShowPdfSignModal(true);
    } else if (permit?.requires_signature && !permit.signature_image_url) {
      setPendingAction('approve');
      setShowSignatureModal(true);
    } else {
      handleApprove();
    }
  };

  const handlePdfSigningApprove = async (signatures: SignatureData[]) => {
    if (signatures.length === 0) return;

    const firstSignature = signatures[0];
    setSignerName(firstSignature.signerName);
    setSignaturePosition(firstSignature.position);
    setShowPdfSignModal(false);

    const docUrl = getDocumentToSignUrl();
    const documentToSign = getMostRecentToSignDocument();

    if (docUrl) {
      try {
        const signedPdfBlob = await embedMultipleSignaturesInPDF(
          docUrl,
          signatures
        );

        const signedFileName = `signed_${Date.now()}_${documentToSign?.file_name || 'permit.pdf'}`;
        const { error: uploadError } = await supabase.storage
          .from('permit-pdfs')
          .upload(signedFileName, signedPdfBlob, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('permit-pdfs')
          .getPublicUrl(signedFileName);

        await supabase
          .from('permits')
          .update({
            signed_document_url: publicUrl,
            signature_data_url: firstSignature.signatureData
          })
          .eq('id', permitId);

        if (documentToSign) {
          await supabase
            .from('permit_documents')
            .update({ file_url: publicUrl })
            .eq('id', documentToSign.id);
        }

        setPdfToSign(null);

        if (currentApprovalAction === 'qp') {
          await handleQpApprove(firstSignature.signatureData, publicUrl);
        } else if (currentApprovalAction === 'approver') {
          await handleApproverApprove(firstSignature.signatureData, publicUrl);
        } else {
          await handleApprove(firstSignature.signatureData);
        }
        return;
      } catch (error) {
        console.error('Error creating signed PDF:', error);
      }
    }

    setPdfToSign(null);

    if (currentApprovalAction === 'qp') {
      await handleQpApprove(firstSignature.signatureData);
    } else if (currentApprovalAction === 'approver') {
      await handleApproverApprove(firstSignature.signatureData);
    } else {
      await handleApprove(firstSignature.signatureData);
    }
  };

  const handleRejectClick = () => {
    setShowRejectModal(true);
  };

  const handleQpApprove = async (signatureData?: string, signedPdfUrl?: string) => {
    if (!permit) return;
    setActionInProgress(true);

    try {
      const qpName = permit.qp_name || userName || 'QP';
      const updateData: any = {
        current_stage: 'awaiting_approver',
        qp_approved_at: new Date().toISOString(),
        qp_approved_by: qpName,
        qp_rejection_notes: null,
      };

      if (signedPdfUrl) {
        updateData.signed_document_url = signedPdfUrl;
      }

      const { error: updateError } = await supabase
        .from('permits')
        .update(updateData)
        .eq('id', permitId);

      if (updateError) throw updateError;

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'QP Approved',
          performed_by: qpName,
          notes: signatureData ? 'QP approved with signature' : 'QP approved permit',
        },
      ]);

      const powerAutomateUrl = 'https://default3596b7c39b4b4ef89dde39825373af.28.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/c9bb3dc15bc34e1681cdcdda36db4cee/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=XflS1U3z0zJ8icT07Wzj8nTU2o0VIG0xnbt92ohpfZI';

      const payload = {
        timing_id: permitId,
        unique_id: permit.permit_id,
        action: 'qp_approved',
        current_stage: 'awaiting_approver',
        qp_approved_by: qpName,
        qp_approved_at: new Date().toISOString(),
        signed_pdf_url: signedPdfUrl || permit.signed_document_url || '',
        approver_email: permit.approver_email || '',
        approver_name: permit.approver_name || '',
        submitter_email: permit.requester_email || '',
        submitter_name: permit.requestor || '',
        qp_email: permit.qp_email || '',
        qp_name: permit.qp_name || '',
        is_qp_signature_required: permit.is_qp_signature_required,
        is_approver_signature_required: permit.is_approver_signature_required,
        permit_validity: permit.permit_validity || '',
      };

      try {
        await fetch(powerAutomateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (flowError) {
        console.error('Error sending to Power Automate:', flowError);
      }

      setCurrentApprovalAction(null);
      await fetchPermitDetails();

      setSuccessMessage('QP approval recorded. Permit sent to Approver.');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('Error in QP approval:', error);
      alert('Error processing QP approval. Please try again.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleQpReject = async () => {
    if (!permissions.canQpReject) {
      alert('You do not have permission to reject as QP. Only the assigned Qualified Person can reject at this stage.');
      return;
    }
    if (!permit || !qpRejectionNotes.trim()) {
      alert('Please provide rejection notes');
      return;
    }
    setActionInProgress(true);

    try {
      const qpName = permit.qp_name || userName || 'QP';

      const restoreResult = await restoreOriginalDocument(permitId);
      if (!restoreResult.success) {
        console.error('Failed to restore original document:', restoreResult.error);
      }

      const { error: updateError } = await supabase
        .from('permits')
        .update({
          current_stage: 'rejected_by_qp',
          qp_rejected_at: new Date().toISOString(),
          qp_rejected_by: qpName,
          qp_rejection_notes: qpRejectionNotes,
          rejection_notes: `Rejected by QP: ${qpRejectionNotes}`,
          signed_document_url: null,
          signed_pdf_url: null,
          signature_data_url: null,
          signature_image_url: null,
          signed_by: null,
          signed_at: null,
          qp_approved_at: null,
          qp_approved_by: null,
        })
        .eq('id', permitId);

      if (updateError) throw updateError;

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'QP Rejected',
          performed_by: qpName,
          notes: `${qpRejectionNotes}. Original document restored.`,
        },
      ]);

      const powerAutomateUrl = 'https://default3596b7c39b4b4ef89dde39825373af.28.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/c9bb3dc15bc34e1681cdcdda36db4cee/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=XflS1U3z0zJ8icT07Wzj8nTU2o0VIG0xnbt92ohpfZI';

      const payload = {
        timing_id: permitId,
        unique_id: permit.permit_id,
        action: 'qp_rejected',
        current_stage: 'rejected',
        qp_rejected_by: qpName,
        qp_rejected_at: new Date().toISOString(),
        rejection_reason: qpRejectionNotes,
        submitter_email: permit.requester_email || '',
        submitter_name: permit.requestor || '',
        qp_email: permit.qp_email || '',
        qp_name: permit.qp_name || '',
        permit_validity: permit.permit_validity || '',
      };

      try {
        await fetch(powerAutomateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (flowError) {
        console.error('Error sending to Power Automate:', flowError);
      }

      setShowQpRejectModal(false);
      setQpRejectionNotes('');
      await fetchPermitDetails();

      setSuccessMessage('Permit rejected by QP. Original document restored.');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('Error in QP rejection:', error);
      alert('Error processing QP rejection. Please try again.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleApproverApprove = async (signatureData?: string, signedPdfUrl?: string) => {
    if (!permit) return;
    setActionInProgress(true);

    try {
      const approverName = permit.approver_name || userName || 'Approver';
      const finalPdfUrl = signedPdfUrl || permit.signed_document_url || '';

      const updateData: any = {
        current_stage: 'approved',
        approver_approved_at: new Date().toISOString(),
        approved_by: approverName,
        approver_rejection_notes: null,
      };

      if (signedPdfUrl) {
        updateData.signed_document_url = signedPdfUrl;
        updateData.signed_pdf_url = signedPdfUrl;
      }

      const pdfBlob = generatePermitPDF({
        requestor: permit.requestor || '',
        requester_type: permit.requester_type || '',
        requester_email: permit.requester_email || '',
        date_of_request: permit.date_of_request || '',
        ontivity_project_number: permit.ontivity_project_number || '',
        performing_entity: permit.performing_entity || '',
        date_of_project_commencement: permit.date_of_project_commencement || '',
        estimated_date_of_completion: permit.estimated_date_of_completion?.toString() || '',
        type_of_permit: permit.type_of_permit || '',
        utility_provider: permit.utility_provider || '',
        state: permit.state || '',
        permit_jurisdiction: permit.permit_jurisdiction || '',
        permit_jurisdiction_type: permit.permit_jurisdiction_type || '',
        county_or_parish: permit.county_or_parish || '',
        city: permit.city || '',
        land_owner: permit.land_owner || '',
        tower_owner: permit.tower_owner || '',
        end_customer: permit.end_customer || '',
        project_value: permit.project_value?.toString() || '0',
        actual_date_of_completion: permit.actual_date_of_completion || '',
        permit_validity: permit.permit_validity || '',
        detailed_sow: permit.detailed_sow || '',
        requiresSignature: false,
        status: 'Approved',
        approvedBy: approverName,
        approvedAt: new Date().toLocaleDateString(),
        qp_name: permit.qp_name || '',
        qp_email: permit.qp_email || '',
        qp_approved_at: permit.qp_approved_at || '',
        approver_name: permit.approver_name || '',
        approver_email: permit.approver_email || '',
        approver_approved_at: permit.approver_approved_at || '',
      });

      const fileName = `permit_${permit.permit_id}_approved_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('permit-pdfs')
        .upload(fileName, pdfBlob, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from('permit-pdfs')
          .getPublicUrl(fileName);
        updateData.signed_pdf_url = publicUrl;
      }

      const { error: updateError } = await supabase
        .from('permits')
        .update(updateData)
        .eq('id', permitId);

      if (updateError) throw updateError;

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'Approver Approved',
          performed_by: approverName,
          notes: signatureData ? 'Approver approved with signature - Permit is now Active' : 'Approver approved - Permit is now Active',
        },
      ]);

      const approveUrl = 'https://default3596b7c39b4b4ef89dde39825373af.28.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/53a1fbea5beb4afbbab6dd68d92a519e/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-RTa3u1ouV89ah0pltsPZ5TM9iuSMsWvPYcVC7rGdXA';

      const payload = {
        timing_id: permitId,
        unique_id: permit.permit_id,
        action: 'approver_approved',
        current_stage: 'active',
        submitted_by: permit.requestor,
        submitted_by_email: permit.requester_email || '',
        requestor: permit.requestor,
        requester_type: permit.requester_type || '',
        ontivity_project_number: permit.ontivity_project_number,
        performing_entity: permit.performing_entity,
        date_of_request: permit.date_of_request,
        date_of_project_commencement: permit.date_of_project_commencement,
        estimated_date_of_completion: permit.estimated_date_of_completion || '',
        type_of_permit: permit.type_of_permit,
        utility_provider: permit.utility_provider || '',
        state: permit.state,
        permit_jurisdiction: permit.permit_jurisdiction || permit.state,
        land_owner: permit.land_owner,
        tower_owner: permit.tower_owner,
        end_customer: permit.end_customer,
        project_value: permit.project_value,
        detailed_sow: permit.detailed_sow,
        status: 'approved',
        approved_by: approverName,
        approved_at: new Date().toISOString(),
        pdf_url: updateData.signed_pdf_url || finalPdfUrl,
        qp_name: permit.qp_name || '',
        qp_email: permit.qp_email || '',
        approver_name: permit.approver_name || '',
        approver_email: permit.approver_email || '',
        permit_validity: permit.permit_validity || '',
      };

      try {
        await fetch(approveUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (flowError) {
        console.error('Error sending to Power Automate:', flowError);
      }

      setCurrentApprovalAction(null);
      await fetchPermitDetails();

      setSuccessMessage('Permit approved');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);

      uploadPermitToSharePoint(permitId, permit.ontivity_project_number);
    } catch (error) {
      console.error('Error in Approver approval:', error);
      alert('Error processing approval. Please try again.');
    } finally {
      setActionInProgress(false);
    }
  };

  const uploadPermitToSharePoint = async (permitIdToUpload: string, projectNumber: string, isRetry = false) => {
    if (isRetry) {
      setSharePointRetryCount(prev => prev + 1);
    } else {
      setSharePointRetryCount(0);
    }

    setSharePointUploading(true);
    setSharePointUploadFailed(false);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/upload-permit-to-sharepoint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          permit_id: permitIdToUpload,
          ontivity_project_number: projectNumber,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Upload failed');
      }

      setSharePointUploadFailed(false);
      setSuccessMessage('Files uploaded to SharePoint successfully');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('SharePoint upload error:', error);
      setSharePointUploadFailed(true);
    } finally {
      setSharePointUploading(false);
    }
  };

  const handleSharePointRetry = () => {
    if (!permit) return;
    uploadPermitToSharePoint(permitId, permit.ontivity_project_number, true);
  };

  const handleApproverReject = async () => {
    if (!permissions.canApproverReject) {
      alert('You do not have permission to reject. Only the assigned Approver can reject at this stage.');
      return;
    }
    if (!permit || !approverRejectionNotes.trim()) {
      alert('Please provide rejection notes');
      return;
    }
    setActionInProgress(true);

    try {
      const approverName = permit.approver_name || userName || 'Approver';
      const newStage = permit.send_to_qp ? 'awaiting_qp' : 'awaiting_approver';

      const restoreResult = await restoreOriginalDocument(permitId);
      if (!restoreResult.success) {
        console.error('Failed to restore original document:', restoreResult.error);
      }

      const { error: updateError } = await supabase
        .from('permits')
        .update({
          current_stage: 'rejected_by_approver',
          approver_rejected_at: new Date().toISOString(),
          approver_rejection_notes: approverRejectionNotes,
          rejection_notes: `Rejected by Approver: ${approverRejectionNotes}`,
          signed_document_url: null,
          signed_pdf_url: null,
          signature_data_url: null,
          signature_image_url: null,
          signed_by: null,
          signed_at: null,
          qp_approved_at: null,
          qp_approved_by: null,
          approver_approved_at: null,
          approved_by: null,
        })
        .eq('id', permitId);

      if (updateError) throw updateError;

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'Approver Rejected',
          performed_by: approverName,
          notes: `${approverRejectionNotes}. Original document restored. All signatures cleared.`,
        },
      ]);

      const rejectUrl = 'https://default3596b7c39b4b4ef89dde39825373af.28.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/cc32f91623ff4302a6937d2e52aa4b7e/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=IN1DCrsjUtx5xWKO5GePRXi3BRGytChJSpau4Pe3Wr8';

      const payload = {
        timing_id: permitId,
        unique_id: permit.permit_id,
        action: 'approver_rejected',
        current_stage: 'rejected',
        submitted_by: permit.requestor,
        submitted_by_email: permit.requester_email || '',
        requestor: permit.requestor,
        requester_type: permit.requester_type || '',
        ontivity_project_number: permit.ontivity_project_number,
        performing_entity: permit.performing_entity,
        status: 'rejected',
        rejection_reason: approverRejectionNotes,
        rejected_by: approverName,
        rejected_at: new Date().toISOString(),
        send_to_qp: permit.send_to_qp,
        next_stage_on_resubmit: newStage,
        qp_email: permit.qp_email || '',
        qp_name: permit.qp_name || '',
        approver_email: permit.approver_email || '',
        approver_name: permit.approver_name || '',
        permit_validity: permit.permit_validity || '',
      };

      try {
        await fetch(rejectUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (flowError) {
        console.error('Error sending to Power Automate:', flowError);
      }

      setShowApproverRejectModal(false);
      setApproverRejectionNotes('');
      await fetchPermitDetails();

      setSuccessMessage('Permit rejected by Approver. Original document restored.');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('Error in Approver rejection:', error);
      alert('Error processing rejection. Please try again.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleApprove = async (signatureData?: string) => {
    if (!permit) return;
    setActionInProgress(true);

    try {
      const updateData: any = {
        current_stage: 'approved',
        rejection_notes: null
      };
      let pdfUrl = null;

      if (signatureData) {
        updateData.signature_image_url = signatureData;
        updateData.signed_by = signerName || userName || 'System Admin';
        updateData.signed_at = new Date().toISOString();
      }

      const approvalDate = new Date().toLocaleDateString();
      const approverName = signatureData ? (signerName || userName || 'System Admin') : (userName || 'System Admin');
      updateData.approved_by = approverName;

      const pdfBlob = generatePermitPDF({
        requestor: permit.requestor || '',
        requester_type: permit.requester_type || '',
        requester_email: permit.requester_email || '',
        date_of_request: permit.date_of_request || '',
        ontivity_project_number: permit.ontivity_project_number || '',
        performing_entity: permit.performing_entity || '',
        date_of_project_commencement: permit.date_of_project_commencement || '',
        estimated_date_of_completion: permit.estimated_date_of_completion?.toString() || '',
        type_of_permit: permit.type_of_permit || '',
        utility_provider: permit.utility_provider || '',
        state: permit.state || '',
        permit_jurisdiction: permit.permit_jurisdiction || '',
        permit_jurisdiction_type: permit.permit_jurisdiction_type || '',
        county_or_parish: permit.county_or_parish || '',
        city: permit.city || '',
        land_owner: permit.land_owner || '',
        tower_owner: permit.tower_owner || '',
        end_customer: permit.end_customer || '',
        project_value: permit.project_value?.toString() || '0',
        actual_date_of_completion: permit.actual_date_of_completion || '',
        permit_validity: permit.permit_validity || '',
        detailed_sow: permit.detailed_sow || '',
        requiresSignature: false,
        status: 'Approved',
        approvedBy: approverName,
        approvedAt: approvalDate,
        qp_name: permit.qp_name || '',
        qp_email: permit.qp_email || '',
        qp_approved_at: permit.qp_approved_at || '',
        approver_name: permit.approver_name || '',
        approver_email: permit.approver_email || '',
        approver_approved_at: permit.approver_approved_at || '',
      });

      const fileName = `permit_${permit.permit_id}_approved_${Date.now()}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('permit-pdfs')
        .upload(fileName, pdfBlob, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('permit-pdfs')
        .getPublicUrl(fileName);

      pdfUrl = publicUrl;
      updateData.signed_pdf_url = pdfUrl;

      const { error: updateError } = await supabase
        .from('permits')
        .update(updateData)
        .eq('id', permitId);

      if (updateError) throw updateError;

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'Approved',
          performed_by: approverName,
          notes: signatureData ? 'Permit approved and activated with signature' : 'Permit approved and activated',
        },
      ]);

      const approveUrl = 'https://default3596b7c39b4b4ef89dde39825373af.28.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/53a1fbea5beb4afbbab6dd68d92a519e/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-RTa3u1ouV89ah0pltsPZ5TM9iuSMsWvPYcVC7rGdXA';

      const payload = {
        timing_id: permitId,
        unique_id: permit.permit_id,
        submitted_by: permit.requestor,
        submitted_by_email: permit.requester_email || '',
        requestor: permit.requestor,
        requester_type: permit.requester_type || '',
        ontivity_project_number: permit.ontivity_project_number,
        performing_entity: permit.performing_entity,
        date_of_request: permit.date_of_request,
        date_of_project_commencement: permit.date_of_project_commencement,
        estimated_date_of_completion: permit.estimated_date_of_completion || '',
        type_of_permit: permit.type_of_permit,
        utility_provider: permit.utility_provider || '',
        state: permit.state,
        permit_jurisdiction: permit.permit_jurisdiction || permit.state,
        land_owner: permit.land_owner,
        tower_owner: permit.tower_owner,
        end_customer: permit.end_customer,
        project_value: permit.project_value,
        detailed_sow: permit.detailed_sow,
        status: 'approved',
        approved_by: approverName,
        approved_at: new Date().toISOString(),
        pdf_url: pdfUrl || '',
        permit_validity: permit.permit_validity || '',
      };

      try {
        await fetch(approveUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } catch (flowError) {
        console.error('Error sending to Power Automate:', flowError);
      }

      setShowSignatureModal(false);
      signaturePadRef.current?.clear();
      setSignerName('');
      setPendingAction(null);
      setIsEditMode(false);
      await fetchPermitDetails();

      setSuccessMessage('Permit approved successfully');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('Error approving permit:', error);
      alert('Error approving permit. Please try again.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReject = async () => {
    if (!permit || !rejectionNotes.trim()) {
      alert('Please provide rejection notes');
      return;
    }
    setActionInProgress(true);

    try {
      const updateData: any = {
        current_stage: 'rejected_by_qp',
        rejection_notes: rejectionNotes
      };

      const { error: updateError } = await supabase
        .from('permits')
        .update(updateData)
        .eq('id', permitId);

      if (updateError) throw updateError;

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'Rejected',
          performed_by: 'System Admin',
          notes: rejectionNotes,
        },
      ]);

      const rejectUrl = 'https://default3596b7c39b4b4ef89dde39825373af.28.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/cc32f91623ff4302a6937d2e52aa4b7e/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=IN1DCrsjUtx5xWKO5GePRXi3BRGytChJSpau4Pe3Wr8';

      const payload = {
        timing_id: permitId,
        unique_id: permit.permit_id,
        submitted_by: permit.requestor,
        submitted_by_email: permit.requester_email || '',
        requestor: permit.requestor,
        requester_type: permit.requester_type || '',
        ontivity_project_number: permit.ontivity_project_number,
        performing_entity: permit.performing_entity,
        date_of_request: permit.date_of_request,
        date_of_project_commencement: permit.date_of_project_commencement,
        estimated_date_of_completion: permit.estimated_date_of_completion || '',
        type_of_permit: permit.type_of_permit,
        utility_provider: permit.utility_provider || '',
        state: permit.state,
        permit_jurisdiction: permit.permit_jurisdiction || permit.state,
        land_owner: permit.land_owner,
        tower_owner: permit.tower_owner,
        end_customer: permit.end_customer,
        project_value: permit.project_value,
        detailed_sow: permit.detailed_sow,
        status: 'rejected',
        rejection_reason: rejectionNotes,
        rejected_by: 'System Admin',
        rejected_at: new Date().toISOString(),
        permit_validity: permit.permit_validity || '',
      };

      try {
        await fetch(rejectUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } catch (flowError) {
        console.error('Error sending to Power Automate:', flowError);
      }

      setShowRejectModal(false);
      setRejectionNotes('');
      setIsEditMode(false);
      await fetchPermitDetails();

      setSuccessMessage('Permit rejected successfully');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('Error rejecting permit:', error);
      alert('Error rejecting permit. Please try again.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSignatureSubmit = async () => {
    if (!signerName.trim()) {
      alert('Please enter your name');
      return;
    }

    if (!signaturePadRef.current) {
      alert('Signature pad not ready. Please try again.');
      return;
    }

    if (signaturePadRef.current.isEmpty()) {
      alert('Please draw your signature');
      return;
    }

    const signatureData = signaturePadRef.current.toDataURL();

    setShowSignatureModal(false);
    setShowPdfSignModal(false);
    setPdfToSign(null);

    if (pendingAction === 'approve') {
      await handleApprove(signatureData);
    }
  };

  const handleResubmitClick = () => {
    setShowResubmitConfirmModal(true);
  };

  const handleResubmit = async () => {
    if (!permit || !editFormData) return;

    const existingPermitDoc = documents.find(d => d.document_type === 'to_sign');
    if (!editDocumentToSign && !existingPermitDoc) {
      setEditValidationError('Permit Application document is required for submission. Please upload before submitting.');
      setShowResubmitConfirmModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!editFormData.ontivity_project_number || editFormData.ontivity_project_number.trim() === '') {
      setEditValidationError('Ontivity Project Number is required. Please select a project.');
      setShowResubmitConfirmModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!editFormData.performing_entity || editFormData.performing_entity === '') {
      setEditValidationError('Performing Entity is required. Please select an entity.');
      setShowResubmitConfirmModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!editFormData.date_of_project_commencement || editFormData.date_of_project_commencement === '') {
      setEditValidationError('Date of Project Commencement is required.');
      setShowResubmitConfirmModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!editFormData.estimated_date_of_completion || editFormData.estimated_date_of_completion === '') {
      setEditValidationError('Estimated Date of Completion is required.');
      setShowResubmitConfirmModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!editPermitType) {
      setEditValidationError('Type of Permit is required. Please select a permit type.');
      setShowResubmitConfirmModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (editPermitType === 'Electrical' && (!editFormData.utility_provider || editFormData.utility_provider.trim() === '')) {
      setEditValidationError('Utility Provider is required for Electrical permits.');
      setShowResubmitConfirmModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!editSelectedState || editSelectedState === '') {
      setEditValidationError('State is required. Please select a state.');
      setShowResubmitConfirmModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (editPermitLevel === 'CountyCity' && (!editSelectedCountyCityTitle || editSelectedCountyCityTitle === '')) {
      setEditValidationError('County/City is required when permit level is County/City.');
      setShowResubmitConfirmModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!editFormData.tower_owner || editFormData.tower_owner.trim() === '') {
      setEditValidationError('Tower Owner is required.');
      setShowResubmitConfirmModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!editFormData.end_customer || editFormData.end_customer.trim() === '') {
      setEditValidationError('End Customer is required.');
      setShowResubmitConfirmModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!editFormData.project_value || parseFloat(editFormData.project_value) <= 0) {
      setEditValidationError('Project Value is required and must be greater than 0.');
      setShowResubmitConfirmModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!editFormData.detailed_sow || editFormData.detailed_sow.trim() === '') {
      setEditValidationError('Detailed Scope of Work is required.');
      setShowResubmitConfirmModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!editFormData.requester_type || editFormData.requester_type === '') {
      setEditValidationError('Requester Type is required. Please select a requester type.');
      setShowResubmitConfirmModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!editApproverName || editApproverName.trim() === '') {
      setEditValidationError('Approver is required. Please select an approver.');
      setShowResubmitConfirmModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (editSendRequestToQp && !editQpName) {
      setEditValidationError('A Qualified Person is required. Please select a valid state/county or contact admin.');
      setShowResubmitConfirmModal(false);
      return;
    }
    if (editRequiresSignature && !editSendToQpForSignature && !editSendToApproverForSignature) {
      setEditShowSignatureError(true);
      setShowResubmitConfirmModal(false);
      return;
    }

    setActionInProgress(true);
    setShowResubmitConfirmModal(false);

    try {
      const newStage = editSendRequestToQp ? 'awaiting_qp' : 'awaiting_approver';
      const newResubmissionCount = (permit.resubmission_count || 0) + 1;

      const resolvedQpName = editQpName || permit.qp_name || null;
      const resolvedQpEmail = editQpEmail || permit.qp_email || null;
      const resolvedApproverName = editApproverName || permit.approver_name || null;
      const resolvedApproverEmail = editSelectedApprover?.businessEmail || permit.approver_email || null;
      const resolvedApproverManagerEmail = editSelectedApprover?.managerEmail || permit.approver_manager_email || null;
      const resolvedApproverDivisionManagerEmail = editSelectedApprover?.divisionManagerEmail || permit.approver_division_manager_email || null;

      const permitJurisdiction = editPermitLevel === 'CountyCity' && editSelectedCountyCityTitle
        ? `${editSelectedCountyCityTitle}, ${editSelectedState}`
        : (editSelectedState || editFormData.state);

      const updateData: any = {
        current_stage: newStage,
        resubmission_count: newResubmissionCount,
        permit_jurisdiction_type: editPermitLevel === 'State' ? 'State' : 'County/City',
        ontivity_project_number: editFormData.ontivity_project_number,
        performing_entity: editFormData.performing_entity,
        date_of_project_commencement: editFormData.date_of_project_commencement,
        estimated_date_of_completion: editFormData.estimated_date_of_completion,
        type_of_permit: editFormData.type_of_permit,
        utility_provider: editPermitType === 'Electrical' ? editFormData.utility_provider : null,
        state: editSelectedState || editFormData.state,
        permit_jurisdiction: permitJurisdiction,
        land_owner: editFormData.land_owner || null,
        tower_owner: editFormData.tower_owner,
        end_customer: editFormData.end_customer,
        project_value: parseFloat(editFormData.project_value) || 0,
        actual_date_of_completion: editFormData.actual_date_of_completion || null,
        permit_validity: editFormData.permit_validity || null,
        detailed_sow: editFormData.detailed_sow,
        requester_type: editFormData.requester_type,
        qp_name: resolvedQpName,
        qp_email: resolvedQpEmail,
        send_to_qp: editSendRequestToQp,
        approver_name: resolvedApproverName,
        approver_email: resolvedApproverEmail,
        approver_manager_email: resolvedApproverManagerEmail,
        approver_division_manager_email: resolvedApproverDivisionManagerEmail,
        requires_signature: editRequiresSignature,
        is_qp_signature_required: editRequiresSignature && editSendToQpForSignature,
        is_approver_signature_required: editRequiresSignature && editSendToApproverForSignature,
        send_to_qp_for_signature: editRequiresSignature && editSendToQpForSignature,
        send_to_approver_for_signature: editRequiresSignature && editSendToApproverForSignature,
        rejection_notes: null,
        qp_approved_at: null,
        qp_approved_by: null,
        qp_rejected_at: null,
        qp_rejected_by: null,
        qp_rejection_notes: null,
        approver_approved_at: null,
        approver_rejected_at: null,
        approver_rejection_notes: null,
      };

      if (editMatchedItemId) updateData.matched_license_item_id = editMatchedItemId;
      if (editLicenseListUsed) updateData.license_list_used = editLicenseListUsed;

      if (editDocumentToSign) {
        updateData.signed_document_url = null;
        updateData.signed_pdf_url = null;
        updateData.signature_data_url = null;
        updateData.signature_image_url = null;
        updateData.signed_by = null;
        updateData.signed_at = null;
      }

      const { error: updateError } = await supabase
        .from('permits')
        .update(updateData)
        .eq('id', permitId);

      if (updateError) throw updateError;

      if (editDocumentToSign) {
        const uploadResult = await deleteOldOriginalAndUploadNew(permitId, editDocumentToSign);
        if (!uploadResult) {
          console.error('Failed to upload new document');
        }
      }

      if (editUploadedFiles.length > 0) {
        for (const file of editUploadedFiles) {
          const filePath = `permit-documents/${permitId}/${Date.now()}_${file.name}`;
          const { error: uploadErr } = await supabase.storage
            .from('permit-pdfs')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });
          if (!uploadErr) {
            const { data: { publicUrl } } = supabase.storage.from('permit-pdfs').getPublicUrl(filePath);
            await supabase.from('permit_documents').insert({
              permit_id: permitId,
              document_type: 'general',
              file_name: file.name,
              file_url: publicUrl,
            });
          }
        }
      }

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'Resubmitted',
          performed_by: permit.requestor,
          notes: `Permit resubmitted for approval (resubmission #${newResubmissionCount})`,
        },
      ]);

      const resubmitUrl = 'https://default3596b7c39b4b4ef89dde39825373af.28.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/82748a4997104be0981cd80f7938e8fc/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Smk9mkSJ_0xSjbvHAfNXoinxgDCu8IeX1ZzbaBPfAt4';

      const payload = {
        timing_id: permitId,
        unique_id: permit.permit_id,
        submitted_by: permit.requestor,
        submitted_by_email: permit.requester_email || '',
        requestor: permit.requestor,
        requester_type: editFormData.requester_type,
        ontivity_project_number: editFormData.ontivity_project_number,
        performing_entity: editFormData.performing_entity,
        date_of_request: permit.date_of_request,
        date_of_project_commencement: editFormData.date_of_project_commencement,
        estimated_date_of_completion: editFormData.estimated_date_of_completion,
        type_of_permit: editFormData.type_of_permit,
        utility_provider: editFormData.utility_provider || '',
        state: editSelectedState || editFormData.state,
        permit_jurisdiction: permitJurisdiction,
        land_owner: editFormData.land_owner || '',
        tower_owner: editFormData.tower_owner,
        end_customer: editFormData.end_customer,
        project_value: parseFloat(editFormData.project_value) || 0,
        detailed_sow: editFormData.detailed_sow,
        status: 'resubmitted',
        current_stage: newStage,
        resubmission_count: newResubmissionCount,
        resubmitted_by: permit.requestor,
        resubmitted_at: new Date().toISOString(),
        send_to_qp: editSendRequestToQp,
        qp_email: resolvedQpEmail || '',
        qp_name: resolvedQpName || '',
        approver_email: resolvedApproverEmail || '',
        approver_name: resolvedApproverName || '',
        is_qp_signature_required: editRequiresSignature && editSendToQpForSignature,
        is_approver_signature_required: editRequiresSignature && editSendToApproverForSignature,
        permit_validity: editFormData.permit_validity || '',
      };

      try {
        await fetch(resubmitUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } catch (flowError) {
        console.error('Error sending to Power Automate:', flowError);
      }

      setIsEditMode(false);
      await fetchPermitDetails();

      setSuccessMessage('Permit resubmitted successfully');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('Error resubmitting permit:', error);
      alert('Error resubmitting permit. Please try again.');
    } finally {
      setActionInProgress(false);
    }
  };

  useEffect(() => {
    if (editJobDetails && isEditMode) {
      if (editJobDetails.division) {
        setEditFormData((prev: any) => ({ ...prev, performing_entity: editJobDetails.division }));
        setEditPerformingEntityLocked(true);
      } else {
        if (editPerformingEntityLocked) {
          setEditFormData((prev: any) => ({ ...prev, performing_entity: '' }));
          setEditPerformingEntityLocked(false);
        }
      }
      if (editJobDetails.carrier) {
        setEditFormData((prev: any) => ({ ...prev, end_customer: editJobDetails.carrier }));
      }
    }
  }, [editJobDetails]);

  const editLoadStates = async (level: 'State' | 'CountyCity', type: 'General' | 'Electrical' | 'Specialty', entity: string, preserveState = false) => {
    if (!type || !entity) return;
    setEditStatesLoading(true);
    setEditStatesError(null);
    setEditAvailableStates([]);
    if (!preserveState) {
      setEditSelectedState(null);
      setEditSelectedCountyCityTitle(null);
      setEditQpName(null);
      setEditQpEmail(null);
    }
    const states = await getAvailableStates(level, type, entity);
    setEditAvailableStates(states);
    if (states.length === 0) {
      setEditStatesError('No active licenses found for this combination. Contact admin.');
    }
    setEditStatesLoading(false);
  };

  const editLoadCountyCityOptions = async () => {
    if (!editSelectedState || !editPermitType || !editFormData?.performing_entity) return;
    setEditCountiesLoading(true);
    const options = await getCountyCityOptions(editPermitType, editFormData.performing_entity, editSelectedState);
    setEditAvailableCountyCities(options);
    if (options.length === 1) {
      setEditSelectedCountyCityTitle(options[0].title);
      setEditQpName(options[0].qpName);
      setEditQpEmail(options[0].qpEmail);
      setEditMatchedItemId(options[0].spItemId);
      const sourceList = editPermitType === 'Electrical' ? 'county_electrical' : 'county_contractor';
      setEditLicenseListUsed(sourceList);
    } else if (options.length > 1) {
      setEditSelectedCountyCityTitle(null);
      setEditQpName(null);
      setEditQpEmail(null);
      setEditMatchedItemId(null);
      setEditLicenseListUsed(null);
    }
    setEditCountiesLoading(false);
  };

  const editLoadQP = async () => {
    if (!editPermitType || !editFormData?.performing_entity || !editSelectedState) return;
    if (editPermitLevel === 'CountyCity' && !editSelectedCountyCityTitle) return;
    setEditQpLoading(true);
    const result = await getQPForSelection(
      editPermitLevel,
      editPermitType,
      editFormData.performing_entity,
      editSelectedState,
      editPermitLevel === 'CountyCity' ? editSelectedCountyCityTitle! : undefined
    );
    setEditQpName(result.qpName);
    setEditQpEmail(result.qpEmail);
    setEditMatchedItemId(result.matchedItemId);
    setEditLicenseListUsed(result.sourceList);
    setEditQpLoading(false);
  };

  useEffect(() => {
    if (isEditMode && editPermitType && editFormData?.performing_entity) {
      const shouldPreserveState = !editInitialStateLoaded && editSelectedState;
      editLoadStates(editPermitLevel, editPermitType, editFormData.performing_entity, !!shouldPreserveState);
      if (!editInitialStateLoaded) {
        setEditInitialStateLoaded(true);
      }
    }
  }, [editPermitType, editFormData?.performing_entity, editPermitLevel]);

  useEffect(() => {
    if (!isEditMode || !editSelectedState) return;
    if (editPermitLevel === 'CountyCity') {
      editLoadCountyCityOptions();
    } else {
      editLoadQP();
    }
  }, [editSelectedState, editPermitLevel]);

  useEffect(() => {
    if (!isEditMode || !editSelectedCountyCityTitle || editPermitLevel !== 'CountyCity') return;
    const selected = editAvailableCountyCities.find(opt => opt.title === editSelectedCountyCityTitle);
    if (selected) {
      setEditQpName(selected.qpName);
      setEditQpEmail(selected.qpEmail);
      setEditMatchedItemId(selected.spItemId);
      const sourceList = editPermitType === 'Electrical' ? 'county_electrical' : 'county_contractor';
      setEditLicenseListUsed(sourceList);
    }
  }, [editSelectedCountyCityTitle, editAvailableCountyCities]);

  const handleEditPermitLevelChange = (level: 'State' | 'CountyCity') => {
    setEditPermitLevel(level);
    setEditPermitType(null);
    setEditSelectedState(null);
    setEditSelectedCountyCityTitle(null);
    setEditAvailableStates([]);
    setEditAvailableCountyCities([]);
    setEditQpName(null);
    setEditQpEmail(null);
    setEditStatesError(null);
    setEditFormData((prev: any) => ({ ...prev, permit_jurisdiction_type: level === 'State' ? 'State' : 'County/City', type_of_permit: '', state: '', permit_jurisdiction: '' }));
  };

  const handleEditPermitTypeChange = (type: 'General' | 'Electrical' | 'Specialty') => {
    setEditPermitType(type);
    setEditSelectedState(null);
    setEditSelectedCountyCityTitle(null);
    setEditAvailableStates([]);
    setEditAvailableCountyCities([]);
    setEditQpName(null);
    setEditQpEmail(null);
    setEditStatesError(null);
    const typeDisplay = type === 'General' ? 'General Permit' : type === 'Electrical' ? 'Electrical Permit' : 'Specialty/Tower Permit';
    setEditFormData((prev: any) => ({ ...prev, type_of_permit: typeDisplay, state: '', permit_jurisdiction: '' }));
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleEditDateChange = (name: string, value: string) => {
    setEditFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setEditUploadedFiles(Array.from(e.target.files));
    }
  };

  const handleEditRemoveFile = (index: number) => {
    setEditUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditDocumentToSignChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setEditDocumentToSign(e.target.files[0]);
    }
  };

  const handleEditRemoveDocumentToSign = () => {
    const existingDoc = documents.find(d => d.document_type === 'to_sign');
    const docToRemove = editDocumentToSign
      ? { url: URL.createObjectURL(editDocumentToSign), name: editDocumentToSign.name }
      : existingDoc
        ? { url: existingDoc.file_url, name: existingDoc.file_name }
        : null;

    if (docToRemove) {
      setDocumentToRemove(docToRemove);
      setShowRemoveDocumentModal(true);
    }
  };

  const confirmRemoveDocument = () => {
    setEditDocumentToSign(null);
    setDocumentToRemove(null);
    setShowRemoveDocumentModal(false);
  };

  const handleAdditionalFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAdditionalFiles(Array.from(e.target.files));
    }
  };

  const handleRemoveAdditionalFile = (index: number) => {
    setAdditionalFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAdditionalFiles = async () => {
    if (!permit || additionalFiles.length === 0) return;
    setUploadingFiles(true);

    try {
      const fileUrls: Array<{ name: string; url: string; documentType: string }> = [];

      for (const file of additionalFiles) {
        const filePath = `permit-documents/${permit.id}/${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('permit-pdfs')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('permit-pdfs')
          .getPublicUrl(filePath);

        fileUrls.push({
          name: file.name,
          url: urlData.publicUrl,
          documentType: 'general',
        });
      }

      if (fileUrls.length > 0) {
        const documentInserts = fileUrls.map((fileInfo) => ({
          permit_id: permit.id,
          document_type: fileInfo.documentType,
          file_name: fileInfo.name,
          file_url: fileInfo.url,
          uploaded_after_approval: true,
        }));

        const { error: docError } = await supabase.from('permit_documents').insert(documentInserts);

        if (docError) throw docError;

        await supabase.from('permit_audit_log').insert([
          {
            permit_id: permit.id,
            action: 'Documents Added',
            performed_by: userName || 'User',
            notes: `Uploaded ${fileUrls.length} additional file(s) after approval`,
          },
        ]);
      }

      setShowUploadModal(false);
      setAdditionalFiles([]);
      await fetchPermitDetails();

      if (permit.ontivity_project_number) {
        await uploadPermitToSharePoint(permit.id, permit.ontivity_project_number);
      } else {
        setSuccessMessage('Files saved successfully');
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
      }
    } catch (error) {
      console.error('Error uploading additional files:', error);
      alert('Error uploading files. Please try again.');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!permit) return;

    const pdfBlob = generatePermitPDF({
      requestor: permit.requestor || '',
      requester_type: permit.requester_type || '',
      requester_email: permit.requester_email || '',
      date_of_request: permit.date_of_request || '',
      ontivity_project_number: permit.ontivity_project_number || '',
      performing_entity: permit.performing_entity || '',
      date_of_project_commencement: permit.date_of_project_commencement || '',
      estimated_date_of_completion: permit.estimated_date_of_completion?.toString() || '',
      type_of_permit: permit.type_of_permit || '',
      utility_provider: permit.utility_provider || '',
      state: permit.state || '',
      permit_jurisdiction: permit.permit_jurisdiction || '',
      permit_jurisdiction_type: permit.permit_jurisdiction_type || '',
      county_or_parish: permit.county_or_parish || '',
      city: permit.city || '',
      land_owner: permit.land_owner || '',
      tower_owner: permit.tower_owner || '',
      end_customer: permit.end_customer || '',
      project_value: permit.project_value?.toString() || '0',
      actual_date_of_completion: permit.actual_date_of_completion || '',
      permit_validity: permit.permit_validity || '',
      detailed_sow: permit.detailed_sow || '',
      requiresSignature: false,
      status: permit.current_stage,
      approvedBy: permit.current_stage === 'approved' ? (permit.approved_by || permit.signed_by || 'System Admin') : undefined,
      approvedAt: permit.current_stage === 'approved' && permit.signed_at ? formatDate(permit.signed_at) : undefined,
      qp_name: permit.qp_name || '',
      qp_email: permit.qp_email || '',
      qp_approved_at: permit.qp_approved_at || '',
      approver_name: permit.approver_name || '',
      approver_email: permit.approver_email || '',
      approver_approved_at: permit.approver_approved_at || '',
    });

    const mergedPdfBlob = await mergePDFs(pdfBlob, permit.signed_document_url);

    const filename = `PERMIT-${permit.ontivity_project_number}.pdf`;
    downloadPDF(mergedPdfBlob, filename);
  };

  const handleClosePermit = async () => {
    if (!permit) return;
    setActionInProgress(true);

    try {
      const closedByName = userName || 'System Admin';

      const { error: updateError } = await supabase
        .from('permits')
        .update({
          current_stage: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: closedByName,
          close_notes: closeNotes.trim() || null,
        })
        .eq('id', permitId);

      if (updateError) throw updateError;

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'Closed',
          performed_by: closedByName,
          notes: closeNotes.trim() || 'Permit closed',
        },
      ]);

      const closeUrl = 'https://default3596b7c39b4b4ef89dde39825373af.28.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/d415d1c1a7af494cbd91ce5781625b02/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=hN8HtZumzbycXvEqLOARRhcDWPk1uKNAHaEva9H-IJE';

      const payload = {
        timing_id: permitId,
        unique_id: permit.permit_id,
        action: 'closed',
        current_stage: 'closed',
        status: 'closed',
        submitted_by: permit.requestor,
        submitted_by_email: permit.requester_email || '',
        requestor: permit.requestor,
        requester_type: permit.requester_type || '',
        ontivity_project_number: permit.ontivity_project_number,
        performing_entity: permit.performing_entity,
        date_of_request: permit.date_of_request,
        date_of_project_commencement: permit.date_of_project_commencement,
        estimated_date_of_completion: permit.estimated_date_of_completion || '',
        type_of_permit: permit.type_of_permit,
        utility_provider: permit.utility_provider || '',
        state: permit.state,
        permit_jurisdiction: permit.permit_jurisdiction || permit.state,
        land_owner: permit.land_owner,
        tower_owner: permit.tower_owner,
        end_customer: permit.end_customer,
        project_value: permit.project_value,
        detailed_sow: permit.detailed_sow,
        actual_date_of_completion: permit.actual_date_of_completion || '',
        permit_validity: permit.permit_validity || '',
        closed_by: closedByName,
        closed_at: new Date().toISOString(),
        close_notes: closeNotes.trim() || '',
        approved_by: permit.approved_by || '',
        qp_name: permit.qp_name || '',
        qp_email: permit.qp_email || '',
        approver_name: permit.approver_name || '',
        approver_email: permit.approver_email || '',
        signed_pdf_url: permit.signed_pdf_url || '',
      };

      try {
        await fetch(closeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (flowError) {
        console.error('Error sending to Power Automate:', flowError);
      }

      setShowCloseModal(false);
      setCloseNotes('');
      await fetchPermitDetails();

      setSuccessMessage('Permit closed successfully');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('Error closing permit:', error);
      alert('Error closing permit. Please try again.');
    } finally {
      setActionInProgress(false);
    }
  };

  const validateDateFormat = (dateStr: string): boolean => {
    if (!dateStr) return true;
    const regex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
    return regex.test(dateStr);
  };

  const handleSavePermitValidity = async () => {
    if (!permit) return;

    if (permit.current_stage === 'closed') {
      alert('Cannot update permit validity for closed permits.');
      return;
    }

    if (sidebarPermitValidity && !validateDateFormat(sidebarPermitValidity)) {
      alert('Please enter a valid date in MM/DD/YYYY format');
      return;
    }

    setSavingPermitValidity(true);

    try {
      const { error: updateError } = await supabase
        .from('permits')
        .update({ permit_validity: sidebarPermitValidity || null })
        .eq('id', permitId);

      if (updateError) throw updateError;

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'Permit Validity Updated',
          performed_by: userName || 'System User',
          notes: sidebarPermitValidity ? `Permit validity set to ${sidebarPermitValidity}` : 'Permit validity cleared',
        },
      ]);

      const powerAutomateUrl = 'https://default3596b7c39b4b4ef89dde39825373af.28.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/c9bb3dc15bc34e1681cdcdda36db4cee/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=XflS1U3z0zJ8icT07Wzj8nTU2o0VIG0xnbt92ohpfZI';

      const payload = {
        permit_id: permit.permit_id,
        timing_id: permitId,
        unique_id: permit.permit_id,
        action: 'permit_validity_updated',
        permit_validity: sidebarPermitValidity || '',
      };

      try {
        await fetch(powerAutomateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (flowError) {
        console.error('Error sending permit validity update to Power Automate:', flowError);
      }

      await fetchPermitDetails();

      setSuccessMessage('Permit validity updated successfully');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('Error updating permit validity:', error);
      alert('Error updating permit validity. Please try again.');
    } finally {
      setSavingPermitValidity(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'awaiting_qp':
      case 'awaiting_approver':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected_by_qp':
      case 'rejected_by_approver':
        return 'bg-red-100 text-red-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      case 'draft':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusDisplay = (stage: string) => {
    switch (stage) {
      case 'awaiting_qp':
        return 'Awaiting QP';
      case 'awaiting_approver':
        return 'Awaiting Approver';
      case 'rejected_by_qp':
        return 'Rejected by QP';
      case 'rejected_by_approver':
        return 'Rejected by Approver';
      case 'approved':
        return 'Approved';
      case 'closed':
        return 'Closed';
      case 'draft':
        return 'Draft';
      default:
        return stage;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen w-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-[#0072BC] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading permit details...</p>
        </div>
      </div>
    );
  }

  if (!permit) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Permit not found</p>
          <button
            onClick={() => onNavigate('list')}
            className="text-[#0072BC] hover:underline"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 p-8 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <img src="/image_(6).png" alt="Ontivity Logo" className="h-16 w-auto" />
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('new')}
              className="flex items-center gap-2 px-4 py-2 bg-[#0072BC] text-white rounded-lg hover:bg-[#005a94] transition-colors"
            >
              <PlusCircle size={18} />
              New Form
            </button>
          </div>
        </div>

        {permit.rejection_notes && (
          <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-lg mb-6">
            <div className="flex items-start">
              <XCircle className="text-red-500 mt-0.5 mr-3 flex-shrink-0" size={24} />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-900 mb-2">
                  Permit Rejected
                </h3>
                <p className="text-red-800 font-medium mb-1">Rejection Reason:</p>
                <p className="text-red-700">{permit.rejection_notes}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-200 flex justify-between items-start">
            <div>
              <p className="text-xl font-semibold text-gray-900">Project: {permit.ontivity_project_number}</p>
              {readOnlyMode && (
                <p className="text-sm text-green-600 mt-2 font-medium">Form sent to SharePoint</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusBadgeClass(permit.current_stage)}`}>
                {getStatusDisplay(permit.current_stage)}
              </span>
              {!readOnlyMode && permissions.canEdit && (((permit.current_stage === 'rejected_by_qp' || permit.current_stage === 'rejected_by_approver') && !isEditMode) || ((permit.current_stage === 'awaiting_qp' || permit.current_stage === 'awaiting_approver') && permit.rejection_notes && !isEditMode)) && (
                <button
                  onClick={() => {
                    if (!permissions.canEdit) {
                      alert('You do not have permission to edit this permit.');
                      return;
                    }
                    setIsEditMode(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0072BC] text-white rounded-lg hover:bg-[#005a94] transition-colors"
                >
                  <Edit2 size={18} />
                  Edit
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {!isEditMode ? (
                  <>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h2>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Requestor</p>
                          <p className="text-gray-900 font-medium">{permit.requestor}</p>
                        </div>
                        {permit.requester_type && (
                          <div>
                            <p className="text-sm text-gray-500">Requester Type</p>
                            <p className="text-gray-900 font-medium">{permit.requester_type}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-gray-500">Performing Entity</p>
                          <p className="text-gray-900 font-medium">{permit.performing_entity}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Project Commencement</p>
                          <p className="text-gray-900 font-medium">{formatDate(permit.date_of_project_commencement)}</p>
                        </div>
                        {permit.estimated_date_of_completion && (
                          <div>
                            <p className="text-sm text-gray-500">Estimated Completion</p>
                            <p className="text-gray-900 font-medium">{formatDate(permit.estimated_date_of_completion)}</p>
                          </div>
                        )}
                        {permit.actual_date_of_completion && (
                          <div>
                            <p className="text-sm text-gray-500">Actual Completion</p>
                            <p className="text-gray-900 font-medium">{formatDate(permit.actual_date_of_completion)}</p>
                          </div>
                        )}
                        {permit.permit_validity && (
                          <div>
                            <p className="text-sm text-gray-500">Permit Validity</p>
                            <p className="text-gray-900 font-medium">{formatDate(permit.permit_validity)}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Permit Details</h2>
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Jurisdiction Type</p>
                            <p className="text-gray-900 font-medium">{permit.permit_jurisdiction_type || 'State'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Type of Permit</p>
                            <p className="text-gray-900 font-medium">{permit.type_of_permit}</p>
                          </div>
                          {permit.utility_provider && (
                            <div>
                              <p className="text-sm text-gray-500">Utility Provider</p>
                              <p className="text-gray-900 font-medium">{permit.utility_provider}</p>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">State</p>
                            <p className="text-gray-900 font-medium">{permit.state}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Jurisdiction</p>
                            <p className="text-gray-900 font-medium">{permit.permit_jurisdiction || permit.state}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Land Owner (if applicable)</p>
                            <p className="text-gray-900 font-medium">{permit.land_owner || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Tower Owner</p>
                            <p className="text-gray-900 font-medium">{permit.tower_owner}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">End Customer</p>
                            <p className="text-gray-900 font-medium">{permit.end_customer}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Project Value</p>
                            <p className="text-gray-900 font-medium">{formatCurrency(permit.project_value)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Scope of Work</h2>
                      <p className="text-gray-700 whitespace-pre-wrap">{permit.detailed_sow}</p>
                    </div>
                  </>
                ) : (
                  <>
                    {editValidationError && (
                      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-red-800 mb-1">Required Field Missing</h3>
                          <p className="text-sm text-red-700">{editValidationError}</p>
                        </div>
                        <button type="button" onClick={() => setEditValidationError(null)} className="flex-shrink-0 text-red-400 hover:text-red-600">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    )}

                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Requestor <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={permit.requestor}
                            readOnly
                            disabled
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Requester Type <span className="text-red-500">*</span>
                          </label>
                          <select
                            name="requester_type"
                            value={editFormData?.requester_type || ''}
                            onChange={handleEditInputChange}
                            required
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                          >
                            <option value="">Select requester type</option>
                            <option value="Project Manager">Project Manager</option>
                            <option value="Construction Manager">Construction Manager</option>
                            <option value="Division Manager">Division Manager</option>
                            <option value="Electronic Manager">Electronic Manager</option>
                          </select>
                        </div>
                      </div>

                      <div className="border-t border-gray-200 pt-4 pb-4">
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Permit Level <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-6">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="editPermitLevel"
                              value="State"
                              checked={editPermitLevel === 'State'}
                              onChange={() => handleEditPermitLevelChange('State')}
                              className="w-4 h-4 text-[#0072BC] border-gray-300 focus:ring-[#0072BC]"
                            />
                            <span className="text-sm font-medium text-gray-700">State</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="editPermitLevel"
                              value="CountyCity"
                              checked={editPermitLevel === 'CountyCity'}
                              onChange={() => handleEditPermitLevelChange('CountyCity')}
                              className="w-4 h-4 text-[#0072BC] border-gray-300 focus:ring-[#0072BC]"
                            />
                            <span className="text-sm font-medium text-gray-700">County / City</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Ontivity Project Number <span className="text-red-500">*</span>
                          </label>
                          <SearchableDropdown
                            name="ontivity_project_number"
                            value={editFormData?.ontivity_project_number || ''}
                            onChange={(value) => setEditFormData((prev: any) => ({ ...prev, ontivity_project_number: value }))}
                            onSelect={(value) => setEditSelectedJobTitle(value)}
                            options={jobs}
                            placeholder="Search projects..."
                            required
                            loading={jobsLoading}
                          />
                          <p className="text-[10px] text-gray-500 mt-0.5">Values from All Division Jobs</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                            Performing Entity <span className="text-red-500">*</span>
                            {editPerformingEntityLocked && <Lock size={12} className="text-gray-500" />}
                            {editJobDetailsLoading && <Loader2 size={12} className="text-blue-500 animate-spin" />}
                          </label>
                          {editPerformingEntityLocked ? (
                            <input
                              type="text"
                              value={editFormData?.performing_entity || ''}
                              readOnly
                              required
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                            />
                          ) : (
                            <select
                              name="performing_entity"
                              value={editFormData?.performing_entity || ''}
                              onChange={handleEditInputChange}
                              required
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                            >
                              <option value="">Select entity</option>
                              <option value="ETT">ETT</option>
                              <option value="CMS">CMS</option>
                              <option value="ETR">ETR</option>
                              <option value="LEG">LEG</option>
                              <option value="MW">MW</option>
                              <option value="ONT">ONT</option>
                            </select>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Date of Project Commencement <span className="text-red-500">*</span>
                          </label>
                          <DateInput
                            name="date_of_project_commencement"
                            value={editFormData?.date_of_project_commencement || ''}
                            onChange={handleEditDateChange}
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Estimated Date of Completion <span className="text-red-500">*</span>
                          </label>
                          <DateInput
                            name="estimated_date_of_completion"
                            value={editFormData?.estimated_date_of_completion || ''}
                            onChange={handleEditDateChange}
                            required
                          />
                        </div>

                        <div className={`${!editFormData?.performing_entity ? 'opacity-50 pointer-events-none' : ''}`}>
                          <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                            Type of Permit <span className="text-red-500">*</span>
                            {!editFormData?.performing_entity && <Lock size={12} className="text-gray-400" />}
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              disabled={!editFormData?.performing_entity}
                              onClick={() => handleEditPermitTypeChange('General')}
                              className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${editPermitType === 'General' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
                            >
                              General Permit
                            </button>
                            <button
                              type="button"
                              disabled={!editFormData?.performing_entity}
                              onClick={() => handleEditPermitTypeChange('Electrical')}
                              className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${editPermitType === 'Electrical' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
                            >
                              Electrical Permit
                            </button>
                            <button
                              type="button"
                              disabled={!editFormData?.performing_entity}
                              onClick={() => handleEditPermitTypeChange('Specialty')}
                              className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${editPermitType === 'Specialty' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
                            >
                              Specialty Permit
                            </button>
                          </div>
                        </div>

                        {editPermitType === 'Electrical' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Utility Provider <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              name="utility_provider"
                              value={editFormData?.utility_provider || ''}
                              onChange={handleEditInputChange}
                              required
                              placeholder="e.g., Pacific Gas & Electric"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className={`${!editPermitType ? 'opacity-50 pointer-events-none' : ''}`}>
                          <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                            State <span className="text-red-500">*</span>
                            {!editPermitType && <Lock size={12} className="text-gray-400" />}
                            {editStatesLoading && <Loader2 size={12} className="text-blue-500 animate-spin" />}
                          </label>
                          <SearchableDropdown
                            name="state"
                            value={editSelectedState || ''}
                            onChange={(value) => {
                              setEditSelectedState(value);
                              setEditFormData((prev: any) => ({ ...prev, state: value }));
                            }}
                            options={editAvailableStates.length > 0 ? editAvailableStates : (editSelectedState ? [editSelectedState] : [])}
                            placeholder="Select state..."
                            required
                            loading={editStatesLoading}
                            disabled={!editPermitType}
                          />
                          {editStatesError && editAvailableStates.length === 0 && (
                            <p className="text-[10px] text-amber-600 mt-1">{editStatesError}</p>
                          )}
                        </div>

                        {editPermitLevel === 'CountyCity' && editSelectedState && (
                          <div className={`${editCountiesLoading ? 'opacity-50' : ''}`}>
                            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                              County / City <span className="text-red-500">*</span>
                              {editCountiesLoading && <Loader2 size={12} className="text-blue-500 animate-spin" />}
                            </label>
                            <SearchableDropdown
                              name="county_city"
                              value={editSelectedCountyCityTitle || ''}
                              onChange={(value) => setEditSelectedCountyCityTitle(value)}
                              options={editAvailableCountyCities.map(opt => opt.title)}
                              placeholder="Select county/city..."
                              required
                              loading={editCountiesLoading}
                            />
                          </div>
                        )}

                        {editSelectedState && (editPermitLevel === 'State' || (editPermitLevel === 'CountyCity' && editSelectedCountyCityTitle)) && (
                          <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                                  QP Name
                                  {editQpLoading && <Loader2 size={12} className="text-blue-500 animate-spin" />}
                                </label>
                                <input
                                  type="text"
                                  value={editQpName || (editQpLoading ? 'Loading...' : '')}
                                  readOnly
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-600 cursor-not-allowed"
                                />
                                {!editQpName && !editQpLoading && (
                                  <p className="text-[10px] text-amber-600 mt-1">QP unavailable — contact admin</p>
                                )}
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Approver <span className="text-red-500">*</span>
                                </label>
                                <SearchableDropdown
                                  name="approverName"
                                  options={approvers.map((a) => a.fullName)}
                                  value={editApproverName}
                                  onChange={(val) => {
                                    setEditApproverName(val);
                                    const approver = approvers.find((a) => a.fullName === val);
                                    setEditSelectedApprover(approver || null);
                                  }}
                                  placeholder="Search for an approver..."
                                  required
                                  loading={loadingApprovers}
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-300">
                              <div>
                                <span className="text-xs font-medium text-gray-700">Send request to QP</span>
                                <p className="text-[10px] text-gray-500">Notify the Qualified Person about this permit request</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const newValue = !editSendRequestToQp;
                                  setEditSendRequestToQp(newValue);
                                  if (!newValue) setEditSendToQpForSignature(false);
                                }}
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0072BC] focus:ring-offset-1 ${editSendRequestToQp ? 'bg-[#0072BC]' : 'bg-gray-300'}`}
                              >
                                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${editSendRequestToQp ? 'translate-x-4' : 'translate-x-0'}`} />
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Land Owner (if applicable)
                            </label>
                            <input
                              type="text"
                              name="land_owner"
                              value={editFormData?.land_owner || ''}
                              onChange={handleEditInputChange}
                              placeholder="e.g., SBA, CCI, ATC"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Tower Owner <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              name="tower_owner"
                              value={editFormData?.tower_owner || ''}
                              onChange={handleEditInputChange}
                              required
                              placeholder="e.g., American Tower"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                              End Customer <span className="text-red-500">*</span>
                              {editJobDetailsLoading && <Loader2 size={12} className="text-blue-500 animate-spin" />}
                            </label>
                            <input
                              type="text"
                              name="end_customer"
                              value={editFormData?.end_customer || ''}
                              onChange={handleEditInputChange}
                              required
                              placeholder="Customer name"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Project Value <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
                              <input
                                type="number"
                                name="project_value"
                                value={editFormData?.project_value || ''}
                                onChange={handleEditInputChange}
                                required
                                placeholder="0.00"
                                step="0.01"
                                className="w-full pl-6 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Actual Date of Project Completion</label>
                            <DateInput
                              name="actual_date_of_completion"
                              value={editFormData?.actual_date_of_completion || ''}
                              onChange={handleEditDateChange}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Permit Validity</label>
                            <DateInput
                              name="permit_validity"
                              value={editFormData?.permit_validity || ''}
                              onChange={handleEditDateChange}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Detailed Scope of Work <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            name="detailed_sow"
                            value={editFormData?.detailed_sow || ''}
                            onChange={handleEditInputChange}
                            required
                            rows={4}
                            placeholder="Provide detailed description of the work to be performed..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div className="border border-gray-200 rounded-md p-5 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className={`${editShowDocumentError ? 'ring-2 ring-red-500' : ''} bg-white rounded-md p-4`}>
                            <label className="block text-sm font-semibold text-gray-900 mb-1">
                              Permit Application <span className="text-red-500">*</span>
                            </label>
                            {(() => {
                              const existingDoc = getMostRecentToSignDocument();
                              const docUrl = permit?.original_document_url || existingDoc?.file_url;
                              const docName = existingDoc?.file_name || 'Permit Application';

                              if (editDocumentToSign) {
                                return (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setPreviewDocument({
                                        url: URL.createObjectURL(editDocumentToSign),
                                        name: editDocumentToSign.name,
                                        type: 'application/pdf'
                                      })}
                                      className="flex items-center gap-3 p-3 border-2 border-blue-300 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left w-full"
                                    >
                                      <FileText size={20} className="text-blue-600" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{editDocumentToSign.name}</p>
                                        <p className="text-xs text-blue-700">New document - {(editDocumentToSign.size / 1024).toFixed(1)} KB</p>
                                      </div>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleEditRemoveDocumentToSign}
                                      className="mt-2 text-xs text-red-600 hover:text-red-800 font-medium"
                                    >
                                      Cancel replacement
                                    </button>
                                  </>
                                );
                              }

                              if (docUrl) {
                                return (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setPreviewDocument({
                                        url: docUrl,
                                        name: docName,
                                        type: 'application/pdf'
                                      })}
                                      className="flex items-center gap-3 p-3 border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors text-left w-full"
                                    >
                                      <FileText size={20} className="text-amber-600" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{docName}</p>
                                        <p className="text-xs text-amber-700">Current document</p>
                                      </div>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setShowReplaceDocumentModal(true)}
                                      className="mt-2 text-xs text-[#0072BC] hover:text-[#005a94] font-medium"
                                    >
                                      Replace document
                                    </button>
                                  </>
                                );
                              }

                              return (
                                <label className={`flex items-center gap-2 px-3 py-2.5 border border-dashed rounded cursor-pointer transition-colors ${editShowDocumentError ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                                  <Upload size={16} className={editShowDocumentError ? 'text-red-500' : 'text-gray-400'} />
                                  <span className={`text-xs ${editShowDocumentError ? 'text-red-600' : 'text-gray-600'}`}>
                                    Upload PDF
                                  </span>
                                  <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => {
                                      handleEditDocumentToSignChange(e);
                                      setEditShowDocumentError(false);
                                    }}
                                    className="hidden"
                                  />
                                </label>
                              );
                            })()}
                            {editShowDocumentError && !editDocumentToSign && !getMostRecentToSignDocument() && (
                              <p className="text-[10px] text-red-600 mt-1">Required field</p>
                            )}

                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id="editRequiresSignature"
                                  checked={editRequiresSignature}
                                  onChange={(e) => {
                                    setEditRequiresSignature(e.target.checked);
                                    if (!e.target.checked) {
                                      setEditSendToQpForSignature(false);
                                      setEditSendToApproverForSignature(false);
                                    }
                                  }}
                                  className="w-3.5 h-3.5 text-[#0072BC] border-gray-300 rounded focus:ring-[#0072BC]"
                                />
                                <div>
                                  <label htmlFor="editRequiresSignature" className="text-[11px] text-gray-700 cursor-pointer leading-none">
                                    Require Signature
                                  </label>
                                  <p className="text-[10px] text-gray-500 mt-0.5">Enables digital signature functionality.</p>
                                </div>
                              </div>

                              {editRequiresSignature && (
                                <div className={`mt-2 ml-5 space-y-1.5 ${editShowSignatureError ? 'text-red-700' : ''}`}>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      id="editSendToQpForSignature"
                                      checked={editSendToQpForSignature}
                                      disabled={!editSendRequestToQp}
                                      onChange={(e) => {
                                        setEditSendToQpForSignature(e.target.checked);
                                        setEditShowSignatureError(false);
                                      }}
                                      className={`w-3 h-3 text-[#0072BC] border-gray-300 rounded focus:ring-[#0072BC] ${!editSendRequestToQp ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    />
                                    <label htmlFor="editSendToQpForSignature" className={`text-[10px] cursor-pointer ${!editSendRequestToQp ? 'text-gray-400' : 'text-gray-600'}`}>
                                      Qualified Person
                                    </label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      id="editSendToApproverForSignature"
                                      checked={editSendToApproverForSignature}
                                      onChange={(e) => {
                                        setEditSendToApproverForSignature(e.target.checked);
                                        setEditShowSignatureError(false);
                                      }}
                                      className="w-3 h-3 text-[#0072BC] border-gray-300 rounded focus:ring-[#0072BC]"
                                    />
                                    <label htmlFor="editSendToApproverForSignature" className="text-[10px] text-gray-600 cursor-pointer">
                                      Approver
                                    </label>
                                  </div>
                                  {editShowSignatureError && (
                                    <p className="text-[9px] text-red-600">Select at least one recipient</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-white rounded-md p-4">
                            <label className="block text-sm font-semibold text-gray-900 mb-1">
                              General Documents
                            </label>
                            <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded cursor-pointer hover:bg-gray-50 transition-colors">
                              <Upload size={16} className="text-gray-400" />
                              <span className="text-xs text-gray-600">
                                {editUploadedFiles.length > 0 ? `${editUploadedFiles.length} file(s)` : 'Upload files'}
                              </span>
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                multiple
                                onChange={handleEditFileChange}
                                className="hidden"
                              />
                            </label>
                            {editUploadedFiles.length > 0 && (
                              <div className="mt-3 space-y-1.5">
                                {editUploadedFiles.map((file, index) => (
                                  <div key={index} className="flex items-center justify-between text-[10px] text-gray-600">
                                    <span className="truncate flex-1">{file.name}</span>
                                    <button type="button" onClick={() => handleEditRemoveFile(index)} className="text-red-600 hover:text-red-800 font-medium ml-2">Remove</button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-[10px] font-medium text-gray-700 mb-1">Required for permit compliance:</p>
                              <ul className="text-[9px] text-gray-500 space-y-0.5 list-disc list-inside">
                                <li>Pre photos of area that work is being performed</li>
                                <li>Photos of identification signs at entrance</li>
                                <li>Photos of work in progress</li>
                                <li>Photos of work area upon completion</li>
                                <li>Photo of permit and passed inspection</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>

                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Permit Application</h3>
                    {(() => {
                      const permitDoc = getMostRecentToSignDocument();
                      const isSigned = !!permit.signed_document_url;
                      const docUrl = isSigned ? permit.signed_document_url! : permitDoc?.file_url;
                      const docName = permitDoc?.file_name || 'Permit Application';

                      if (docUrl) {
                        return (
                          <button
                            onClick={() => setPreviewDocument({
                              url: docUrl,
                              name: isSigned ? `${docName} (Signed)` : docName,
                              type: 'application/pdf'
                            })}
                            className={`flex items-center gap-3 p-3 border-2 rounded-lg transition-colors text-left w-full ${
                              isSigned
                                ? 'border-green-300 bg-green-50 hover:bg-green-100'
                                : 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                            }`}
                          >
                            <FileText size={20} className={isSigned ? 'text-green-600' : 'text-amber-600'} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{docName}</p>
                              <p className={`text-xs ${isSigned ? 'text-green-700' : 'text-amber-700'}`}>
                                {isSigned ? 'Signed' : 'Awaiting signature'}
                              </p>
                            </div>
                            {isSigned && (
                              <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                            )}
                          </button>
                        );
                      }

                      return (
                        <p className="text-sm text-gray-500 italic">No permit application document uploaded</p>
                      );
                    })()}
                  </div>

                  {documents.filter(doc => doc.document_type !== 'to_sign' && doc.document_type !== 'signed').length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">General Documents</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {documents.filter(doc => doc.document_type !== 'to_sign' && doc.document_type !== 'signed').map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => setPreviewDocument({
                              url: doc.file_url,
                              name: doc.file_name,
                              type: doc.file_name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
                            })}
                            className={`flex items-center gap-3 p-3 border rounded-lg transition-colors text-left w-full ${
                              doc.uploaded_after_approval
                                ? 'border-green-200 bg-green-50 hover:bg-green-100'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <Eye size={20} className={doc.uploaded_after_approval ? 'text-green-600' : 'text-[#0072BC]'} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                              <p className={`text-xs ${doc.uploaded_after_approval ? 'text-green-700' : 'text-gray-500'}`}>
                                {doc.uploaded_after_approval ? 'Uploaded after approval' : 'Uploaded document'}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {documents.length === 0 && (
                    <p className="text-sm text-gray-500 italic mt-2">No documents available</p>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                {permit.current_stage && (permit.current_stage === 'awaiting_qp' || permit.current_stage === 'awaiting_approver') && (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <User size={18} className="text-blue-600" />
                      <h3 className="text-sm font-semibold text-blue-900">
                        {permit.current_stage === 'awaiting_qp' ? 'Awaiting QP Review' : 'Awaiting Approver Review'}
                      </h3>
                    </div>
                    <div className="text-sm text-blue-800">
                      {permit.current_stage === 'awaiting_qp' ? (
                        <p><span className="font-medium">QP:</span> {permit.qp_name || 'Not assigned'}</p>
                      ) : (
                        <p><span className="font-medium">Approver:</span> {permit.approver_name || 'Not assigned'}</p>
                      )}
                    </div>
                    {permit.is_qp_signature_required && permit.current_stage === 'awaiting_qp' && (
                      <p className="text-xs text-blue-700 mt-2">QP signature required</p>
                    )}
                    {permit.is_approver_signature_required && permit.current_stage === 'awaiting_approver' && (
                      <p className="text-xs text-blue-700 mt-2">Approver signature required</p>
                    )}
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Permit Validity</h2>
                  {permit.current_stage === 'closed' ? (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Valid Until</p>
                      <p className="text-gray-900 font-medium">
                        {permit.permit_validity ? formatDate(permit.permit_validity) : 'Not set'}
                      </p>
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <Lock size={12} />
                        Permit is closed - validity cannot be changed
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Valid Until (MM/DD/YYYY)</label>
                        <input
                          type="text"
                          value={sidebarPermitValidity}
                          onChange={(e) => setSidebarPermitValidity(e.target.value)}
                          placeholder="MM/DD/YYYY"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                        />
                      </div>
                      <button
                        onClick={handleSavePermitValidity}
                        disabled={savingPermitValidity || sidebarPermitValidity === (permit.permit_validity || '')}
                        className="w-full flex items-center justify-center gap-2 bg-[#0072BC] text-white px-4 py-2 rounded-lg hover:bg-[#005a94] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingPermitValidity ? (
                          <>
                            <Loader2 className="animate-spin" size={16} />
                            Saving...
                          </>
                        ) : (
                          'Confirm Permit Validity'
                        )}
                      </button>
                      {permit.permit_validity && (
                        <p className="text-xs text-gray-500 text-center">
                          Current: {formatDate(permit.permit_validity)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {!readOnlyMode && (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>

                    {currentReviewer && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-800 font-medium">Current Reviewer</p>
                        <p className="text-xs text-blue-700 mt-1">
                          {currentReviewer.role}: {currentReviewer.name} ({currentReviewer.email})
                        </p>
                      </div>
                    )}

                    {permissions.lockReason && (
                      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                        <Lock size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-amber-800 font-medium">Access Restricted</p>
                          <p className="text-xs text-amber-700 mt-1">{permissions.lockReason}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {permit.current_stage === 'awaiting_qp' && !isEditMode && (
                        <>
                          {!permissions.canQpApprove && (
                            <div className="p-4 bg-gray-100 border border-gray-300 rounded-lg text-center">
                              <Lock size={24} className="text-gray-500 mx-auto mb-2" />
                              <p className="text-sm text-gray-700 font-medium">QP Approval Actions Locked</p>
                              <p className="text-xs text-gray-600 mt-1">
                                Only {permit.qp_name || permit.qp_email} can approve or reject at this stage
                              </p>
                            </div>
                          )}
                          {permissions.canQpApprove && (
                            <>
                              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-xs text-amber-800 font-medium">QP Review Required</p>
                                <p className="text-xs text-amber-700 mt-1">
                                  {permit.is_qp_signature_required ? 'QP must sign the document to approve' : 'QP approval needed before Division Approver'}
                                </p>
                              </div>
                              <button
                                onClick={handleQpApproveClick}
                                disabled={actionInProgress}
                                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                <CheckCircle size={18} />
                                {permit.is_qp_signature_required ? 'Sign and Approve as QP' : 'Approve as QP'}
                              </button>
                              <button
                                onClick={() => setShowQpRejectModal(true)}
                                disabled={actionInProgress}
                                className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                              >
                                <XCircle size={18} />
                                Reject as QP
                              </button>
                            </>
                          )}
                        </>
                      )}

                      {permit.current_stage === 'awaiting_approver' && !isEditMode && (
                        <>
                          {permit.qp_approved_by && (
                            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-xs text-green-800 font-medium">QP Approved</p>
                              <p className="text-xs text-green-700 mt-1">
                                Approved by {permit.qp_approved_by}
                              </p>
                            </div>
                          )}
                          {!permissions.canApproverApprove && (
                            <div className="p-4 bg-gray-100 border border-gray-300 rounded-lg text-center">
                              <Lock size={24} className="text-gray-500 mx-auto mb-2" />
                              <p className="text-sm text-gray-700 font-medium">Approver Actions Locked</p>
                              <p className="text-xs text-gray-600 mt-1">
                                Only {permit.approver_name || permit.approver_email} can approve or reject at this stage
                              </p>
                            </div>
                          )}
                          {permissions.canApproverApprove && (
                            <>
                              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-xs text-amber-800 font-medium">Division Approver Review Required</p>
                                <p className="text-xs text-amber-700 mt-1">
                                  {permit.is_approver_signature_required ? 'Approver must sign the document to approve' : 'Final approval needed to activate permit'}
                                </p>
                              </div>
                              <button
                                onClick={handleApproverApproveClick}
                                disabled={actionInProgress}
                                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                <CheckCircle size={18} />
                                {permit.is_approver_signature_required ? 'Sign and Approve' : 'Approve'}
                              </button>
                              <button
                                onClick={() => setShowApproverRejectModal(true)}
                                disabled={actionInProgress}
                                className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                              >
                                <XCircle size={18} />
                                Reject
                              </button>
                            </>
                          )}
                        </>
                      )}

                      {(permit.current_stage === 'rejected_by_qp' || permit.current_stage === 'rejected_by_approver') && isEditMode && (
                        <>
                          <button
                            onClick={handleResubmitClick}
                            disabled={actionInProgress}
                            className="w-full flex items-center justify-center gap-2 bg-[#0072BC] text-white px-4 py-2 rounded-lg hover:bg-[#005a94] transition-colors disabled:opacity-50"
                          >
                            Resubmit
                          </button>
                          <button
                            onClick={() => setIsEditMode(false)}
                            className="w-full flex items-center justify-center gap-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                          >
                            Cancel Edit
                          </button>
                        </>
                      )}
                    </div>

                    {permit.current_stage === 'approved' && (
                      <div className="mt-4 pt-4 border-t border-gray-300 space-y-3">
                        {sharePointUploading && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center justify-center gap-3">
                              <Loader2 className="animate-spin text-blue-600" size={20} />
                              <span className="text-sm text-blue-700 font-medium">Uploading to SharePoint...</span>
                            </div>
                          </div>
                        )}

                        {sharePointUploadFailed && !sharePointUploading && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="text-center">
                              <p className="text-sm text-red-700 font-medium mb-2">
                                {sharePointRetryCount >= 2 ? 'Upload failed. Contact admin.' : 'SharePoint upload failed.'}
                              </p>
                              {sharePointRetryCount < 2 && (
                                <button
                                  onClick={handleSharePointRetry}
                                  className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                                >
                                  Retry
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => setShowUploadModal(true)}
                          className="w-full flex items-center justify-center gap-2 bg-[#0072BC] text-white px-4 py-2 rounded-lg hover:bg-[#005a94] transition-colors"
                        >
                          <Upload size={18} />
                          Upload Additional Files
                        </button>
                        <p className="text-xs text-gray-600 text-center">
                          Add additional documents to this approved permit
                        </p>
                        <button
                          onClick={() => setShowCloseModal(true)}
                          disabled={actionInProgress}
                          className="w-full flex items-center justify-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                          <XCircle size={18} />
                          Close Permit
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {permit.signed_pdf_url && (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Generated Permit Form</h2>
                    <a
                      href={permit.signed_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-[#0072BC] text-white px-4 py-3 rounded-lg hover:bg-[#005a94] transition-colors font-medium"
                    >
                      <FileText size={20} />
                      Download Permit PDF
                    </a>
                  </div>
                )}

                {auditLog.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Audit Trail</h2>
                    <div className="space-y-4">
                      {auditLog.map((log, index) => (
                        <div key={log.id} className="relative">
                          {index !== auditLog.length - 1 && (
                            <div className="absolute left-2 top-8 bottom-0 w-0.5 bg-gray-300" />
                          )}
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-4 h-4 mt-1 rounded-full bg-[#0072BC]" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{log.action}</p>
                              <p className="text-xs text-gray-500">by {log.performed_by}</p>
                              {log.notes && <p className="text-xs text-gray-600 mt-1">{log.notes}</p>}
                              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                <Clock size={12} />
                                {formatDate(log.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {previewDocument && (
        <DocumentPreviewModal
          fileUrl={previewDocument.url}
          fileName={previewDocument.name}
          fileType={previewDocument.type}
          onClose={() => setPreviewDocument(null)}
        />
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Reject Permit</h2>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this permit request.
            </p>
            <textarea
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              rows={4}
              placeholder="Enter rejection notes..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionNotes('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject()}
                disabled={!rejectionNotes.trim() || actionInProgress}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Approve with Signature
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              This permit requires a signature for approval. Please draw your signature and enter your name.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Draw Your Signature <span className="text-red-500">*</span>
              </label>
              <SignaturePad ref={signaturePadRef} />
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-gray-500">Use your mouse or touchpad to sign</p>
                <button
                  type="button"
                  onClick={() => signaturePadRef.current?.clear()}
                  className="text-xs text-[#0072BC] hover:text-[#005a94] font-medium"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSignatureModal(false);
                  signaturePadRef.current?.clear();
                  setSignerName('');
                  setPendingAction(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSignatureSubmit}
                disabled={actionInProgress}
                className="px-4 py-2 bg-[#0072BC] text-white rounded-lg hover:bg-[#005a94] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve Permit
              </button>
            </div>
          </div>
        </div>
      )}

      {showRemoveDocumentModal && documentToRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="text-red-600" size={24} />
              Remove Permit Application Document
            </h2>

            <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
              <p className="text-sm font-semibold text-amber-900 mb-2">⚠️ Important Warning</p>
              <p className="text-sm text-amber-800 mb-3">
                This is the PDF permit application document. It may have been signed before removal.
                View it carefully before removing. Make sure you add a new permit application document
                because you cannot submit without it.
              </p>
              <p className="text-sm text-amber-900 font-medium">
                Document: {documentToRemove.name}
              </p>
            </div>

            <div className="flex justify-between gap-3">
              <button
                onClick={() => {
                  setPreviewDocument({
                    url: documentToRemove.url,
                    name: documentToRemove.name,
                    type: 'application/pdf'
                  });
                }}
                className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                <Eye size={18} />
                View Document
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRemoveDocumentModal(false);
                    setDocumentToRemove(null);
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveDocument}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Confirm Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReplaceDocumentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="text-amber-600" size={24} />
              Replace Document
            </h2>

            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-900">
                This is an important document. Please make sure to upload the correct replacement document.
              </p>
            </div>

            {(() => {
              const existingDoc = getMostRecentToSignDocument();
              const docUrl = permit?.original_document_url || existingDoc?.file_url;
              const docName = existingDoc?.file_name || 'Permit Application';

              return (
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-3">Current document:</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (docUrl) {
                        setPreviewDocument({
                          url: docUrl,
                          name: docName,
                          type: 'application/pdf'
                        });
                      }
                    }}
                    className="flex items-center gap-3 p-3 border border-gray-200 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left w-full"
                  >
                    <FileText size={20} className="text-gray-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{docName}</p>
                      <p className="text-xs text-gray-500">Click to preview</p>
                    </div>
                    <Eye size={16} className="text-gray-400" />
                  </button>
                </div>
              );
            })()}

            <div className="flex flex-col gap-3">
              <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-[#0072BC] rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                <Upload size={24} className="text-[#0072BC]" />
                <span className="text-sm font-medium text-[#0072BC]">Select New Document</span>
                <span className="text-xs text-gray-500">PDF files only</span>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    handleEditDocumentToSignChange(e);
                    setEditShowDocumentError(false);
                    setShowReplaceDocumentModal(false);
                  }}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => setShowReplaceDocumentModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showResubmitConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="text-yellow-600" size={24} />
              Confirm Resubmission
            </h2>

            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-semibold text-red-900 mb-2">Previous Rejection Note:</p>
              <p className="text-sm text-red-800">{permit?.rejection_notes}</p>
            </div>

            <p className="text-gray-700 mb-6">
              Are you sure you have addressed all the changes mentioned in the rejection note?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResubmitConfirmModal(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResubmit}
                disabled={actionInProgress}
                className="px-6 py-2 bg-[#0072BC] text-white rounded-lg hover:bg-[#005a94] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes, Resubmit
              </button>
            </div>
          </div>
        </div>
      )}

      {actionInProgress && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-10 max-w-sm w-full mx-4 text-center">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-[#0072BC] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-900 font-medium text-lg mb-2">Processing...</p>
            <p className="text-gray-600 text-sm">Please wait while we process your request</p>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Additional Files</h2>
            <p className="text-sm text-gray-600 mb-4">
              Upload additional documents for this approved permit. These files will be tracked separately and can be synced to SharePoint.
            </p>

            <div className="border border-gray-200 rounded-md p-4 mb-4">
              <label className="flex flex-col items-center justify-center gap-2 px-3 py-5 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                <Upload size={24} className="text-gray-400" />
                <div className="text-center">
                  <span className="text-sm font-medium text-gray-700">Choose Files</span>
                  <p className="text-xs text-gray-500 mt-0.5">Select multiple images or PDFs</p>
                </div>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  onChange={handleAdditionalFilesChange}
                  className="hidden"
                />
              </label>

              {additionalFiles.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Selected Files ({additionalFiles.length})
                  </p>
                  <div className="space-y-2">
                    {additionalFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-md"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText size={16} className="text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700 truncate">{file.name}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAdditionalFile(index)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium ml-2 flex-shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setAdditionalFiles([]);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadAdditionalFiles}
                disabled={additionalFiles.length === 0 || uploadingFiles}
                className="px-4 py-2 bg-[#0072BC] text-white rounded-lg hover:bg-[#005a94] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingFiles ? 'Sending to SharePoint...' : 'Send to SharePoint'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCloseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Close Permit</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to close this permit? This action marks the permit as completed.
            </p>
            <textarea
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              rows={3}
              placeholder="Add closing notes (optional)..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCloseModal(false);
                  setCloseNotes('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClosePermit}
                disabled={actionInProgress}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showPdfSignModal && pdfToSign && (
        <PdfSigningModal
          pdfUrl={pdfToSign.url}
          pdfName={pdfToSign.name}
          signerName={currentApprovalAction === 'qp' ? (permit?.qp_name || userName || 'QP') : (permit?.approver_name || userName || 'Approver')}
          onClose={() => {
            setShowPdfSignModal(false);
            setPdfToSign(null);
            setSignaturePosition(null);
            setCurrentApprovalAction(null);
          }}
          onApprove={handlePdfSigningApprove}
        />
      )}

      {showQpRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Reject as QP</h2>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this permit request.
            </p>
            <textarea
              value={qpRejectionNotes}
              onChange={(e) => setQpRejectionNotes(e.target.value)}
              rows={4}
              placeholder="Enter rejection notes..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowQpRejectModal(false);
                  setQpRejectionNotes('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleQpReject}
                disabled={!qpRejectionNotes.trim() || actionInProgress}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {showApproverRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Reject Permit</h2>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this permit request. The submitter will be notified to make changes and resubmit.
            </p>
            <textarea
              value={approverRejectionNotes}
              onChange={(e) => setApproverRejectionNotes(e.target.value)}
              rows={4}
              placeholder="Enter rejection notes..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowApproverRejectModal(false);
                  setApproverRejectionNotes('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApproverReject}
                disabled={!approverRejectionNotes.trim() || actionInProgress}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessToast && (
        <div className="fixed top-8 right-8 bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl flex items-center gap-3 z-50 animate-fade-in">
          <CheckCircle size={24} />
          <div>
            <p className="font-semibold">{successMessage}</p>
            <p className="text-sm text-green-100">The page will refresh automatically</p>
          </div>
        </div>
      )}
    </div>
  );
}
