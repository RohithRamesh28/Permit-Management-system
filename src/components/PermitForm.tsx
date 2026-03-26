import { useState, useEffect, useRef } from 'react';
import { Upload, CheckCircle, FileText, X, AlertCircle, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { SignaturePad, SignaturePadRef } from './SignaturePad';
import { generatePermitPDF, PermitFormData, downloadPDF } from '../services/pdfGenerator';
import { sendSubmissionNotification, sendApprovalNotification, sendRejectionNotification } from '../services/powerAutomate';
import SearchableDropdown from './SearchableDropdown';
import DateInput from './DateInput';
import { useApprovers, ApproverInfo } from '../hooks/useApprovers';

interface PermitFormProps {
  mode: 'submit' | 'approve' | 'rejected';
  permitId?: number;
  onNavigate: (view: string) => void;
}

interface FormData {
  projectTitle: string;
  workType: string;
  requesterName: string;
  requesterEmail: string;
  approverName: string;
  site: string;
  dateNeeded: string;
  expiryDate: string;
  workDescription: string;
  safetyMeasures: string;
  requiresSignature: boolean;
}

export default function PermitForm({ mode, permitId, onNavigate }: PermitFormProps) {
  const { account, isAuthenticated, isLoading, login } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    projectTitle: '',
    workType: '',
    requesterName: '',
    requesterEmail: '',
    approverName: '',
    site: '',
    dateNeeded: '',
    expiryDate: '',
    workDescription: '',
    safetyMeasures: '',
    requiresSignature: false,
  });

  const [sharePointTitles, setSharePointTitles] = useState<string[]>([]);
  const [loadingTitles, setLoadingTitles] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const signaturePadRef = useRef<SignaturePadRef>(null);
  const [existingRejectionNote, setExistingRejectionNote] = useState('');
  const [permitIdStr, setPermitIdStr] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>();
  const [selectedApprover, setSelectedApprover] = useState<ApproverInfo | null>(null);
  const { approvers, loading: loadingApprovers } = useApprovers();

  useEffect(() => {
    if (account) {
      setFormData((prev) => ({
        ...prev,
        requesterName: account.name || '',
        requesterEmail: account.username || '',
      }));
    }
  }, [account]);

  useEffect(() => {
    const fetchAllCachedJobs = async () => {
      try {
        setLoadingTitles(true);
        const allTitles: string[] = [];
        const batchSize = 1000;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('sharepoint_jobs_cache')
            .select('job_title')
            .order('job_title', { ascending: true })
            .range(offset, offset + batchSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            const titles = data.map((row: { job_title: string }) => row.job_title);
            allTitles.push(...titles);
            offset += data.length;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        setSharePointTitles(allTitles);
      } catch (error) {
        console.error('Error fetching cached jobs:', error);
      } finally {
        setLoadingTitles(false);
      }
    };

    fetchAllCachedJobs();
  }, []);

  useEffect(() => {
    if (permitId && (mode === 'approve' || mode === 'rejected')) {
      loadPermitData(permitId);
    }
  }, [permitId, mode]);

  const loadPermitData = async (id: number) => {
    try {
      const { data, error } = await supabase
        .from('permits')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setFormData({
          projectTitle: data.ontivity_project_number || '',
          workType: data.type_of_permit || '',
          requesterName: data.requestor || '',
          requesterEmail: data.requestor || '',
          approverName: data.approver_name || '',
          site: data.city || '',
          dateNeeded: data.date_of_project_commencement || '',
          expiryDate: data.estimated_date_of_completion || '',
          workDescription: data.detailed_sow || '',
          safetyMeasures: data.detailed_sow || '',
          requiresSignature: data.requires_signature || false,
        });

        if (data.approver_name) {
          setSelectedApprover({
            fullName: data.approver_name,
            businessEmail: data.approver_email || '',
            managerEmail: data.approver_manager_email || null,
            divisionManagerEmail: data.approver_division_manager_email || null,
          });
        }

        setPermitIdStr(data.permit_id || '');
        setSignatureDataUrl(data.signature_data_url || undefined);

        if (mode === 'rejected') {
          const { data: auditData } = await supabase
            .from('permit_audit_log')
            .select('notes')
            .eq('permit_id', id)
            .eq('action', 'Rejected')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (auditData?.notes) {
            setExistingRejectionNote(auditData.notes);
          }
        }
      }
    } catch (error) {
      console.error('Error loading permit data:', error);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleDateChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(Array.from(e.target.files));
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const generatePermitId = () => {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `PERM-${year}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      await login();
      return;
    }

    if (formData.requiresSignature && mode === 'submit') {
      setShowSignatureModal(true);
      return;
    }

    await processSubmission();
  };

  const processSubmission = async (signatureDataUrl?: string) => {
    setSubmitting(true);

    try {
      const generatedPermitId = generatePermitId();

      const pdfData: PermitFormData = {
        projectTitle: formData.projectTitle,
        workType: formData.workType,
        requesterType: 'Internal',
        requesterName: formData.requesterName,
        requesterEmail: formData.requesterEmail,
        site: formData.site,
        dateNeeded: formData.dateNeeded,
        expiryDate: formData.expiryDate,
        workDescription: formData.workDescription,
        safetyMeasures: formData.safetyMeasures,
        requiresSignature: formData.requiresSignature,
        signatureDataUrl: signatureDataUrl,
        submitterName: formData.requesterName,
        permitId: generatedPermitId,
      };

      const pdfBlob = generatePermitPDF(pdfData);

      const insertData: any = {
        permit_id: generatedPermitId,
        requestor: formData.requesterName,
        requester_type: 'Internal',
        ontivity_project_number: formData.projectTitle,
        performing_entity: 'ONT',
        date_of_request: new Date().toISOString().split('T')[0],
        date_of_project_commencement: formData.dateNeeded,
        estimated_date_of_completion: formData.expiryDate || null,
        type_of_permit: formData.workType,
        state: '',
        county_or_parish: '',
        city: formData.site,
        land_owner: '',
        tower_owner: '',
        end_customer: '',
        project_value: 0,
        detailed_sow: formData.workDescription,
        current_stage: 'awaiting_qp',
        requires_signature: formData.requiresSignature,
        approver_name: selectedApprover?.fullName || null,
        approver_email: selectedApprover?.businessEmail || null,
        approver_manager_email: selectedApprover?.managerEmail || null,
        approver_division_manager_email: selectedApprover?.divisionManagerEmail || null,
      };

      if (signatureDataUrl) {
        insertData.signature_data_url = signatureDataUrl;
        insertData.signed_by = formData.requesterName;
        insertData.signed_at = new Date().toISOString();
      }

      const { data: permitData, error: permitError } = await supabase
        .from('permits')
        .insert([insertData])
        .select()
        .single();

      if (permitError) throw permitError;

      if (uploadedFiles.length > 0) {
        const documentInserts = uploadedFiles.map((file) => ({
          permit_id: permitData.id,
          document_type: 'permit_document',
          file_name: file.name,
          file_url: `#${file.name}`,
        }));

        const { error: docError } = await supabase
          .from('permit_documents')
          .insert(documentInserts);

        if (docError) throw docError;
      }

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitData.id,
          action: 'Submitted',
          performed_by: formData.requesterName,
          notes: 'Permit request submitted for approval',
        },
      ]);

      setShowSuccess(true);
      setTimeout(() => {
        onNavigate('list');
      }, 2000);
    } catch (error) {
      console.error('Error submitting permit:', error);
      alert('Error submitting permit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = () => {
    setActionType('approve');
    if (formData.requiresSignature) {
      setShowSignatureModal(true);
    } else {
      processApproval();
    }
  };

  const handleReject = () => {
    setActionType('reject');
    setShowRejectionModal(true);
  };

  const processApproval = async (signatureDataUrl?: string) => {
    if (!permitId) return;

    setSubmitting(true);
    try {
      const updateData: any = { current_stage: 'approved' };

      if (signatureDataUrl) {
        updateData.signature_data_url = signatureDataUrl;
        updateData.signed_by = formData.requesterName;
        updateData.signed_at = new Date().toISOString();

        const pdfData: PermitFormData = {
          projectTitle: formData.projectTitle,
          workType: formData.workType,
          requesterType: 'Internal',
          requesterName: formData.requesterName,
          requesterEmail: formData.requesterEmail,
          site: formData.site,
          dateNeeded: formData.dateNeeded,
          expiryDate: formData.expiryDate,
          workDescription: formData.workDescription,
          safetyMeasures: formData.safetyMeasures,
          requiresSignature: formData.requiresSignature,
          signatureDataUrl: signatureDataUrl,
          submitterName: formData.requesterName,
          permitId: permitIdStr,
          status: 'Approved',
        };

        const pdfBlob = generatePermitPDF(pdfData);

        const signedPdfFilename = `${permitIdStr}-signed.pdf`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('permit-pdfs')
          .upload(`signed/${signedPdfFilename}`, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (uploadError) {
          console.error('Error uploading signed PDF:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('permit-pdfs')
            .getPublicUrl(`signed/${signedPdfFilename}`);

          updateData.signed_pdf_url = publicUrl;
        }
      }

      const { error } = await supabase
        .from('permits')
        .update(updateData)
        .eq('id', permitId);

      if (error) throw error;

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'Approved',
          performed_by: formData.requesterName,
          notes: signatureDataUrl ? 'Approved with signature' : 'Approved',
        },
      ]);

      setShowSuccess(true);
      setTimeout(() => {
        onNavigate('list');
      }, 2000);
    } catch (error) {
      console.error('Error approving permit:', error);
      alert('Error approving permit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const processRejection = async () => {
    if (!permitId || !rejectionReason.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('permits')
        .update({ current_stage: 'rejected_by_qp' })
        .eq('id', permitId);

      if (error) throw error;

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitId,
          action: 'Rejected',
          performed_by: formData.requesterName,
          notes: rejectionReason,
        },
      ]);

      setShowRejectionModal(false);
      setShowSuccess(true);
      setTimeout(() => {
        onNavigate('list');
      }, 2000);
    } catch (error) {
      console.error('Error rejecting permit:', error);
      alert('Error rejecting permit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignatureSubmit = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      const signatureDataUrl = signaturePadRef.current.toDataURL();
      setShowSignatureModal(false);

      if (mode === 'submit') {
        processSubmission(signatureDataUrl);
      } else if (actionType === 'approve') {
        processApproval(signatureDataUrl);
      }
    } else {
      alert('Please provide a signature.');
    }
  };

  const handleDownloadPDF = () => {
    const pdfData: PermitFormData = {
      projectTitle: formData.projectTitle || '',
      workType: formData.workType || '',
      requesterType: 'Internal',
      requesterName: formData.requesterName || '',
      requesterEmail: formData.requesterEmail || '',
      site: formData.site || '',
      dateNeeded: formData.dateNeeded || '',
      expiryDate: formData.expiryDate || '',
      workDescription: formData.workDescription || '',
      safetyMeasures: formData.safetyMeasures || '',
      requiresSignature: formData.requiresSignature,
      signatureDataUrl: signatureDataUrl,
      submitterName: formData.requesterName,
      permitId: permitIdStr,
    };

    const pdfBlob = generatePermitPDF(pdfData);
    const filename = permitIdStr ? `${permitIdStr}.pdf` : `permit-${Date.now()}.pdf`;
    downloadPDF(pdfBlob, filename);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl p-10 max-w-sm w-full mx-4 text-center">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-[#0072BC] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-sm">Signing you in...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl p-10 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-[#0072BC]/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle size={32} className="text-[#0072BC]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Microsoft Login Required
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            Sign in with your Microsoft account to access the permit system.
          </p>
          <button
            onClick={login}
            className="w-full px-6 py-3 bg-[#0072BC] text-white rounded-lg hover:bg-[#005a94] transition-colors font-medium"
          >
            Sign in with Microsoft
          </button>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {mode === 'submit'
              ? 'Permit Submitted Successfully!'
              : mode === 'approve'
              ? 'Permit Approved!'
              : 'Permit Rejected'}
          </h2>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 bg-gray-50 p-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {mode === 'rejected' && existingRejectionNote && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <div className="flex items-start">
                <AlertCircle className="text-red-500 mt-0.5 mr-3" size={20} />
                <div className="flex-1">
                  <h3 className="text-red-900 font-semibold mb-1">
                    This permit was rejected
                  </h3>
                  <p className="text-red-800 text-sm">
                    <strong>Rejection Reason:</strong> {existingRejectionNote}
                  </p>
                  <p className="text-red-700 text-xs mt-2">
                    Please review the feedback, make necessary changes, and resubmit.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                {mode === 'submit'
                  ? 'New Permit Request'
                  : mode === 'approve'
                  ? 'Review Permit Request'
                  : 'Resubmit Rejected Permit'}
              </h1>

              <button
                type="button"
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-4 py-2 bg-[#0072BC] text-white rounded-lg hover:bg-[#005a94] transition-colors"
              >
                <Download size={18} />
                Download PDF
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                  Requester Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="requesterName"
                      value={formData.requesterName}
                      onChange={handleInputChange}
                      required
                      readOnly={mode === 'approve'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="requesterEmail"
                      value={formData.requesterEmail}
                      onChange={handleInputChange}
                      required
                      readOnly={mode === 'approve'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Approver <span className="text-red-500">*</span>
                    </label>
                    <SearchableDropdown
                      name="approverName"
                      options={approvers.map((a) => a.fullName)}
                      value={formData.approverName}
                      onChange={(val) => {
                        setFormData((prev) => ({ ...prev, approverName: val }));
                        const approver = approvers.find((a) => a.fullName === val);
                        setSelectedApprover(approver || null);
                      }}
                      placeholder="Search for an approver..."
                      disabled={mode === 'approve'}
                      required
                      loading={loadingApprovers}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                  Project Details
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Project Title <span className="text-red-500">*</span>
                    </label>
                    <SearchableDropdown
                      name="projectTitle"
                      options={sharePointTitles}
                      value={formData.projectTitle}
                      onChange={(val) =>
                        setFormData((prev) => ({ ...prev, projectTitle: val }))
                      }
                      placeholder="Search projects..."
                      disabled={mode === 'approve'}
                      required
                      loading={loadingTitles}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Work Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="workType"
                      value={formData.workType}
                      onChange={handleInputChange}
                      required
                      disabled={mode === 'approve'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent disabled:bg-gray-100"
                    >
                      <option value="">Select type</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Building">Building</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Site <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="site"
                      value={formData.site}
                      onChange={handleInputChange}
                      required
                      readOnly={mode === 'approve'}
                      placeholder="Site location"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date Needed <span className="text-red-500">*</span>
                    </label>
                    <DateInput
                      name="dateNeeded"
                      value={formData.dateNeeded}
                      onChange={handleDateChange}
                      required
                      disabled={mode === 'approve'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expiry Date
                    </label>
                    <DateInput
                      name="expiryDate"
                      value={formData.expiryDate}
                      onChange={handleDateChange}
                      disabled={mode === 'approve'}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Work Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="workDescription"
                      value={formData.workDescription}
                      onChange={handleInputChange}
                      required
                      readOnly={mode === 'approve'}
                      rows={4}
                      placeholder="Describe the work to be performed..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Safety Measures <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="safetyMeasures"
                      value={formData.safetyMeasures}
                      onChange={handleInputChange}
                      required
                      readOnly={mode === 'approve'}
                      rows={3}
                      placeholder="List safety measures and precautions..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              {mode !== 'approve' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    Document Uploads
                  </h2>
                  <div className="border border-gray-200 rounded-lg p-6">
                    <label className="flex flex-col items-center justify-center gap-3 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <Upload size={32} className="text-gray-400" />
                      <div className="text-center">
                        <span className="text-sm font-medium text-gray-700">
                          Choose Files
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          Select multiple images or PDFs
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    {uploadedFiles.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700 mb-3">
                          Selected Files ({uploadedFiles.length})
                        </p>
                        <div className="space-y-2">
                          {uploadedFiles.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <FileText
                                  size={18}
                                  className="text-gray-400 flex-shrink-0"
                                />
                                <span className="text-sm text-gray-700 truncate">
                                  {file.name}
                                </span>
                                <span className="text-xs text-gray-500 flex-shrink-0">
                                  ({(file.size / 1024).toFixed(1)} KB)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(index)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium ml-3 flex-shrink-0"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                  Signature Requirement
                </h2>
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <input
                    type="checkbox"
                    id="requiresSignature"
                    name="requiresSignature"
                    checked={formData.requiresSignature}
                    onChange={handleInputChange}
                    disabled={mode === 'approve'}
                    className="mt-1 w-4 h-4 text-[#0072BC] border-gray-300 rounded focus:ring-[#0072BC] disabled:opacity-50"
                  />
                  <label htmlFor="requiresSignature" className="flex-1">
                    <span className="text-sm font-medium text-gray-900">
                      Require signature for approval
                    </span>
                    <p className="text-xs text-gray-600 mt-1">
                      By checking this box, you require a signature before processing
                      this permit request.
                    </p>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => onNavigate('list')}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>

                {mode === 'approve' ? (
                  <>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={submitting}
                      className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={submitting}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Approve
                    </button>
                  </>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-[#0072BC] text-white rounded-lg hover:bg-[#005a94] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting
                      ? 'Submitting...'
                      : mode === 'rejected'
                      ? 'Resubmit Permit Request'
                      : 'Submit Permit Request'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {showRejectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Reject Permit Request
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this permit:
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              placeholder="Enter rejection reason..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRejectionModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={processRejection}
                disabled={!rejectionReason.trim() || submitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Please Sign Below
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Draw your signature using your mouse or touch screen:
            </p>
            <SignaturePad ref={signaturePadRef} />
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => signaturePadRef.current?.clear()}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSignatureModal(false);
                    setActionType(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignatureSubmit}
                  className="px-4 py-2 bg-[#0072BC] text-white rounded-lg hover:bg-[#005a94] transition-colors"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
