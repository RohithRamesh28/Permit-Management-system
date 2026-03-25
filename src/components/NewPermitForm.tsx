import { useState, useEffect } from 'react';
import { Upload, CheckCircle, FileText, Lock, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SearchableDropdown from './SearchableDropdown';
import { useSharePointJobs } from '../hooks/useSharePointJobs';
import { useSharePointJobDetails } from '../hooks/useSharePointJobDetails';
import { useAuth } from '../contexts/AuthContext';
import { useQualifiedPerson } from '../hooks/useQualifiedPerson';
import { getCurrentDateInMMDDYYYY } from '../utils/dateFormatters';
import DateInput from './DateInput';
import { getAvailableStates, getCountyCityOptions, getQPForSelection } from '../services/licensingService';
import { useApprovers, ApproverInfo } from '../hooks/useApprovers';

interface NewPermitFormProps {
  onNavigate: (view: string) => void;
}

interface FormData {
  requestor: string;
  requester_type: string;
  ontivity_project_number: string;
  performing_entity: string;
  date_of_request: string;
  date_of_project_commencement: string;
  estimated_date_of_completion: string;
  utility_provider: string;
  property_owner: string;
  end_customer: string;
  project_value: string;
  actual_date_of_completion: string;
  detailed_sow: string;
}

export default function NewPermitForm({ onNavigate }: NewPermitFormProps) {
  const { jobs, loading: jobsLoading } = useSharePointJobs();
  const { userName, userEmail } = useAuth();
  const { qpInfo, loading: qpManagerLoading } = useQualifiedPerson(userEmail);
  const { approvers, loading: loadingApprovers } = useApprovers();

  const [selectedJobTitle, setSelectedJobTitle] = useState<string | null>(null);
  const { details: jobDetails, loading: jobDetailsLoading } = useSharePointJobDetails(selectedJobTitle);
  const [performingEntityLocked, setPerformingEntityLocked] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    requestor: userName || '',
    requester_type: '',
    ontivity_project_number: '',
    performing_entity: '',
    date_of_request: getCurrentDateInMMDDYYYY(),
    date_of_project_commencement: '',
    estimated_date_of_completion: '',
    utility_provider: '',
    property_owner: '',
    end_customer: '',
    project_value: '',
    actual_date_of_completion: '',
    detailed_sow: '',
  });

  const [permitLevel, setPermitLevel] = useState<"State" | "CountyCity">("State");
  const [permitType, setPermitType] = useState<"General" | "Electrical" | "Specialty" | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedCountyCityTitle, setSelectedCountyCityTitle] = useState<string | null>(null);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableCountyCities, setAvailableCountyCities] = useState<Array<{ title: string; qpName: string | null; qpEmail: string | null; spItemId: string | null }>>([]);
  const [qpName, setQpName] = useState<string | null>(null);
  const [qpEmail, setQpEmail] = useState<string | null>(null);
  const [matchedItemId, setMatchedItemId] = useState<string | null>(null);
  const [licenseListUsed, setLicenseListUsed] = useState<string | null>(null);
  const [statesLoading, setStatesLoading] = useState(false);
  const [countiesLoading, setCountiesLoading] = useState(false);
  const [qpLoading, setQpLoading] = useState(false);
  const [statesError, setStatesError] = useState<string | null>(null);

  useEffect(() => {
    if (userName) {
      setFormData((prev) => ({ ...prev, requestor: userName }));
    }
  }, [userName]);

  useEffect(() => {
    if (jobDetails) {
      if (jobDetails.division) {
        setFormData((prev) => ({ ...prev, performing_entity: jobDetails.division }));
        setPerformingEntityLocked(true);
      } else {
        if (performingEntityLocked) {
          setFormData((prev) => ({ ...prev, performing_entity: '' }));
          setPerformingEntityLocked(false);
        }
      }

      if (jobDetails.carrier) {
        setFormData((prev) => ({ ...prev, end_customer: jobDetails.carrier }));
      }
    }
  }, [jobDetails]);

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [documentToSign, setDocumentToSign] = useState<File | null>(null);
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedApprover, setSelectedApprover] = useState<ApproverInfo | null>(null);
  const [approverName, setApproverName] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const loadStates = async () => {
    if (!permitType || !formData.performing_entity) return;
    setStatesLoading(true);
    setStatesError(null);
    setAvailableStates([]);
    setSelectedState(null);
    setSelectedCountyCityTitle(null);
    setQpName(null);
    setQpEmail(null);

    const states = await getAvailableStates(permitLevel, permitType, formData.performing_entity);
    setAvailableStates(states);
    if (states.length === 0) {
      setStatesError("No active licenses found for this combination. Contact admin.");
    }
    setStatesLoading(false);
  };

  const loadCountyCityOptions = async () => {
    if (!selectedState || !permitType) return;
    setCountiesLoading(true);
    const options = await getCountyCityOptions(permitType, formData.performing_entity, selectedState);
    setAvailableCountyCities(options);

    if (options.length === 1) {
      setSelectedCountyCityTitle(options[0].title);
      setQpName(options[0].qpName);
      setQpEmail(options[0].qpEmail);
      setMatchedItemId(options[0].spItemId);
      const sourceList = permitType === "Electrical" ? "county_electrical" : "county_contractor";
      setLicenseListUsed(sourceList);
    } else if (options.length > 1) {
      setSelectedCountyCityTitle(null);
      setQpName(null);
      setQpEmail(null);
      setMatchedItemId(null);
      setLicenseListUsed(null);
    }

    setCountiesLoading(false);
  };

  const loadQP = async () => {
    if (!permitType || !formData.performing_entity || !selectedState) return;
    if (permitLevel === "CountyCity" && !selectedCountyCityTitle) return;

    setQpLoading(true);
    const result = await getQPForSelection(
      permitLevel,
      permitType,
      formData.performing_entity,
      selectedState,
      permitLevel === "CountyCity" ? selectedCountyCityTitle! : undefined
    );
    setQpName(result.qpName);
    setQpEmail(result.qpEmail);
    setMatchedItemId(result.matchedItemId);
    setLicenseListUsed(result.sourceList);
    setQpLoading(false);
  };

  useEffect(() => {
    if (permitType && formData.performing_entity) {
      loadStates();
    }
  }, [permitType, formData.performing_entity, permitLevel]);

  useEffect(() => {
    if (selectedState && permitLevel === "CountyCity") {
      loadCountyCityOptions();
    } else if (selectedState && permitLevel === "State") {
      loadQP();
    }
  }, [selectedState, permitLevel]);

  useEffect(() => {
    if (selectedCountyCityTitle && permitLevel === "CountyCity") {
      const selected = availableCountyCities.find(opt => opt.title === selectedCountyCityTitle);
      if (selected) {
        setQpName(selected.qpName);
        setQpEmail(selected.qpEmail);
        setMatchedItemId(selected.spItemId);
        const sourceList = permitType === "Electrical" ? "county_electrical" : "county_contractor";
        setLicenseListUsed(sourceList);
      }
    }
  }, [selectedCountyCityTitle, availableCountyCities]);

  const handlePermitLevelChange = (level: "State" | "CountyCity") => {
    setPermitLevel(level);
    setPermitType(null);
    setSelectedState(null);
    setSelectedCountyCityTitle(null);
    setAvailableStates([]);
    setAvailableCountyCities([]);
    setQpName(null);
    setQpEmail(null);
    setStatesError(null);
  };

  const handlePermitTypeChange = (type: "General" | "Electrical" | "Specialty") => {
    setPermitType(type);
    setSelectedState(null);
    setSelectedCountyCityTitle(null);
    setAvailableStates([]);
    setAvailableCountyCities([]);
    setQpName(null);
    setQpEmail(null);
    setStatesError(null);
    if (type === "Electrical") {
      loadStates();
    } else {
      loadStates();
    }
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

  const handleDocumentToSignChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDocumentToSign(e.target.files[0]);
    }
  };

  const handleRemoveDocumentToSign = () => {
    setDocumentToSign(null);
  };

  const generatePermitId = () => {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PERM-${year}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!qpName || !qpEmail) {
        alert('No valid license found for this permit type, location, and performing entity. Please verify your selections or contact administrator.');
        setSubmitting(false);
        return;
      }

      const permitId = generatePermitId();

      const permitJurisdiction = permitLevel === "State"
        ? selectedState
        : `${selectedCountyCityTitle}, ${selectedState}`;

      const permitTypeDisplay = permitType === "General"
        ? "General Permit"
        : permitType === "Electrical"
        ? "Electrical Permit"
        : "Specialty/Tower Permit";

      const { data: permitData, error: permitError } = await supabase
        .from('permits')
        .insert([
          {
            permit_id: permitId,
            requestor: formData.requestor,
            requester_type: formData.requester_type,
            requester_email: userEmail,
            permit_jurisdiction_type: permitLevel === "State" ? "State" : "County/City",
            ontivity_project_number: formData.ontivity_project_number,
            performing_entity: formData.performing_entity,
            date_of_request: formData.date_of_request,
            date_of_project_commencement: formData.date_of_project_commencement,
            estimated_date_of_completion: formData.estimated_date_of_completion,
            type_of_permit: permitTypeDisplay,
            utility_provider: permitType === 'Electrical' ? formData.utility_provider : null,
            state: selectedState,
            permit_jurisdiction: permitJurisdiction,
            property_owner: formData.property_owner,
            end_customer: formData.end_customer,
            project_value: parseFloat(formData.project_value) || 0,
            actual_date_of_completion: formData.actual_date_of_completion || null,
            detailed_sow: formData.detailed_sow,
            status: 'Pending Approval',
            requires_signature: requiresSignature,
            qp_name: qpName,
            qp_email: qpEmail,
            license_list_used: licenseListUsed,
            matched_license_item_id: matchedItemId,
            approver_name: selectedApprover?.fullName || null,
            approver_email: selectedApprover?.businessEmail || null,
            approver_manager_email: selectedApprover?.managerEmail || null,
            approver_division_manager_email: selectedApprover?.divisionManagerEmail || null,
          },
        ])
        .select()
        .single();

      if (permitError) throw permitError;

      const fileUrls: Array<{ name: string; url: string; size: number; type: string; documentType: string }> = [];

      if (uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          const filePath = `permit-documents/${permitData.id}/${file.name}`;

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
            size: file.size,
            type: file.type,
            documentType: 'general',
          });
        }
      }

      if (documentToSign) {
        const filePath = `permit-documents/${permitData.id}/${documentToSign.name}`;

        const { error: uploadError } = await supabase.storage
          .from('permit-pdfs')
          .upload(filePath, documentToSign, {
            cacheControl: '3600',
            upsert: false,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('permit-pdfs')
            .getPublicUrl(filePath);

          fileUrls.push({
            name: documentToSign.name,
            url: urlData.publicUrl,
            size: documentToSign.size,
            type: documentToSign.type,
            documentType: 'to_sign',
          });
        }
      }

      if (fileUrls.length > 0) {
        const documentInserts = fileUrls.map((fileInfo) => ({
          permit_id: permitData.id,
          document_type: fileInfo.documentType,
          file_name: fileInfo.name,
          file_url: fileInfo.url,
          uploaded_after_approval: false,
        }));

        const { error: docError } = await supabase.from('permit_documents').insert(documentInserts);

        if (docError) throw docError;
      }

      await supabase.from('permit_audit_log').insert([
        {
          permit_id: permitData.id,
          action: 'Submitted',
          performed_by: formData.requestor,
          notes: 'Permit request submitted for approval',
        },
      ]);

      const powerAutomateUrl = 'https://default3596b7c39b4b4ef89dde39825373af.28.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/c9bb3dc15bc34e1681cdcdda36db4cee/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=XflS1U3z0zJ8icT07Wzj8nTU2o0VIG0xnbt92ohpfZI';

      const payload = {
        timing_id: permitData.id.toString(),
        unique_id: permitId,
        submitted_by: formData.requestor,
        submitted_by_email: userEmail,
        requestor: formData.requestor,
        requester_type: formData.requester_type,
        ontivity_project_number: formData.ontivity_project_number,
        performing_entity: formData.performing_entity,
        date_of_request: formData.date_of_request,
        date_of_project_commencement: formData.date_of_project_commencement,
        estimated_date_of_completion: formData.estimated_date_of_completion,
        type_of_permit: permitTypeDisplay,
        utility_provider: formData.utility_provider || '',
        state: selectedState,
        permit_jurisdiction: permitJurisdiction,
        property_owner: formData.property_owner,
        end_customer: formData.end_customer,
        project_value: parseInt(formData.project_value) || 0,
        actual_date_of_completion: formData.actual_date_of_completion || '',
        detailed_sow: formData.detailed_sow,
        status: 'awaiting approval',
        requires_signature: requiresSignature,
        uploaded_files_count: fileUrls.length,
        uploaded_files: fileUrls,
        created_at: new Date().toISOString(),
      };

      try {
        const response = await fetch(powerAutomateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          console.error('Power Automate response error:', {
            status: response.status,
            statusText: response.statusText,
            url: powerAutomateUrl
          });
        } else {
          console.log('Successfully sent to Power Automate:', response.status);
        }
      } catch (flowError) {
        console.error('Error sending to Power Automate:', flowError);
        console.error('Payload that was attempted to send:', payload);
      }

      window.location.href = `/permit/${permitData.id}?readOnly=true`;
    } catch (error) {
      console.error('Error submitting permit:', error);
      alert('Error submitting permit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <>
      {submitting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-[#0072BC] rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Submitting Permit</h3>
            <p className="text-sm text-gray-600">Please wait while we process your request...</p>
          </div>
        </div>
      )}

      <div className="flex-1 bg-gray-50 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 -mx-6 -mt-6 px-6 pt-5 pb-4 mb-5 border-b-4 border-[#0072BC]">
              <div className="flex items-center justify-between">
                <img src="/image_(6).png" alt="Ontivity Logo" className="h-12 w-auto" />
                <div className="text-right">
                  <div className="text-[10px] font-medium text-gray-600 uppercase tracking-wide">Date of Request</div>
                  <div className="text-sm font-semibold text-gray-900">{formData.date_of_request}</div>
                </div>
              </div>
            </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Requestor <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="requestor"
                    value={formData.requestor}
                    readOnly
                    disabled
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Requester Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="requester_type"
                    value={formData.requester_type}
                    onChange={handleInputChange}
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
                      name="permitLevel"
                      value="State"
                      checked={permitLevel === "State"}
                      onChange={() => handlePermitLevelChange("State")}
                      className="w-4 h-4 text-[#0072BC] border-gray-300 focus:ring-[#0072BC]"
                    />
                    <span className="text-sm font-medium text-gray-700">State</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="permitLevel"
                      value="CountyCity"
                      checked={permitLevel === "CountyCity"}
                      onChange={() => handlePermitLevelChange("CountyCity")}
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
                    value={formData.ontivity_project_number}
                    onChange={(value) => setFormData((prev) => ({ ...prev, ontivity_project_number: value }))}
                    onSelect={(value) => setSelectedJobTitle(value)}
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
                    {performingEntityLocked && <Lock size={12} className="text-gray-500" />}
                    {jobDetailsLoading && <Loader2 size={12} className="text-blue-500 animate-spin" />}
                  </label>
                  {performingEntityLocked ? (
                    <>
                      <input
                        type="text"
                        name="performing_entity"
                        value={formData.performing_entity}
                        readOnly
                        required
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                      />
                    </>
                  ) : (
                    <select
                      name="performing_entity"
                      value={formData.performing_entity}
                      onChange={handleInputChange}
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
                    value={formData.date_of_project_commencement}
                    onChange={handleDateChange}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Estimated Date of Completion <span className="text-red-500">*</span>
                  </label>
                  <DateInput
                    name="estimated_date_of_completion"
                    value={formData.estimated_date_of_completion}
                    onChange={handleDateChange}
                    required
                  />
                </div>

                <div className={`${!formData.performing_entity ? 'opacity-50 pointer-events-none' : ''}`}>
                  <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                    Type of Permit <span className="text-red-500">*</span>
                    {!formData.performing_entity && <Lock size={12} className="text-gray-400" />}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={!formData.performing_entity}
                      onClick={() => handlePermitTypeChange("General")}
                      className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                        permitType === "General"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      General Permit
                    </button>
                    <button
                      type="button"
                      disabled={!formData.performing_entity}
                      onClick={() => handlePermitTypeChange("Electrical")}
                      className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                        permitType === "Electrical"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      Electrical Permit
                    </button>
                    <button
                      type="button"
                      disabled={!formData.performing_entity}
                      onClick={() => handlePermitTypeChange("Specialty")}
                      className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                        permitType === "Specialty"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      Specialty Permit
                    </button>
                  </div>
                </div>

                {permitType === 'Electrical' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Utility Provider <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="utility_provider"
                      value={formData.utility_provider}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., Pacific Gas & Electric"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className={`${!permitType ? 'opacity-50 pointer-events-none' : ''}`}>
                  <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                    State <span className="text-red-500">*</span>
                    {!permitType && <Lock size={12} className="text-gray-400" />}
                    {statesLoading && <Loader2 size={12} className="text-blue-500 animate-spin" />}
                  </label>
                  <SearchableDropdown
                    name="state"
                    value={selectedState || ""}
                    onChange={(value) => setSelectedState(value)}
                    options={availableStates}
                    placeholder="Select state..."
                    required
                    loading={statesLoading}
                    disabled={!permitType}
                  />
                  {statesError && (
                    <p className="text-[10px] text-amber-600 mt-1">{statesError}</p>
                  )}
                </div>

                {permitLevel === 'CountyCity' && selectedState && (
                  <div className={`${countiesLoading ? 'opacity-50' : ''}`}>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      County / City <span className="text-red-500">*</span>
                      {countiesLoading && <Loader2 size={12} className="text-blue-500 animate-spin" />}
                    </label>
                    <SearchableDropdown
                      name="county_city"
                      value={selectedCountyCityTitle || ""}
                      onChange={(value) => setSelectedCountyCityTitle(value)}
                      options={availableCountyCities.map(opt => opt.title)}
                      placeholder="Select county/city..."
                      required
                      loading={countiesLoading}
                    />
                  </div>
                )}

                {selectedState && (permitLevel === "State" || (permitLevel === "CountyCity" && selectedCountyCityTitle)) && (
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                          QP Name
                          {qpLoading && <Loader2 size={12} className="text-blue-500 animate-spin" />}
                        </label>
                        <input
                          type="text"
                          value={qpName || 'Loading...'}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-600 cursor-not-allowed"
                        />
                        {!qpName && !qpLoading && (
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
                          value={approverName}
                          onChange={(val) => {
                            setApproverName(val);
                            const approver = approvers.find((a) => a.fullName === val);
                            setSelectedApprover(approver || null);
                          }}
                          placeholder="Search for an approver..."
                          required
                          loading={loadingApprovers}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Property Owner <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="property_owner"
                      value={formData.property_owner}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., SBA, CCI, ATC"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      End Customer <span className="text-red-500">*</span>
                      {jobDetailsLoading && <Loader2 size={12} className="text-blue-500 animate-spin" />}
                    </label>
                    <input
                      type="text"
                      name="end_customer"
                      value={formData.end_customer}
                      onChange={handleInputChange}
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
                        value={formData.project_value}
                        onChange={handleInputChange}
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
                      value={formData.actual_date_of_completion}
                      onChange={handleDateChange}
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
                    value={formData.detailed_sow}
                    onChange={handleInputChange}
                    required
                    rows={4}
                    placeholder="Provide detailed description of the work to be performed..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <p className="text-xs font-medium text-blue-900 mb-2">
                  The following documents are required to be uploaded for permit compliance:
                </p>
                <ul className="text-xs text-blue-800 space-y-0.5 list-disc list-inside">
                  <li>Pre photos of area that work is being performed</li>
                  <li>Photos of identification signs at entrance</li>
                  <li>Photos of work in progress: Trench depth per requirements</li>
                  <li>Photos of work in progress: Conduit routes</li>
                  <li>Photos of work in progress: All terminations</li>
                  <li>Photos of work area upon completion</li>
                  <li>Photo of permit</li>
                  <li>Photo of passed inspection (if applicable)</li>
                  <li>Photo of closed permit</li>
                </ul>
              </div>

              <div className="border border-gray-200 rounded-md p-4 mb-4">
                <h3 className="text-xs font-semibold text-gray-900 mb-3">General Documents</h3>
                <label className="flex flex-col items-center justify-center gap-2 px-3 py-5 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                  <Upload size={24} className="text-gray-400" />
                  <div className="text-center">
                    <span className="text-xs font-medium text-gray-700">Choose Files</span>
                    <p className="text-[10px] text-gray-500 mt-0.5">Select multiple images or PDFs</p>
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
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">
                      Selected Files ({uploadedFiles.length})
                    </p>
                    <div className="space-y-1.5">
                      {uploadedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-md"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-700 truncate">{file.name}</span>
                            <span className="text-[10px] text-gray-500 flex-shrink-0">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(index)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium ml-2 flex-shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md border border-gray-200 mb-3">
                  <input
                    type="checkbox"
                    id="requiresSignature"
                    checked={requiresSignature}
                    onChange={(e) => setRequiresSignature(e.target.checked)}
                    className="w-3.5 h-3.5 text-[#0072BC] border-gray-300 rounded focus:ring-[#0072BC] flex-shrink-0"
                  />
                  <label htmlFor="requiresSignature" className="flex-1 cursor-pointer">
                    <span className="text-xs font-medium text-gray-900">Signature Required</span>
                    <span className="text-[10px] text-gray-600 ml-1">
                      (Check this if you need to upload a document that requires a signature)
                    </span>
                  </label>
                </div>

                <div className={`border border-gray-200 rounded-md p-4 transition-opacity ${!requiresSignature ? 'opacity-50 bg-gray-50' : ''}`}>
                  <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    Permitting Application
                    {!requiresSignature && <Lock size={14} className="text-gray-400" />}
                  </h3>
                  <label className={`flex flex-col items-center justify-center gap-2 px-3 py-5 border-2 border-dashed border-gray-300 rounded-md ${requiresSignature ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed'} transition-colors`}>
                    <Upload size={24} className="text-gray-400" />
                    <div className="text-center">
                      <span className="text-xs font-medium text-gray-700">Choose Document</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">PDF only - Single file</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleDocumentToSignChange}
                      disabled={!requiresSignature}
                      className="hidden"
                    />
                  </label>

                  {documentToSign && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-700 mb-2">Selected Document</p>
                      <div className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-md">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="text-xs text-gray-700 truncate">{documentToSign.name}</span>
                          <span className="text-[10px] text-gray-500 flex-shrink-0">
                            ({(documentToSign.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveDocumentToSign}
                          className="text-red-600 hover:text-red-800 text-xs font-medium ml-2 flex-shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-1.5 text-sm bg-[#0072BC] text-white rounded-md hover:bg-[#005a94] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Permit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    </>
  );
}
