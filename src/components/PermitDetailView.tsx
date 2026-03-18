import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle, XCircle, FileText, Clock, Eye, PlusCircle } from 'lucide-react';
import { supabase, Permit, PermitDocument, PermitAuditLog } from '../lib/supabase';
import { SignaturePad, SignaturePadRef } from './SignaturePad';
import { generatePermitPDF } from '../services/pdfGenerator';
import DocumentPreviewModal from './DocumentPreviewModal';

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

  useEffect(() => {
    fetchPermitDetails();
  }, [permitId]);

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
    if (permit?.requires_signature && !permit.signature_image_url) {
      setPendingAction('reject');
      setShowRejectModal(false);
      setShowSignatureModal(true);
    } else {
      setShowRejectModal(true);
    }
  };

  const handleApprove = async (signatureData?: string) => {
    if (!permit) return;
    setActionInProgress(true);

    try {
      const updateData: any = { status: 'Active' };
      let pdfUrl = null;

      if (signatureData) {
        updateData.signature_image_url = signatureData;
        updateData.signed_by = signerName;
        updateData.signed_at = new Date().toISOString();

        const pdfBlob = generatePermitPDF({
          projectTitle: permit.ontivity_project_number || '',
          workType: permit.type_of_permit || '',
          requesterType: permit.requester_type || '',
          requesterName: permit.requestor || '',
          requesterEmail: permit.requester_email || '',
          site: `${permit.city}, ${permit.state}`,
          dateNeeded: permit.date_of_project_commencement || '',
          expiryDate: permit.estimated_date_of_completion?.toString() || '',
          workDescription: permit.detailed_sow || '',
          safetyMeasures: '',
          requiresSignature: true,
          signatureDataUrl: signatureData,
          submitterName: signerName,
        });

        const fileName = `permit_${permit.permit_id}_signed_${Date.now()}.pdf`;
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
      }

      const { error: updateError } = await supabase
        .from('permits')
        .update(updateData)
        .eq('id', permitId);

      if (updateError) throw updateError;

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'Approved',
          performed_by: signerName || 'System Admin',
          notes: signatureData ? 'Permit approved and activated with signature' : 'Permit approved and activated',
        },
      ]);

      setShowSignatureModal(false);
      signaturePadRef.current?.clear();
      setSignerName('');
      setPendingAction(null);
      await fetchPermitDetails();
    } catch (error) {
      console.error('Error approving permit:', error);
      alert('Error approving permit. Please try again.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReject = async (signatureData?: string) => {
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

      if (signatureData) {
        updateData.signature_image_url = signatureData;
        updateData.signed_by = signerName;
        updateData.signed_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('permits')
        .update(updateData)
        .eq('id', permitId);

      if (updateError) throw updateError;

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'Rejected',
          performed_by: signerName || 'System Admin',
          notes: rejectionNotes,
        },
      ]);

      setShowRejectModal(false);
      setShowSignatureModal(false);
      setRejectionNotes('');
      signaturePadRef.current?.clear();
      setSignerName('');
      setPendingAction(null);
      await fetchPermitDetails();
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
    } else if (pendingAction === 'reject') {
      if (!rejectionNotes.trim()) {
        alert('Please provide rejection notes');
        return;
      }
      await handleReject(signatureData);
    }
  };

  const handleResubmit = async () => {
    if (!permit) return;
    setActionInProgress(true);

    try {
      const { error: updateError } = await supabase
        .from('permits')
        .update({
          status: 'Pending Approval',
          rejection_notes: null
        })
        .eq('id', permitId);

      if (updateError) throw updateError;

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'Resubmitted',
          performed_by: permit.requestor,
          notes: 'Permit resubmitted for approval',
        },
      ]);

      await fetchPermitDetails();
    } catch (error) {
      console.error('Error resubmitting permit:', error);
      alert('Error resubmitting permit. Please try again.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleClose = async () => {
    if (!permit) return;
    setActionInProgress(true);

    try {
      const { error: updateError } = await supabase
        .from('permits')
        .update({ status: 'Closed' })
        .eq('id', permitId);

      if (updateError) throw updateError;

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'Closed',
          performed_by: 'System Admin',
          notes: 'Permit closed',
        },
      ]);

      await fetchPermitDetails();
    } catch (error) {
      console.error('Error closing permit:', error);
      alert('Error closing permit. Please try again.');
    } finally {
      setActionInProgress(false);
    }
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading permit details...</div>
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
        <div className="flex justify-center mb-6">
          <img src="/OIP.webp" alt="Ontivity Logo" className="h-20 w-auto" />
        </div>
        {!readOnlyMode && (
          <button
            onClick={() => onNavigate('list')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
        )}
        {readOnlyMode && (
          <div className="mb-6">
            <button
              onClick={() => onNavigate('new')}
              className="flex items-center gap-2 bg-[#0072BC] text-white px-4 py-2 rounded-lg hover:bg-[#005a94] transition-colors"
            >
              <PlusCircle size={20} />
              Create New Permit
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-200 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{permit.permit_id}</h1>
              <p className="text-gray-600">Project: {permit.ontivity_project_number}</p>
              {readOnlyMode && (
                <p className="text-sm text-green-600 mt-2 font-medium">Form sent to SharePoint</p>
              )}
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusBadgeClass(permit.status)}`}>
              {permit.status}
            </span>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Requestor</p>
                      <p className="text-gray-900 font-medium">{permit.requestor}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Performing Entity</p>
                      <p className="text-gray-900 font-medium">{permit.performing_entity}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Date of Request</p>
                      <p className="text-gray-900 font-medium">{formatDate(permit.date_of_request)}</p>
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
                  <div className="grid grid-cols-2 gap-4">
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
                    <div>
                      <p className="text-sm text-gray-500">State</p>
                      <p className="text-gray-900 font-medium">{permit.state}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">County/Parish</p>
                      <p className="text-gray-900 font-medium">{permit.county_or_parish}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">City</p>
                      <p className="text-gray-900 font-medium">{permit.city}</p>
                    </div>
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

                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Scope of Work</h2>
                  <p className="text-gray-700 whitespace-pre-wrap">{permit.detailed_sow}</p>
                </div>

                {permit.rejection_notes && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h2 className="text-lg font-semibold text-red-900 mb-2">Rejection Notes</h2>
                    <p className="text-red-800">{permit.rejection_notes}</p>
                  </div>
                )}

                {documents.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Uploaded Documents</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {documents.map((doc) => (
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
                            <p className="text-xs text-gray-500">{doc.document_type.replace(/_/g, ' ')}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {!readOnlyMode && (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>

                    {permit.requires_signature && !permit.signature_image_url && (
                      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-xs text-yellow-800">
                          This permit requires a signature before approval/rejection
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {permit.status === 'Pending Approval' && (
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
                      {permit.status === 'Rejected' && (
                        <button
                          onClick={handleResubmit}
                          disabled={actionInProgress}
                          className="w-full flex items-center justify-center gap-2 bg-[#0072BC] text-white px-4 py-2 rounded-lg hover:bg-[#005a94] transition-colors disabled:opacity-50"
                        >
                          Resubmit
                        </button>
                      )}
                      {permit.status === 'Active' && (
                        <button
                          onClick={handleClose}
                          disabled={actionInProgress}
                          className="w-full flex items-center justify-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                          Close Permit
                        </button>
                      )}
                    </div>
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
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Signed Document</h2>
                    <a
                      href={permit.signed_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-[#0072BC] text-white px-4 py-3 rounded-lg hover:bg-[#005a94] transition-colors font-medium"
                    >
                      <FileText size={20} />
                      Download Signed PDF
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
              {pendingAction === 'approve' ? 'Approve' : 'Reject'} with Signature
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              This permit requires a signature. Please upload your signature image and enter your name.
            </p>

            {pendingAction === 'reject' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  rows={3}
                  placeholder="Enter rejection notes..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                />
              </div>
            )}

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
                  if (pendingAction === 'reject') {
                    setRejectionNotes('');
                  }
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
                {pendingAction === 'approve' ? 'Approve' : 'Reject'} Permit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
