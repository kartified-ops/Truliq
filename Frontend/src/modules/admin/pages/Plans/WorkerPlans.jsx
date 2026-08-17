import React, { useState, useEffect } from 'react';
import api from '../../../../services/api';
import { FiPlus, FiEdit2, FiTrash2, FiCheck, FiX, FiInfo, FiClock, FiTag, FiGift, FiSave } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

const WorkerPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    durationDays: 30,
    isActive: true,
    allowExtension: true
  });
  const [trialSettings, setTrialSettings] = useState({
    enabled: true,
    duration: 1,
    durationUnit: 'MONTH'
  });
  const [trialLoading, setTrialLoading] = useState(true);
  const [trialSaving, setTrialSaving] = useState(false);

  useEffect(() => {
    fetchPlans();
    fetchTrialSettings();
  }, []);

  const fetchTrialSettings = async () => {
    setTrialLoading(true);
    try {
      const res = await api.get('/admin/worker-plans/free-trial');
      if (res.data.success && res.data.data) {
        setTrialSettings({
          enabled: res.data.data.enabled !== false,
          duration: res.data.data.duration ?? 1,
          durationUnit: res.data.data.durationUnit || 'MONTH'
        });
      }
    } catch (error) {
      console.error('Fetch FREE trial settings failed', error);
      toast.error(error.response?.data?.message || 'Failed to load FREE trial settings');
    } finally {
      setTrialLoading(false);
    }
  };

  const handleSaveTrialSettings = async (e) => {
    e.preventDefault();
    const duration = Number(trialSettings.duration);
    if (!Number.isInteger(duration) || duration < 1) {
      toast.error('Duration must be a positive whole number');
      return;
    }
    setTrialSaving(true);
    try {
      const res = await api.put('/admin/worker-plans/free-trial', {
        enabled: trialSettings.enabled,
        duration,
        durationUnit: trialSettings.durationUnit
      });
      if (res.data.success) {
        setTrialSettings({
          enabled: res.data.data.enabled,
          duration: res.data.data.duration,
          durationUnit: res.data.data.durationUnit
        });
        toast.success(res.data.message || 'FREE trial settings updated successfully.');
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to update FREE trial settings');
    } finally {
      setTrialSaving(false);
    }
  };

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/worker-plans');
      if (res.data.success) {
        setPlans(res.data.data);
      }
    } catch (error) {
      console.error('Fetch plans failed', error);
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        price: Number(formData.price),
        durationDays: Number(formData.durationDays)
      };

      if (currentPlan) {
        await api.put(`/admin/worker-plans/${currentPlan._id}`, payload);
        toast.success('Plan updated successfully');
      } else {
        await api.post('/admin/worker-plans', payload);
        toast.success('Plan created successfully');
      }
      setIsModalOpen(false);
      fetchPlans();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Error saving plan');
    }
  };

  const handleEdit = (plan) => {
    setCurrentPlan(plan);
    setFormData({
      title: plan.title,
      description: plan.description || '',
      price: plan.price,
      durationDays: plan.durationDays,
      isActive: plan.isActive,
      allowExtension: plan.allowExtension !== undefined ? plan.allowExtension : true
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;
    try {
      await api.delete(`/admin/worker-plans/${id}`);
      toast.success('Plan deleted successfully');
      fetchPlans();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete plan');
    }
  };

  const openCreateModal = () => {
    setCurrentPlan(null);
    setFormData({
      title: '',
      description: '',
      price: '',
      durationDays: 30,
      isActive: true,
      allowExtension: true
    });
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Worker Subscription Plans</h1>
          <p className="text-gray-500">Manage plans that workers purchase to receive job alerts</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-md"
        >
          <FiPlus /> Add New Plan
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
              <FiGift className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">FREE Trial Settings</h2>
              <p className="text-sm text-gray-500">First-time workers receive this duration. Existing trials are never changed.</p>
            </div>
          </div>
          {!trialLoading && (
            <span className={`px-3 py-1 text-xs font-bold rounded-full ${trialSettings.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {trialSettings.enabled ? 'ON' : 'OFF'}
            </span>
          )}
        </div>

        {trialLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <form onSubmit={handleSaveTrialSettings} className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">FREE Trial Status</label>
                <button
                  type="button"
                  onClick={() => setTrialSettings((prev) => ({ ...prev, enabled: !prev.enabled }))}
                  className={`w-full px-4 py-3 rounded-xl font-bold text-sm border transition-all ${
                    trialSettings.enabled
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}
                >
                  {trialSettings.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">FREE Trial Duration</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={trialSettings.duration}
                  onChange={(e) => setTrialSettings((prev) => ({ ...prev, duration: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">Duration Unit</label>
                <select
                  value={trialSettings.durationUnit}
                  onChange={(e) => setTrialSettings((prev) => ({ ...prev, durationUnit: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                >
                  <option value="DAY">Day</option>
                  <option value="MONTH">Month</option>
                </select>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Changing this duration only applies to workers who register after you save. Active FREE trials keep the end date they were originally granted.
            </p>

            <button
              type="submit"
              disabled={trialSaving}
              className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-60"
            >
              <FiSave className="w-4 h-4" />
              {trialSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div key={plan._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                    <FiTag className="w-6 h-6" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 justify-end">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {plan.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                    <span className={`px-2 py-1 text-[11px] font-bold rounded-full ${plan.allowExtension !== false ? 'bg-blue-50 text-blue-700 border border-blue-200/60' : 'bg-amber-50 text-amber-700 border border-amber-200/60'}`}>
                      {plan.allowExtension !== false ? 'EXTENSION ALLOWED' : 'EXTENSION DISABLED'}
                    </span>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-gray-800 mb-1">{plan.title}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-black text-gray-900">₹{plan.price}</span>
                  <span className="text-gray-500 text-sm">/ {plan.durationDays} days</span>
                </div>

                <p className="text-gray-600 text-sm mb-6 line-clamp-3">
                  {plan.description || 'No description provided.'}
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                    <FiCheck className="text-green-500" />
                    <span>Receive Unlimited Job Alerts</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                    <FiCheck className="text-green-500" />
                    <span>Direct Contact with Users</span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button
                  onClick={() => handleEdit(plan)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit Plan"
                >
                  <FiEdit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(plan._id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Plan"
                >
                  <FiTrash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          {plans.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
              <FiInfo className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No worker plans found. Click "Add New Plan" to create one.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-5 py-4 sm:px-8 sm:py-5 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white shrink-0">
              <h2 className="text-lg sm:text-xl font-bold">{currentPlan ? 'Edit Worker Plan' : 'Create New Worker Plan'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="hover:rotate-90 transition-transform p-1">
                <FiX className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">Plan Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm sm:text-base"
                  placeholder="e.g. Monthly Gold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Price (₹)</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm sm:text-base"
                    placeholder="499"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Duration (Days)</label>
                  <input
                    type="number"
                    name="durationDays"
                    value={formData.durationDays}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-sm sm:text-base"
                    placeholder="30"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[70px] sm:min-h-[90px] text-sm sm:text-base"
                  placeholder="What benefits does this plan offer?"
                />
              </div>

              <div className="space-y-3 py-2 border-t border-gray-100 mt-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="isActive" className="text-sm font-bold text-gray-700 cursor-pointer">Active (Visible to Workers)</label>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="allowExtension"
                    name="allowExtension"
                    checked={formData.allowExtension}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer mt-0.5"
                  />
                  <div>
                    <label htmlFor="allowExtension" className="text-sm font-bold text-gray-700 cursor-pointer block">Allow Active Workers to Extend</label>
                    <p className="text-xs text-gray-500 leading-normal">If disabled (unchecked), workers who already have an active subscription cannot extend their subscription using this plan.</p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 sm:py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 text-sm sm:text-base"
              >
                {currentPlan ? 'Update Plan' : 'Create Plan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerPlans;
