import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle, XCircle, FileText, Clock, Eye, PlusCircle, CreditCard as Edit2, AlertCircle, Download, Upload } from 'lucide-react';
import { supabase, Permit, PermitDocument, PermitAuditLog } from '../lib/supabase';
import { SignaturePad, SignaturePadRef } from './SignaturePad';
import { generatePermitPDF, downloadPDF } from '../services/pdfGenerator';
import DocumentPreviewModal from './DocumentPreviewModal';
import SearchableDropdown from './SearchableDropdown';
import { useSharePointJobs } from '../hooks/useSharePointJobs';
import { US_STATES_AND_TERRITORIES } from '../utils/usStates';
import DateInput from './DateInput';
import { useAuth } from '../contexts/AuthContext';

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
  const { userName } = useAuth();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  useEffect(() => {
    fetchPermitDetails();
  }, [permitId]);

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
        county_or_parish: permit.county_or_parish || '',
        city: permit.city || '',
        property_owner: permit.property_owner || '',
        end_customer: permit.end_customer || '',
        project_value: permit.project_value?.toString() || '',
        actual_date_of_completion: permit.actual_date_of_completion || '',
        detailed_sow: permit.detailed_sow || '',
        requester_type: permit.requester_type || '',
      });
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
        .eq('permit_id', permitId);

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


  const handleApproveClick = () => {
    if (permit?.requires_signature && !permit.signature_image_url) {
      setPendingAction('approve');
      setShowSignatureModal(true);
    } else {
      handleApprove();
    }
  };

  const handleRejectClick = () => {
    setShowRejectModal(true);
  };

  const handleApprove = async (signatureData?: string) => {
    if (!permit) return;
    setActionInProgress(true);

    try {
      const updateData: any = {
        status: 'Active',
        rejection_notes: null
      };
      let pdfUrl = null;

      if (signatureData) {
        updateData.signature_image_url = signatureData;
        updateData.signed_by = signerName;
        updateData.signed_at = new Date().toISOString();
      }

      const approvalDate = new Date().toLocaleDateString();
      const approverName = signatureData ? signerName : (userName || 'System Admin');
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
        county_or_parish: permit.county_or_parish || '',
        city: permit.city || '',
        property_owner: permit.property_owner || '',
        end_customer: permit.end_customer || '',
        project_value: permit.project_value?.toString() || '0',
        actual_date_of_completion: permit.actual_date_of_completion || '',
        detailed_sow: permit.detailed_sow || '',
        requiresSignature: permit.requires_signature || false,
        signatureDataUrl: signatureData,
        status: 'Approved',
        signerName: signatureData ? signerName : undefined,
        approvedBy: approverName,
        approvedAt: approvalDate,
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
        county_or_parish: permit.county_or_parish,
        city: permit.city,
        property_owner: permit.property_owner,
        end_customer: permit.end_customer,
        project_value: permit.project_value,
        detailed_sow: permit.detailed_sow,
        status: 'approved',
        approved_by: approverName,
        approved_at: new Date().toISOString(),
        pdf_url: pdfUrl || '',
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
        status: 'Rejected',
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
        county_or_parish: permit.county_or_parish,
        city: permit.city,
        property_owner: permit.property_owner,
        end_customer: permit.end_customer,
        project_value: permit.project_value,
        detailed_sow: permit.detailed_sow,
        status: 'rejected',
        rejection_reason: rejectionNotes,
        rejected_by: 'System Admin',
        rejected_at: new Date().toISOString(),
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

    if (pendingAction === 'approve') {
      await handleApprove(signatureData);
    }
  };

  const handleResubmitClick = () => {
    setShowResubmitConfirmModal(true);
  };

  const handleResubmit = async () => {
    if (!permit || !editFormData) return;
    setActionInProgress(true);
    setShowResubmitConfirmModal(false);

    try {
      const updateData = {
        status: 'Pending Approval',
        permit_jurisdiction_type: editFormData.permit_jurisdiction_type,
        ontivity_project_number: editFormData.ontivity_project_number,
        performing_entity: editFormData.performing_entity,
        date_of_project_commencement: editFormData.date_of_project_commencement,
        estimated_date_of_completion: editFormData.estimated_date_of_completion,
        type_of_permit: editFormData.type_of_permit,
        utility_provider: editFormData.type_of_permit === 'Electrical Permit' ? editFormData.utility_provider : null,
        state: editFormData.state,
        county_or_parish: editFormData.permit_jurisdiction_type === 'County/City' ? editFormData.county_or_parish : null,
        city: editFormData.permit_jurisdiction_type === 'County/City' ? editFormData.city : null,
        property_owner: editFormData.property_owner,
        end_customer: editFormData.end_customer,
        project_value: parseFloat(editFormData.project_value) || 0,
        actual_date_of_completion: editFormData.actual_date_of_completion || null,
        detailed_sow: editFormData.detailed_sow,
        requester_type: editFormData.requester_type,
      };

      const { error: updateError } = await supabase
        .from('permits')
        .update(updateData)
        .eq('id', permitId);

      if (updateError) throw updateError;

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'Resubmitted',
          performed_by: permit.requestor,
          notes: 'Permit resubmitted for approval with updates',
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
        state: editFormData.state,
        county_or_parish: editFormData.county_or_parish,
        city: editFormData.city,
        property_owner: editFormData.property_owner,
        end_customer: editFormData.end_customer,
        project_value: parseFloat(editFormData.project_value) || 0,
        detailed_sow: editFormData.detailed_sow,
        status: 'resubmitted',
        resubmitted_by: permit.requestor,
        resubmitted_at: new Date().toISOString(),
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

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleEditDateChange = (name: string, value: string) => {
    setEditFormData((prev: any) => ({ ...prev, [name]: value }));
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

      setSuccessMessage('Files uploaded successfully');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('Error uploading additional files:', error);
      alert('Error uploading files. Please try again.');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDownloadPDF = () => {
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
      county_or_parish: permit.county_or_parish || '',
      city: permit.city || '',
      property_owner: permit.property_owner || '',
      end_customer: permit.end_customer || '',
      project_value: permit.project_value?.toString() || '0',
      actual_date_of_completion: permit.actual_date_of_completion || '',
      detailed_sow: permit.detailed_sow || '',
      requiresSignature: permit.requires_signature || false,
      signatureDataUrl: permit.signature_image_url,
      status: permit.status,
      signerName: permit.signed_by || undefined,
      approvedBy: permit.status === 'Active' ? (permit.approved_by || permit.signed_by || 'System Admin') : undefined,
      approvedAt: permit.status === 'Active' && permit.signed_at ? formatDate(permit.signed_at) : undefined,
    });

    const filename = `PERMIT-${permit.ontivity_project_number}.pdf`;
    downloadPDF(pdfBlob, filename);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Pending Approval':
        return 'bg-yellow-100 text-yellow-800';
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      case 'Closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Download size={18} />
              Download PDF
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
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusBadgeClass(permit.status)}`}>
                {permit.status}
              </span>
              {!readOnlyMode && ((permit.status === 'Rejected' && !isEditMode) || (permit.status === 'Pending Approval' && permit.rejection_notes && !isEditMode)) && (
                <button
                  onClick={() => setIsEditMode(true)}
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
                        <div className={`grid ${(permit.permit_jurisdiction_type === 'County/City' || !permit.permit_jurisdiction_type) ? 'grid-cols-3' : 'grid-cols-1'} gap-4`}>
                          <div>
                            <p className="text-sm text-gray-500">State</p>
                            <p className="text-gray-900 font-medium">{permit.state}</p>
                          </div>
                          {(permit.permit_jurisdiction_type === 'County/City' || !permit.permit_jurisdiction_type) && (
                            <>
                              <div>
                                <p className="text-sm text-gray-500">County/Parish</p>
                                <p className="text-gray-900 font-medium">{permit.county_or_parish}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">City</p>
                                <p className="text-gray-900 font-medium">{permit.city}</p>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Property Owner</p>
                            <p className="text-gray-900 font-medium">{permit.property_owner}</p>
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
                    <div>
                      <div className="flex items-center mb-6 pb-4 border-b border-gray-200">
                        <img src="/image_(6).png" alt="Ontivity Logo" className="h-12 w-auto" />
                      </div>

                      <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                        Project Information
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Requestor <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={permit.requestor}
                            readOnly
                            disabled
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Requester Type <span className="text-red-500">*</span>
                          </label>
                          <select
                            name="requester_type"
                            value={editFormData?.requester_type || ''}
                            onChange={handleEditInputChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                          >
                            <option value="">Select requester type</option>
                            <option value="Project Manager">Project Manager</option>
                            <option value="Construction Manager">Construction Manager</option>
                            <option value="Division Manager">Division Manager</option>
                            <option value="Electronic Manager">Electronic Manager</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Date of Request <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formatDate(permit.date_of_request)}
                            readOnly
                            disabled
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="border-t border-gray-200 pt-4 pb-4 mt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Permit Jurisdiction Type <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-6">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name="permit_jurisdiction_type"
                              value="State"
                              checked={editFormData?.permit_jurisdiction_type === 'State'}
                              onChange={handleEditInputChange}
                              className="w-4 h-4 text-[#0072BC] border-gray-300 focus:ring-[#0072BC]"
                            />
                            <span className="ml-2 text-sm text-gray-700">State Permit</span>
                          </label>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name="permit_jurisdiction_type"
                              value="County/City"
                              checked={editFormData?.permit_jurisdiction_type === 'County/City'}
                              onChange={handleEditInputChange}
                              className="w-4 h-4 text-[#0072BC] border-gray-300 focus:ring-[#0072BC]"
                            />
                            <span className="ml-2 text-sm text-gray-700">County/City Permit</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ontivity Project Number <span className="text-red-500">*</span>
                          </label>
                          <SearchableDropdown
                            name="ontivity_project_number"
                            value={editFormData?.ontivity_project_number || ''}
                            onChange={(value) => setEditFormData((prev: any) => ({ ...prev, ontivity_project_number: value }))}
                            options={jobs}
                            placeholder="Search projects..."
                            required
                            loading={jobsLoading}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Performing Entity <span className="text-red-500">*</span>
                          </label>
                          <select
                            name="performing_entity"
                            value={editFormData?.performing_entity || ''}
                            onChange={handleEditInputChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                          >
                            <option value="">Select entity</option>
                            <option value="ETT">ETT</option>
                            <option value="CMS">CMS</option>
                            <option value="ETR">ETR</option>
                            <option value="LEG">LEG</option>
                            <option value="MW">MW</option>
                            <option value="ONT">ONT</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
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
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Estimated Date of Completion <span className="text-red-500">*</span>
                          </label>
                          <DateInput
                            name="estimated_date_of_completion"
                            value={editFormData?.estimated_date_of_completion || ''}
                            onChange={handleEditDateChange}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                        Permit Details
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Type of Permit <span className="text-red-500">*</span>
                          </label>
                          <select
                            name="type_of_permit"
                            value={editFormData?.type_of_permit || ''}
                            onChange={handleEditInputChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                          >
                            <option value="">Select type</option>
                            <option value="Electrical Permit">Electrical Permit</option>
                            <option value="Specialty/Tower Permit">Specialty/Tower Permit</option>
                            <option value="General Permit">General Permit</option>
                          </select>
                        </div>

                        {editFormData?.type_of_permit === 'Electrical Permit' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Utility Provider <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              name="utility_provider"
                              value={editFormData?.utility_provider || ''}
                              onChange={handleEditInputChange}
                              required
                              placeholder="e.g., Pacific Gas & Electric"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-4 mt-6">
                        <div className={`grid grid-cols-1 ${editFormData?.permit_jurisdiction_type === 'County/City' ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-4`}>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              State <span className="text-red-500">*</span>
                            </label>
                            <select
                              name="state"
                              value={editFormData?.state || ''}
                              onChange={handleEditInputChange}
                              required
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                            >
                              <option value="">Select state</option>
                              {US_STATES_AND_TERRITORIES.map((state) => (
                                <option key={state.value} value={state.label}>
                                  {state.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {editFormData?.permit_jurisdiction_type === 'County/City' && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  County <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  name="county_or_parish"
                                  value={editFormData?.county_or_parish || ''}
                                  onChange={handleEditInputChange}
                                  required
                                  placeholder="Enter county name"
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  City <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  name="city"
                                  value={editFormData?.city || ''}
                                  onChange={handleEditInputChange}
                                  required
                                  placeholder="e.g., Los Angeles"
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                                />
                              </div>
                            </>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Property Owner <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              name="property_owner"
                              value={editFormData?.property_owner || ''}
                              onChange={handleEditInputChange}
                              required
                              placeholder="e.g., SBA, CCI, ATC"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              End Customer <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              name="end_customer"
                              value={editFormData?.end_customer || ''}
                              onChange={handleEditInputChange}
                              required
                              placeholder="Customer name"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Project Value <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                              <input
                                type="number"
                                name="project_value"
                                value={editFormData?.project_value || ''}
                                onChange={handleEditInputChange}
                                required
                                placeholder="0.00"
                                step="0.01"
                                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Actual Date of Project Completion</label>
                            <DateInput
                              name="actual_date_of_completion"
                              value={editFormData?.actual_date_of_completion || ''}
                              onChange={handleEditDateChange}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Detailed Scope of Work <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          name="detailed_sow"
                          value={editFormData?.detailed_sow || ''}
                          onChange={handleEditInputChange}
                          required
                          rows={6}
                          placeholder="Provide detailed description of the work to be performed..."
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                        />
                      </div>
                    </div>
                  </>
                )}

                {documents.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>

                    {documents.filter(doc => doc.document_type === 'general' && !doc.uploaded_after_approval).length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">General Documents</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {documents.filter(doc => doc.document_type === 'general' && !doc.uploaded_after_approval).map((doc) => (
                            <button
                              key={doc.id}
                              onClick={() => setPreviewDocument({
                                url: doc.file_url,
                                name: doc.file_name,
                                type: doc.file_name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
                              })}
                              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left w-full"
                            >
                              <Eye size={20} className="text-[#0072BC]" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                                <p className="text-xs text-gray-500">Initial upload</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {documents.filter(doc => doc.document_type === 'to_sign' || doc.document_type === 'signed').length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Documents Requiring Signature</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {documents.filter(doc => doc.document_type === 'to_sign' || doc.document_type === 'signed').map((doc) => (
                            <button
                              key={doc.id}
                              onClick={() => setPreviewDocument({
                                url: doc.file_url,
                                name: doc.file_name,
                                type: doc.file_name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
                              })}
                              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left w-full"
                            >
                              <Eye size={20} className="text-[#0072BC]" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                                <p className="text-xs text-gray-500">
                                  {doc.document_type === 'signed' ? 'Signed document' : 'Awaiting signature'}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {documents.filter(doc => doc.uploaded_after_approval).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Additional Files (Post-Approval)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {documents.filter(doc => doc.uploaded_after_approval).map((doc) => (
                            <button
                              key={doc.id}
                              onClick={() => setPreviewDocument({
                                url: doc.file_url,
                                name: doc.file_name,
                                type: doc.file_name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
                              })}
                              className="flex items-center gap-3 p-3 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-left w-full"
                            >
                              <Eye size={20} className="text-[#0072BC]" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                                <p className="text-xs text-blue-700">Uploaded after approval</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {!readOnlyMode && (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>

                    {permit.requires_signature && !permit.signature_image_url && permit.status === 'Pending Approval' && (
                      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-xs text-yellow-800">
                          This permit requires a signature for approval
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {permit.status === 'Pending Approval' && !permit.rejection_notes && !isEditMode && (
                        <>
                          <button
                            onClick={handleApproveClick}
                            disabled={actionInProgress}
                            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle size={18} />
                            Approve
                          </button>
                          <button
                            onClick={handleRejectClick}
                            disabled={actionInProgress}
                            className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            <XCircle size={18} />
                            Reject
                          </button>
                        </>
                      )}
                      {permit.status === 'Pending Approval' && permit.rejection_notes && isEditMode && (
                        <>
                          <button
                            onClick={handleApproveClick}
                            disabled={actionInProgress}
                            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle size={18} />
                            Approve
                          </button>
                          <button
                            onClick={handleRejectClick}
                            disabled={actionInProgress}
                            className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            <XCircle size={18} />
                            Reject
                          </button>
                          <button
                            onClick={() => setIsEditMode(false)}
                            className="w-full flex items-center justify-center gap-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {permit.status === 'Rejected' && isEditMode && (
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

                    {permit.status === 'Active' && (
                      <div className="mt-4 pt-4 border-t border-gray-300">
                        <button
                          onClick={() => setShowUploadModal(true)}
                          className="w-full flex items-center justify-center gap-2 bg-[#0072BC] text-white px-4 py-2 rounded-lg hover:bg-[#005a94] transition-colors"
                        >
                          <Upload size={18} />
                          Upload Additional Files
                        </button>
                        <p className="text-xs text-gray-600 mt-2 text-center">
                          Add additional documents to this approved permit
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {permit.signature_image_url && (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Signature</h2>
                    <div className="space-y-2">
                      <img
                        src={permit.signature_image_url}
                        alt="Signature"
                        className="max-w-full h-auto border border-gray-300 rounded bg-white p-2"
                      />
                      <div className="text-sm text-gray-600">
                        <p>Signed by: {permit.signed_by}</p>
                        <p>Date: {permit.signed_at && formatDate(permit.signed_at)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {permit.signed_pdf_url && (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Permit Document</h2>
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
                {uploadingFiles ? 'Uploading...' : 'Upload Files'}
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
