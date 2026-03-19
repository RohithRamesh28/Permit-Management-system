import { useState, useEffect } from 'react';
import { Upload, CheckCircle, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SearchableDropdown from './SearchableDropdown';
import { useSharePointJobs } from '../hooks/useSharePointJobs';
import { useAuth } from '../contexts/AuthContext';
import { US_STATES_AND_TERRITORIES } from '../utils/usStates';
import { getCurrentDateInMMDDYYYY } from '../utils/dateFormatters';
import DateInput from './DateInput';

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
  type_of_permit: string;
  utility_provider: string;
  state: string;
  county_or_parish: string;
  city: string;
  property_owner: string;
  end_customer: string;
  project_value: string;
  actual_date_of_completion: string;
  detailed_sow: string;
}

export default function NewPermitForm({ onNavigate }: NewPermitFormProps) {
  const { jobs, loading: jobsLoading } = useSharePointJobs();
  const { userName, userEmail } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    requestor: userName || '',
    requester_type: '',
    ontivity_project_number: '',
    performing_entity: '',
    date_of_request: getCurrentDateInMMDDYYYY(),
    date_of_project_commencement: '',
    estimated_date_of_completion: '',
    type_of_permit: '',
    utility_provider: '',
    state: '',
    county_or_parish: '',
    city: '',
    property_owner: '',
    end_customer: '',
    project_value: '',
    actual_date_of_completion: '',
    detailed_sow: '',
  });

  useEffect(() => {
    if (userName) {
      setFormData((prev) => ({ ...prev, requestor: userName }));
    }
  }, [userName]);

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PERM-${year}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const permitId = generatePermitId();

      const { data: permitData, error: permitError } = await supabase
        .from('permits')
        .insert([
          {
            permit_id: permitId,
            requestor: formData.requestor,
            requester_type: formData.requester_type,
            requester_email: userEmail,
            ontivity_project_number: formData.ontivity_project_number,
            performing_entity: formData.performing_entity,
            date_of_request: formData.date_of_request,
            date_of_project_commencement: formData.date_of_project_commencement,
            estimated_date_of_completion: formData.estimated_date_of_completion,
            type_of_permit: formData.type_of_permit,
            utility_provider: formData.type_of_permit === 'Electrical' ? formData.utility_provider : null,
            state: formData.state,
            county_or_parish: formData.county_or_parish,
            city: formData.city,
            property_owner: formData.property_owner,
            end_customer: formData.end_customer,
            project_value: parseFloat(formData.project_value) || 0,
            actual_date_of_completion: formData.actual_date_of_completion || null,
            detailed_sow: formData.detailed_sow,
            status: 'Pending Approval',
            requires_signature: requiresSignature,
          },
        ])
        .select()
        .single();

      if (permitError) throw permitError;

      const fileUrls: Array<{ name: string; url: string; size: number; type: string }> = [];

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
          });
        }

        const documentInserts = fileUrls.map((fileInfo) => ({
          permit_id: permitData.id,
          document_type: 'permit_document',
          file_name: fileInfo.name,
          file_url: fileInfo.url,
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
        type_of_permit: formData.type_of_permit,
        utility_provider: formData.utility_provider || '',
        state: formData.state,
        county_or_parish: formData.county_or_parish,
        city: formData.city,
        property_owner: formData.property_owner,
        end_customer: formData.end_customer,
        project_value: parseInt(formData.project_value) || 0,
        actual_date_of_completion: formData.actual_date_of_completion || '',
        detailed_sow: formData.detailed_sow,
        status: 'Pending Approval',
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

      <div className="flex-1 bg-gray-50 p-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex items-center mb-8">
              <img src="/image_(6).png" alt="Ontivity Logo" className="h-16 w-auto" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">New Permit Request</h1>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Project Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Requestor <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="requestor"
                    value={formData.requestor}
                    readOnly
                    disabled
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-filled from logged in user</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Requester Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="requester_type"
                    value={formData.requester_type}
                    onChange={handleInputChange}
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
                    name="date_of_request"
                    value={formData.date_of_request}
                    readOnly
                    disabled
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-filled current date (MM/DD/YYYY)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ontivity Project Number <span className="text-red-500">*</span>
                  </label>
                  <SearchableDropdown
                    name="ontivity_project_number"
                    value={formData.ontivity_project_number}
                    onChange={(value) => setFormData((prev) => ({ ...prev, ontivity_project_number: value }))}
                    options={jobs}
                    placeholder="Search projects..."
                    required
                    loading={jobsLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">Values from All Division Jobs</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Performing Entity <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="performing_entity"
                    value={formData.performing_entity}
                    onChange={handleInputChange}
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
                    value={formData.date_of_project_commencement}
                    onChange={handleDateChange}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Date of Completion <span className="text-red-500">*</span>
                  </label>
                  <DateInput
                    name="estimated_date_of_completion"
                    value={formData.estimated_date_of_completion}
                    onChange={handleDateChange}
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
                    value={formData.type_of_permit}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                  >
                    <option value="">Select type</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Building">Building</option>
                    <option value="General">General</option>
                  </select>
                </div>

                {formData.type_of_permit === 'Electrical' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Utility Provider <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="utility_provider"
                      value={formData.utility_provider}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., Pacific Gas & Electric"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    County <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="county_or_parish"
                    value={formData.county_or_parish}
                    onChange={handleInputChange}
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
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Los Angeles"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Property Owner <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="property_owner"
                    value={formData.property_owner}
                    onChange={handleInputChange}
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
                    value={formData.end_customer}
                    onChange={handleInputChange}
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
                      value={formData.project_value}
                      onChange={handleInputChange}
                      required
                      placeholder="0.00"
                      step="0.01"
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Actual Date of Project Completion</label>
                  <DateInput
                    name="actual_date_of_completion"
                    value={formData.actual_date_of_completion}
                    onChange={handleDateChange}
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional - Fill in when project is completed</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Detailed Scope of Work <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="detailed_sow"
                    value={formData.detailed_sow}
                    onChange={handleInputChange}
                    required
                    rows={6}
                    placeholder="Provide detailed description of the work to be performed..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2 pb-2 border-b border-gray-200">
                Document Uploads
              </h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-blue-900 mb-3">
                  The following documents are required to be uploaded for permit compliance:
                </p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
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

              <div className="border border-gray-200 rounded-lg p-6">
                <label className="flex flex-col items-center justify-center gap-3 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <Upload size={32} className="text-gray-400" />
                  <div className="text-center">
                    <span className="text-sm font-medium text-gray-700">Choose Files</span>
                    <p className="text-xs text-gray-500 mt-1">Select multiple images or PDFs</p>
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
                            <FileText size={18} className="text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-700 truncate">{file.name}</span>
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

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Signature Requirement
              </h2>
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="requiresSignature"
                  checked={requiresSignature}
                  onChange={(e) => setRequiresSignature(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[#0072BC] border-gray-300 rounded focus:ring-[#0072BC]"
                />
                <label htmlFor="requiresSignature" className="flex-1 cursor-pointer">
                  <span className="text-sm font-medium text-gray-900">Sign this document</span>
                  <p className="text-xs text-gray-600 mt-1">
                    When checked, the approver will be required to provide a signature before they can approve this permit. The signature will be included in the PDF document.
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
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-[#0072BC] text-white rounded-lg hover:bg-[#005a94] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
