import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiX, FiEye, FiSearch, FiFilter, FiDownload, FiLoader, FiDollarSign, FiPower, FiTrash2, FiMapPin } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import CardShell from '../UserCategories/components/CardShell';
import Modal from '../UserCategories/components/Modal';
import adminWorkerService from '../../../../services/adminWorkerService';

const formatWorkerLocation = (address) => {
  if (!address) return 'Not set';

  if (address.fullAddress && String(address.fullAddress).trim()) {
    return String(address.fullAddress).trim();
  }

  const parts = [
    address.addressLine1,
    address.addressLine2,
    address.landmark,
    address.city,
    address.state,
    address.pincode
  ].filter(Boolean);

  return parts.length ? parts.join(', ') : 'Not set';
};

const AllWorkers = () => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'approved', 'rejected'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Load workers from backend
  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    try {
      setLoading(true);
      const response = await adminWorkerService.getAllWorkers();
      if (response.success) {
        // Transform backend data to frontend format
        const transformedWorkers = response.data.map(worker => ({
          id: worker._id,
          name: worker.name,
          email: worker.email,
          phone: worker.phone,
          location: formatWorkerLocation(worker.address),
          address: worker.address || {},
          serviceCategory: worker.serviceCategories?.length ? worker.serviceCategories.join(', ') : worker.serviceCategory || worker.service || 'N/A',
          approvalStatus: worker.approvalStatus,
          isDeleted: worker.isDeleted || false,
          deletedAt: worker.deletedAt || null,
          deleteReason: worker.deleteReason || null,
          totalJobs: worker.totalJobs || 0,
          completedJobs: worker.completedJobs || 0,
          rating: worker.rating || 0,
          wallet: worker.wallet || {},
          aadhar: worker.aadhar?.number,
          pan: worker.pan?.number,
          documents: {
            aadhar: worker.aadhar?.document,
            aadharBack: worker.aadhar?.backDocument,
            pan: worker.pan?.document,
            other: worker.otherDocuments?.[0]
          },
          createdAt: worker.createdAt,
          isActive: worker.isActive,
          subscription: worker.subscription || { isActive: false }
        }));
        setWorkers(transformedWorkers);
      } else {
        toast.error(response.message || 'Failed to load workers');
      }
    } catch (error) {
      console.error('Error loading workers:', error);
      toast.error('Failed to load workers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkers = useMemo(() => {
    return workers.filter(worker => {
      let matchesStatus = true;
      if (filterStatus === 'deleted') {
        matchesStatus = worker.isDeleted === true;
      } else if (filterStatus === 'all') {
        matchesStatus = true;
      } else {
        matchesStatus = worker.approvalStatus === filterStatus && !worker.isDeleted;
      }

      const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
      
      const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => 
        worker.name?.toLowerCase().includes(term) ||
        worker.email?.toLowerCase().includes(term) ||
        worker.phone?.includes(term) ||
        worker.location?.toLowerCase().includes(term) ||
        worker.serviceCategory?.toLowerCase().includes(term)
      );
      return matchesStatus && matchesSearch;
    });
  }, [workers, filterStatus, searchQuery]);

  const handleApprove = async (workerId) => {
    try {
      const response = await adminWorkerService.approveWorker(workerId);
      if (response.success) {
        setWorkers(prev => prev.map(w =>
          w.id === workerId ? { ...w, approvalStatus: 'approved' } : w
        ));
        toast.success('Worker approved successfully!');
      } else {
        toast.error(response.message || 'Failed to approve worker');
      }
    } catch (error) {
      console.error('Error approving worker:', error);
      toast.error('Failed to approve worker. Please try again.');
    }
  };

  const handleReject = async (workerId) => {
    try {
      const response = await adminWorkerService.rejectWorker(workerId);
      if (response.success) {
        setWorkers(prev => prev.map(w =>
          w.id === workerId ? { ...w, approvalStatus: 'rejected' } : w
        ));
        toast.success('Worker rejected successfully.');
      } else {
        toast.error(response.message || 'Failed to reject worker');
      }
    } catch (error) {
      console.error('Error rejecting worker:', error);
      toast.error('Failed to reject worker. Please try again.');
    }
  };

  const handleToggleStatus = async (workerId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      const response = await adminWorkerService.toggleStatus(workerId, newStatus);
      if (response.success) {
        setWorkers(prev => prev.map(w =>
          w.id === workerId ? { ...w, isActive: newStatus } : w
        ));
        toast.success(`Worker ${newStatus ? 'activated' : 'deactivated'} successfully`);
      } else {
        toast.error(response.message || 'Failed to update worker status');
      }
    } catch (error) {
      console.error('Error toggling worker status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (workerId) => {
    if (!window.confirm('Are you sure you want to delete this worker? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await adminWorkerService.deleteWorker(workerId);
      if (response.success) {
        setWorkers(prev => prev.filter(w => w.id !== workerId));
        toast.success('Worker deleted successfully');
      } else {
        toast.error(response.message || 'Failed to delete worker');
      }
    } catch (error) {
      console.error('Error deleting worker:', error);
      toast.error('Failed to delete worker');
    }
  };

  const handleViewDetails = (worker) => {
    setSelectedWorker(worker);
    setIsViewModalOpen(true);
  };

  const handlePayClick = (worker) => {
    setSelectedWorker(worker);
    setPayAmount('');
    setPayNotes('');
    setIsPayModalOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!payAmount || isNaN(payAmount) || parseFloat(payAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      setPaySubmitting(true);
      const res = await adminWorkerService.payWorker(selectedWorker.id, {
        amount: parseFloat(payAmount),
        notes: payNotes
      });

      if (res.success) {
        toast.success(`Payment of ₹${payAmount} recorded for ${selectedWorker.name}`);
        setIsPayModalOpen(false);
        loadWorkers(); // Refresh data
      } else {
        toast.error(res.message || 'Failed to record payment');
      }
    } catch (error) {
      toast.error('Failed to process payment');
    } finally {
      setPaySubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const pendingCount = workers.filter(w => w.approvalStatus === 'pending' && !w.isDeleted).length;
  const approvedCount = workers.filter(w => w.approvalStatus === 'approved' && !w.isDeleted).length;
  const rejectedCount = workers.filter(w => w.approvalStatus === 'rejected' && !w.isDeleted).length;
  const deletedCount = workers.filter(w => w.isDeleted).length;

  return (
    <div className="space-y-4">
      <CardShell
        icon={FiFilter}
        title="Worker Management"
        subtitle="Manage and verify platform workers"
      >
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
            <div className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider mb-1">Pending</div>
            <div className="text-xl font-bold text-yellow-900">{pendingCount}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <div className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-1">Approved</div>
            <div className="text-xl font-bold text-green-900">{approvedCount}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">Rejected</div>
            <div className="text-xl font-bold text-red-900">{rejectedCount}</div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
            <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1">Deleted</div>
            <div className="text-xl font-bold text-rose-900">{deletedCount}</div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search workers by name, phone, email, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all text-xs"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { key: 'all', label: 'All Workers' },
              { key: 'pending', label: 'Pending' },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
              { key: 'deleted', label: 'Deleted Accounts' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${filterStatus === key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Worker Details</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Subscription</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-xs text-gray-500">Loading workers...</td>
                  </tr>
                ) : filteredWorkers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-xs text-gray-500">No workers found</td>
                  </tr>
                ) : (
                  filteredWorkers.map((worker) => (
                    <tr key={worker.id} className={`hover:bg-gray-50 transition-colors ${worker.isDeleted ? 'bg-rose-50/20' : ''}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                            {worker.name}
                            {worker.isDeleted && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded border border-rose-200">
                                DELETED
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-gray-600 font-medium">{worker.phone}</p>
                          <p className="text-[10px] text-gray-400">{worker.email || 'No email'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1.5 max-w-[220px]">
                          <FiMapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                          <p className={`text-[11px] leading-snug ${worker.location === 'Not set' ? 'text-gray-400 italic' : 'text-gray-700'}`}>
                            {worker.location}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {worker.serviceCategory && worker.serviceCategory !== 'N/A' ? (
                            worker.serviceCategory.split(', ').map((cat, idx) => (
                              <span key={idx} className="text-[11px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                                {cat}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                              N/A
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {worker.isDeleted ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200 w-fit">
                              Account Deleted
                            </span>
                            {worker.deletedAt && (
                              <span className="text-[10px] text-rose-600/80 font-medium">
                                On {new Date(worker.deletedAt).toLocaleDateString('en-US', {
                                  year: 'numeric', month: 'short', day: 'numeric'
                                })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${worker.approvalStatus === 'approved' ? 'bg-green-50 text-green-700 border-green-100' :
                            worker.approvalStatus === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                              'bg-yellow-50 text-yellow-700 border-yellow-100'
                            }`}>
                            {worker.approvalStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {worker.subscription?.isActive && worker.subscription?.expiryDate && new Date(worker.subscription.expiryDate) > new Date() ? (
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-purple-700">
                              {worker.subscription.planType === 'TRIAL' ? 'FREE TRIAL' : worker.subscription.planName}
                            </span>
                            <span className="text-[9px] text-gray-500">Exp: {new Date(worker.subscription.expiryDate).toLocaleDateString()}</span>
                          </div>
                        ) : worker.subscription?.expiryDate ? (
                          <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                            Expired
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                            No Plan
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {/* View Details */}
                          <button
                            onClick={() => handleViewDetails(worker)}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="View Details & History"
                          >
                            <FiEye className="w-3.5 h-3.5" />
                          </button>

                          {worker.isDeleted ? (
                            <span className="text-[10px] text-gray-400 font-mono italic">
                              History Preserved
                            </span>
                          ) : (
                            <>
                              {/* Toggle Active Status */}
                              <button
                                onClick={() => handleToggleStatus(worker.id, worker.isActive)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${worker.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                title={worker.isActive ? "Disable Login" : "Enable Login"}
                              >
                                <FiPower className={`w-3.5 h-3.5 ${worker.isActive ? 'fill-current' : ''}`} />
                              </button>

                              {/* Approve/Reject (Only for pending) */}
                              {worker.approvalStatus === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleApprove(worker.id)}
                                    className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
                                    title="Approve"
                                  >
                                    <FiCheck className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleReject(worker.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="Reject"
                                  >
                                    <FiX className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              {/* Delete Worker */}
                              <button
                                onClick={() => handleDelete(worker.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Worker (Soft Delete)"
                              >
                                <FiTrash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardShell>

      {/* View Worker Details Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedWorker(null);
        }}
        title="Worker Details"
        size="lg"
      >
        {selectedWorker && (
          <div className="space-y-6">
            {/* Deletion Warning Banner */}
            {selectedWorker.isDeleted && (
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0 mt-0.5">
                  ⚠️
                </div>
                <div>
                  <h4 className="text-sm font-black text-rose-900">
                    Account Deleted {selectedWorker.deletedAt ? `on ${new Date(selectedWorker.deletedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
                  </h4>
                  <p className="text-xs text-rose-700 mt-0.5">
                    {selectedWorker.deleteReason ? `Reason: ${selectedWorker.deleteReason}` : 'This worker deleted their account. All previous job history, ratings, and records are retained for auditing.'}
                  </p>
                </div>
              </div>
            )}

            {/* Historical Job & Performance Stats */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 text-center">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Jobs</span>
                <p className="text-base font-black text-gray-900">{selectedWorker.totalJobs || 0}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Completed</span>
                <p className="text-base font-black text-emerald-600">{selectedWorker.completedJobs || 0}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rating</span>
                <p className="text-base font-black text-amber-500">★ {selectedWorker.rating || '0.0'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                <div className="text-gray-900 font-medium">{selectedWorker.name}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <div className="text-gray-900">{selectedWorker.email}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                <div className="text-gray-900">{selectedWorker.phone}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Location</label>
                <div className="text-gray-900">{selectedWorker.location || 'Not set'}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Service Category</label>
                <div className="text-gray-900">{selectedWorker.serviceCategory}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Aadhar</label>
                <div className="text-gray-900">{selectedWorker.aadhar}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">PAN</label>
                <div className="text-gray-900">{selectedWorker.pan}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                <div>{getStatusBadge(selectedWorker.approvalStatus)}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Active</label>
                <div className={`text-sm font-semibold ${selectedWorker.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedWorker.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Registered</label>
                <div className="text-gray-900">
                  {new Date(selectedWorker.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Subscription Info */}
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
              <h4 className="text-sm font-bold text-purple-900 mb-3 flex items-center gap-2">
                <FiDollarSign className="w-4 h-4" />
                Subscription Info
              </h4>
              {selectedWorker.subscription?.isActive && selectedWorker.subscription?.expiryDate && new Date(selectedWorker.subscription.expiryDate) > new Date() ? (
                <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-purple-600 mb-0.5">Active Plan</label>
                    <div className="text-sm font-bold text-gray-900">
                      {selectedWorker.subscription.planType === 'TRIAL' ? 'FREE TRIAL' : selectedWorker.subscription.planName}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-purple-600 mb-0.5">Expiry Date</label>
                    <div className="text-sm font-bold text-red-600">
                      {new Date(selectedWorker.subscription.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-purple-600 mb-0.5">Started On</label>
                    <div className="text-sm text-gray-700">
                      {new Date(selectedWorker.subscription.startDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-purple-600 mb-0.5">Duration</label>
                    <div className="text-sm text-gray-700">
                      {selectedWorker.subscription.planType === 'TRIAL' && selectedWorker.subscription.trialDuration
                        ? `${selectedWorker.subscription.trialDuration} ${selectedWorker.subscription.trialDurationUnit === 'MONTH' ? 'Month' : 'Day'}${selectedWorker.subscription.trialDuration > 1 ? 's' : ''}`
                        : `${selectedWorker.subscription.durationDays} Days`}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-purple-700 italic">
                  {selectedWorker.subscription?.expiryDate ? 'Subscription expired. Worker must upgrade to a paid plan.' : 'No active subscription found for this worker.'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Documents</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedWorker.documents.aadhar && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-2">Aadhar Front</label>
                    <img
                      src={selectedWorker.documents.aadhar}
                      alt="Aadhar Front"
                      className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <a
                      href={selectedWorker.documents.aadhar}
                      download
                      className="mt-2 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <FiDownload className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                )}
                {selectedWorker.documents.aadharBack && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-2">Aadhar Back</label>
                    <img
                      src={selectedWorker.documents.aadharBack}
                      alt="Aadhar Back"
                      className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <a
                      href={selectedWorker.documents.aadharBack}
                      download
                      className="mt-2 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <FiDownload className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                )}
                {selectedWorker.documents.pan && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-2">PAN Document</label>
                    <img
                      src={selectedWorker.documents.pan}
                      alt="PAN"
                      className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <a
                      href={selectedWorker.documents.pan}
                      download
                      className="mt-2 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <FiDownload className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                )}
              </div>
            </div>

            {selectedWorker.approvalStatus === 'pending' && (
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={async () => {
                    await handleApprove(selectedWorker.id);
                    setIsViewModalOpen(false);
                    setSelectedWorker(null);
                  }}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <FiCheck className="w-5 h-5" />
                  Approve Worker
                </button>
                <button
                  onClick={async () => {
                    await handleReject(selectedWorker.id);
                    setIsViewModalOpen(false);
                    setSelectedWorker(null);
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <FiX className="w-5 h-5" />
                  Reject Worker
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Pay Worker Modal */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => {
          setIsPayModalOpen(false);
          setSelectedWorker(null);
        }}
        title={`Record Payment for ${selectedWorker?.name}`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Amount (₹)</label>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (Optional)</label>
            <textarea
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="Add payment reference or notes"
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleRecordPayment}
            disabled={paySubmitting}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {paySubmitting ? 'Processing...' : 'Confirm Payment'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default AllWorkers;

