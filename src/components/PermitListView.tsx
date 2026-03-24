import { useState, useEffect } from 'react';
import { Search, Filter, PlusCircle, Eye, FileText } from 'lucide-react';
import { supabase, Permit } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PermitListViewProps {
  onNavigate: (view: string) => void;
  onSelectPermit: (permitId: string) => void;
}

export default function PermitListView({ onNavigate, onSelectPermit }: PermitListViewProps) {
  const { userEmail } = useAuth();
  const [permits, setPermits] = useState<Permit[]>([]);
  const [filteredPermits, setFilteredPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [entityFilter, setEntityFilter] = useState('All');
  const [permitTypeFilter, setPermitTypeFilter] = useState('All');

  useEffect(() => {
    fetchPermits();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [permits, searchTerm, statusFilter, entityFilter, permitTypeFilter]);

  const fetchPermits = async () => {
    try {
      const { data, error } = await supabase
        .from('permits')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const isAdmin = userEmail === 'atcautomation@Ontibity.com';
      const filteredData = isAdmin
        ? (data || [])
        : (data || []).filter(permit => permit.requester_email === userEmail);

      setPermits(filteredData);
    } catch (error) {
      console.error('Error fetching permits:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...permits];

    if (searchTerm) {
      filtered = filtered.filter(
        (permit) =>
          permit.ontivity_project_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          permit.requestor.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'All') {
      filtered = filtered.filter((permit) => permit.status === statusFilter);
    }

    if (entityFilter !== 'All') {
      filtered = filtered.filter((permit) => permit.performing_entity === entityFilter);
    }

    if (permitTypeFilter !== 'All') {
      filtered = filtered.filter((permit) => permit.type_of_permit === permitTypeFilter);
    }

    setFilteredPermits(filtered);
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
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen w-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-[#0072BC] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading permits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-8">
          <img src="/image_(6).png" alt="Ontivity Logo" className="h-16 w-auto" />
        </div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Permit Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage and track all permit requests</p>
          </div>
          <button
            onClick={() => onNavigate('new')}
            className="flex items-center gap-2 bg-[#0072BC] text-white px-4 py-2 rounded-lg hover:bg-[#005a94] transition-colors"
          >
            <PlusCircle size={20} />
            New Permit Request
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by Project # or Requestor"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent appearance-none bg-white"
              >
                <option>All</option>
                <option>Pending Approval</option>
                <option>Active</option>
                <option>Rejected</option>
                <option>Closed</option>
              </select>
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent appearance-none bg-white"
              >
                <option>All</option>
                <option>ETT</option>
                <option>CMS</option>
                <option>ETR</option>
                <option>LEG</option>
                <option>MW</option>
                <option>ONT</option>
              </select>
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <select
                value={permitTypeFilter}
                onChange={(e) => setPermitTypeFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent appearance-none bg-white"
              >
                <option>All</option>
                <option>Electrical Permit</option>
                <option>Specialty/Tower Permit</option>
                <option>General Permit</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Permit ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Requestor</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Project Number</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Entity</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">State</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">City</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date Requested</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Signed PDF</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPermits.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-gray-500">
                      No permits found. Click "New Permit Request" to get started.
                    </td>
                  </tr>
                ) : (
                  filteredPermits.map((permit) => (
                    <tr
                      key={permit.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-[#0072BC]">{permit.permit_id}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{permit.requestor}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{permit.ontivity_project_number}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{permit.performing_entity}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{permit.type_of_permit}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{permit.state}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{permit.city}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(permit.status)}`}>
                          {permit.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{formatDate(permit.date_of_request)}</td>
                      <td className="px-6 py-4">
                        {permit.signed_pdf_url ? (
                          <a
                            href={permit.signed_pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[#0072BC] hover:text-[#005a94] font-medium text-sm"
                          >
                            <FileText size={16} />
                            View PDF
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">Not signed</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => onSelectPermit(permit.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0072BC] text-white text-sm font-medium rounded-md hover:bg-[#005a94] transition-colors"
                        >
                          <Eye size={16} />
                          View Form
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredPermits.length} of {permits.length} permits
        </div>
      </div>
    </div>
  );
}
