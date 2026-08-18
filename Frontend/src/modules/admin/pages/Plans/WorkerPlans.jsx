import React, { useState, useEffect } from 'react';
import api from '../../../../services/api';
import { serviceService } from '../../../../services/catalogService';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiInfo, FiGift, FiSave, FiTag, FiClock, FiCalendar, FiBell, FiCheck, FiImage } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

const toLocalDatetimeString = (dateInput) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const WorkerPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmPlan, setDeleteConfirmPlan] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  
  // Modal Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    duration: 1,
    durationUnit: 'MONTH',
    features: ['Unlimited Job Alerts', 'Direct Customer Contact'],
    newFeatureText: '',
    isActive: true,
    allowExtension: true
  });

  // FREE Trial Settings State
  const [trialSettings, setTrialSettings] = useState({
    enabled: true,
    duration: 1,
    durationUnit: 'MONTH',
    campaignStartDate: '',
    reminderDays: 3
  });
  const [trialLoading, setTrialLoading] = useState(true);
  const [trialSaving, setTrialSaving] = useState(false);

  const [dashboardBanners, setDashboardBanners] = useState([]);
  const [isBannersVisible, setIsBannersVisible] = useState(true);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [editingBannerIndex, setEditingBannerIndex] = useState(null);
  const [bannerForm, setBannerForm] = useState({ imageUrl: '', text: '', isActive: true });
  const [bannerUploading, setBannerUploading] = useState(false);

  useEffect(() => {
    fetchPlans();
    fetchTrialSettings();
    fetchDashboardBanners();
  }, []);

  const fetchTrialSettings = async () => {
    setTrialLoading(true);
    try {
      const res = await api.get('/admin/worker-plans/free-trial');
      if (res.data.success && res.data.data) {
        const d = res.data.data;
        setTrialSettings({
          enabled: d.enabled !== false,
          duration: d.duration ?? 1,
          durationUnit: d.durationUnit || 'MONTH',
          campaignStartDate: toLocalDatetimeString(d.campaignStartDate),
          reminderDays: d.reminderDays ?? 3
        });
      }
    } catch (error) {
      console.error('Fetch FREE trial settings failed', error);
      toast.error(error.response?.data?.message || 'Failed to load FREE trial settings');
    } finally {
      setTrialLoading(false);
    }
  };

  const fetchDashboardBanners = async () => {
    setBannerLoading(true);
    try {
      const res = await api.get('/admin/worker-plans/dashboard-banners');
      if (res.data.success && res.data.data) {
        setDashboardBanners(res.data.data.banners || []);
        setIsBannersVisible(res.data.data.isBannersVisible !== false);
      }
    } catch (error) {
      console.error('Fetch worker dashboard banners failed', error);
      toast.error(error.response?.data?.message || 'Failed to load worker dashboard banners');
    } finally {
      setBannerLoading(false);
    }
  };

  const handleSaveDashboardBanners = async () => {
    setBannerSaving(true);
    try {
      const res = await api.put('/admin/worker-plans/dashboard-banners', {
        isBannersVisible,
        banners: dashboardBanners.map((banner, index) => ({
          imageUrl: banner.imageUrl,
          text: banner.text || '',
          isActive: banner.isActive !== false,
          order: index
        }))
      });
      if (res.data.success) {
        setDashboardBanners(res.data.data.banners || []);
        setIsBannersVisible(res.data.data.isBannersVisible !== false);
        toast.success(res.data.message || 'Worker dashboard banners updated successfully.');
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to save worker dashboard banners');
    } finally {
      setBannerSaving(false);
    }
  };

  const resetBannerForm = () => {
    setBannerForm({ imageUrl: '', text: '', isActive: true });
    setEditingBannerIndex(null);
    setIsBannerModalOpen(false);
  };

  const handleBannerImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerUploading(true);
    try {
      const response = await serviceService.uploadImage(file, 'worker-banners');
      if (response.success && response.imageUrl) {
        setBannerForm((prev) => ({ ...prev, imageUrl: response.imageUrl }));
        toast.success('Banner image uploaded');
      } else {
        toast.error(response.message || 'Failed to upload banner image');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to upload banner image');
    } finally {
      setBannerUploading(false);
    }
  };

  const saveBannerForm = () => {
    if (!bannerForm.imageUrl) {
      toast.error('Please upload a banner image');
      return;
    }
    if (editingBannerIndex !== null) {
      setDashboardBanners((prev) => prev.map((banner, index) => (
        index === editingBannerIndex ? { ...banner, ...bannerForm } : banner
      )));
    } else {
      setDashboardBanners((prev) => [...prev, { ...bannerForm, order: prev.length }]);
    }
    resetBannerForm();
  };

  const handleSaveTrialSettings = async (e) => {
    e.preventDefault();
    const duration = Number(trialSettings.duration);
    if (!Number.isInteger(duration) || duration < 1) {
      toast.error('Duration must be a positive whole number');
      return;
    }
    const reminderDays = Number(trialSettings.reminderDays);
    if (!Number.isInteger(reminderDays) || reminderDays < 0) {
      toast.error('Reminder days must be a non-negative whole number');
      return;
    }

    setTrialSaving(true);
    try {
      const payload = {
        enabled: trialSettings.enabled,
        duration,
        durationUnit: trialSettings.durationUnit,
        campaignStartDate: trialSettings.campaignStartDate ? new Date(trialSettings.campaignStartDate).toISOString() : null,
        reminderDays
      };

      const res = await api.put('/admin/worker-plans/free-trial', payload);
      if (res.data.success) {
        const d = res.data.data;
        setTrialSettings({
          enabled: d.enabled,
          duration: d.duration,
          durationUnit: d.durationUnit,
          campaignStartDate: toLocalDatetimeString(d.campaignStartDate),
          reminderDays: d.reminderDays ?? 3
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

  const handleAddFeature = () => {
    if (!formData.newFeatureText.trim()) return;
    setFormData(prev => ({
      ...prev,
      features: [...prev.features, prev.newFeatureText.trim()],
      newFeatureText: ''
    }));
  };

  const handleRemoveFeature = (index) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        price: Number(formData.price),
        duration: Number(formData.duration),
        durationUnit: formData.durationUnit,
        features: formData.features,
        isActive: formData.isActive,
        allowExtension: formData.allowExtension
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
      duration: plan.duration || (plan.durationDays >= 30 ? Math.round(plan.durationDays / 30) : plan.durationDays),
      durationUnit: plan.durationUnit || (plan.durationDays % 7 === 0 && plan.durationDays < 30 ? 'WEEK' : 'MONTH'),
      features: Array.isArray(plan.features) && plan.features.length > 0 ? plan.features : ['Unlimited Job Alerts', 'Direct Customer Contact'],
      newFeatureText: '',
      isActive: plan.isActive !== false,
      allowExtension: plan.allowExtension !== undefined ? plan.allowExtension : true
    });
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmPlan) return;
    try {
      await api.delete(`/admin/worker-plans/${deleteConfirmPlan._id}`);
      toast.success('Plan removed successfully');
      setDeleteConfirmPlan(null);
      fetchPlans();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to delete plan');
    }
  };

  const openCreateModal = () => {
    setCurrentPlan(null);
    setFormData({
      title: '',
      description: '',
      price: '',
      duration: 1,
      durationUnit: 'MONTH',
      features: ['Unlimited Job Alerts', 'Direct Customer Contact'],
      newFeatureText: '',
      isActive: true,
      allowExtension: true
    });
    setIsModalOpen(true);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto font-sans">
      {/* Page Title & Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Worker Plans</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Manage worker subscription plans and FREE trial settings</p>
        </div>
      </div>

      {/* Section 1: New Worker FREE Period Settings Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <FiGift className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">New Worker FREE Period Settings</h2>
              <p className="text-xs text-slate-500 mt-0.5">First-time workers will get a FREE subscription for the duration below. Existing workers will not be affected.</p>
            </div>
          </div>
          {!trialLoading && (
            <span className={`px-3 py-1 text-[11px] font-extrabold tracking-wider rounded-full uppercase shrink-0 ${
              trialSettings.enabled ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60' : 'bg-slate-100 text-slate-600'
            }`}>
              {trialSettings.enabled ? 'ON' : 'OFF'}
            </span>
          )}
        </div>

        {trialLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <form onSubmit={handleSaveTrialSettings} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 items-end">
              
              {/* Control 1: Enable Toggle */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Enable FREE Period</label>
                <button
                  type="button"
                  onClick={() => setTrialSettings((prev) => ({ ...prev, enabled: !prev.enabled }))}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm border transition-all flex items-center justify-between ${
                    trialSettings.enabled
                      ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{trialSettings.enabled ? 'Enabled' : 'Disabled'}</span>
                  <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${trialSettings.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${trialSettings.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>

              {/* Control 2: Campaign Start Date & Time */}
              <div className="space-y-1.5 lg:col-span-1">
                <label className="text-xs font-bold text-slate-700 block flex items-center gap-1">
                  <FiCalendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Campaign Start Date & Time</span>
                </label>
                <input
                  type="datetime-local"
                  value={trialSettings.campaignStartDate}
                  onChange={(e) => setTrialSettings((prev) => ({ ...prev, campaignStartDate: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-medium text-slate-800 text-xs transition-all"
                />
              </div>

              {/* Control 3: FREE Period Duration */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">FREE Period Duration</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={trialSettings.duration}
                  onChange={(e) => setTrialSettings((prev) => ({ ...prev, duration: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-bold text-slate-800 text-sm transition-all"
                  required
                />
              </div>

              {/* Control 4: Duration Unit (Weeks / Months) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Duration Unit</label>
                <div className="relative">
                  <select
                    value={trialSettings.durationUnit}
                    onChange={(e) => setTrialSettings((prev) => ({ ...prev, durationUnit: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-bold text-slate-800 text-sm transition-all appearance-none cursor-pointer pr-10"
                  >
                    <option value="WEEK">Weeks</option>
                    <option value="MONTH">Months</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Control 5: Reminder Days */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block flex items-center gap-1">
                  <FiBell className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Reminder Days</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={trialSettings.reminderDays}
                  onChange={(e) => setTrialSettings((prev) => ({ ...prev, reminderDays: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-bold text-slate-800 text-sm transition-all"
                  required
                />
              </div>

            </div>

            {/* Helper hints */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 font-normal pt-1 border-t border-slate-100">
              <p>⚡ Turning this ON grants a FREE trial to existing workers who never received one. Changing duration does not change active trial end dates.</p>
              {trialSettings.campaignStartDate && (
                <p className="text-indigo-600 font-medium shrink-0">
                  📅 Eligible for registrations on/after: {new Date(trialSettings.campaignStartDate).toLocaleString()}
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={trialSaving}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-100 transition-all active:scale-95 disabled:opacity-60"
              >
                <FiSave className="w-4 h-4" />
                <span>{trialSaving ? 'Saving...' : 'Update Settings'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Section 2: Worker Dashboard Banners */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
              <FiImage className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Worker Dashboard Banners</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                These banners appear at the top of the worker home dashboard. If none are set here, banners from User Catalog → Home are used as a fallback.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsBannersVisible((prev) => !prev)}
              className={`px-3 py-1.5 text-[11px] font-extrabold tracking-wider rounded-full uppercase border ${
                isBannersVisible
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {isBannersVisible ? 'Visible' : 'Hidden'}
            </button>
            <button
              type="button"
              onClick={() => {
                setBannerForm({ imageUrl: '', text: '', isActive: true });
                setEditingBannerIndex(null);
                setIsBannerModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm"
            >
              <FiPlus className="w-4 h-4" />
              Add Banner
            </button>
          </div>
        </div>

        {bannerLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600"></div>
          </div>
        ) : dashboardBanners.length === 0 ? (
          <div className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl p-6 text-center">
            No worker dashboard banners yet. Add one to show it on the worker home page.
          </div>
        ) : (
          <div className="space-y-3">
            {dashboardBanners.map((banner, index) => (
              <div key={`${banner.imageUrl}-${index}`} className="flex items-center gap-4 p-3 border border-slate-100 rounded-xl">
                <img src={banner.imageUrl} alt={banner.text || 'Banner'} className="w-24 h-14 object-cover rounded-lg border border-slate-200" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{banner.text || 'No caption'}</p>
                  <p className="text-xs text-slate-400">Order: {index + 1}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBannerForm({
                        imageUrl: banner.imageUrl,
                        text: banner.text || '',
                        isActive: banner.isActive !== false
                      });
                      setEditingBannerIndex(index);
                      setIsBannerModalOpen(true);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashboardBanners((prev) => prev.filter((_, i) => i !== index))}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 mt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSaveDashboardBanners}
            disabled={bannerSaving || bannerLoading}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm disabled:opacity-60"
          >
            <FiSave className="w-4 h-4" />
            {bannerSaving ? 'Saving...' : 'Save Dashboard Banners'}
          </button>
        </div>
      </div>

      {/* Section 3: Subscription Plans Header & Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-6 md:p-7 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Subscription Plans</h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage plans that workers can purchase to receive job alerts and other benefits.</p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-100 transition-all active:scale-95 shrink-0"
          >
            <FiPlus className="w-4 h-4 stroke-[2.5]" />
            <span>Add New Plan</span>
          </button>
        </div>

        {/* Plans Table View */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : plans.length === 0 ? (
          <div className="py-16 text-center px-4">
            <FiInfo className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-700 font-bold text-base">No subscription plans yet.</p>
            <p className="text-slate-400 text-xs mt-1 mb-5">Create your first worker subscription plan to get started.</p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-indigo-700 transition-all"
            >
              <FiPlus className="w-4 h-4" />
              <span>Add New Plan</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Plan Name</th>
                  <th className="py-3.5 px-6">Price</th>
                  <th className="py-3.5 px-6">Duration</th>
                  <th className="py-3.5 px-6">Unit</th>
                  <th className="py-3.5 px-6">Features</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {plans.map((plan) => {
                  const displayUnit = plan.durationUnit 
                    ? (plan.durationUnit === 'WEEK' ? 'Week' : plan.durationUnit === 'MONTH' ? 'Month' : 'Day')
                    : (plan.durationDays % 7 === 0 && plan.durationDays < 30 ? 'Week' : 'Month');
                  
                  const displayDuration = plan.duration || (
                    plan.durationUnit === 'WEEK' ? Math.round(plan.durationDays / 7) : 
                    plan.durationUnit === 'MONTH' ? Math.round(plan.durationDays / 30) : plan.durationDays
                  );

                  return (
                    <tr key={plan._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                            <FiTag className="w-4 h-4" />
                          </div>
                          <span>{plan.title}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-extrabold text-slate-900">
                        ₹{plan.price}
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-700">
                        {displayDuration}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-600 capitalize">
                        {displayUnit}{displayDuration > 1 ? 's' : ''}
                      </td>
                      <td className="py-4 px-6 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(plan.features) && plan.features.length > 0 ? (
                            plan.features.map((feat, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                                <FiCheck className="w-3 h-3 text-emerald-600" />
                                {feat}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">Standard Alerts</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex px-2.5 py-1 text-[10px] font-extrabold tracking-wider rounded-md uppercase ${
                          plan.isActive !== false ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {plan.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(plan)}
                            className="px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg font-bold transition-colors inline-flex items-center gap-1 text-xs"
                            title="Edit Plan"
                          >
                            <FiEdit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => setDeleteConfirmPlan(plan)}
                            className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-bold transition-colors inline-flex items-center gap-1 text-xs"
                            title="Delete Plan"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Plan Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white shrink-0">
              <h2 className="text-base font-bold">{currentPlan ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="hover:opacity-80 transition-opacity p-1">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-slate-800">
              {/* Plan Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Plan Name</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm font-semibold"
                  placeholder="e.g. Standard Unlimited"
                  required
                />
              </div>

              {/* Price & Duration Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <label className="text-xs font-bold text-slate-700 block">Price (₹)</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-bold text-sm"
                    placeholder="299"
                    required
                  />
                </div>
                <div className="space-y-1.5 col-span-1">
                  <label className="text-xs font-bold text-slate-700 block">Duration</label>
                  <input
                    type="number"
                    name="duration"
                    min="1"
                    value={formData.duration}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-bold text-sm"
                    placeholder="1"
                    required
                  />
                </div>
                <div className="space-y-1.5 col-span-1">
                  <label className="text-xs font-bold text-slate-700 block">Duration Unit</label>
                  <select
                    name="durationUnit"
                    value={formData.durationUnit}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-bold text-xs cursor-pointer"
                  >
                    <option value="WEEK">Week</option>
                    <option value="MONTH">Month</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all min-h-[70px] text-xs"
                  placeholder="Describe the plan benefits..."
                />
              </div>

              {/* Features List Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Features</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.newFeatureText}
                    onChange={(e) => setFormData(prev => ({ ...prev, newFeatureText: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature(); } }}
                    placeholder="Add a feature (e.g. Unlimited Job Alerts)..."
                    className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddFeature}
                    className="px-3.5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {formData.features.map((feat, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                      {feat}
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(idx)}
                        className="hover:text-rose-600 p-0.5"
                      >
                        <FiX className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Status & Extension Toggles */}
              <div className="space-y-3 py-3 border-t border-slate-100 mt-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="isActive" className="text-xs font-bold text-slate-700 cursor-pointer">Active (Visible for purchase)</label>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="allowExtension"
                    name="allowExtension"
                    checked={formData.allowExtension}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer mt-0.5"
                  />
                  <div>
                    <label htmlFor="allowExtension" className="text-xs font-bold text-slate-700 cursor-pointer block">Allow Active Workers to Extend</label>
                    <p className="text-[11px] text-slate-400 leading-normal">If unchecked, workers with active subscriptions cannot extend using this plan.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-xs shadow-sm"
                >
                  {currentPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete */}
      {deleteConfirmPlan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <FiTrash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Remove Subscription Plan?</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Are you sure you want to remove <span className="font-bold text-slate-800">"{deleteConfirmPlan.title}"</span>? Existing worker subscriptions will not be affected.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmPlan(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Dashboard Banner Modal */}
      {isBannerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-amber-500 text-white">
              <h2 className="text-base font-bold">{editingBannerIndex !== null ? 'Edit Dashboard Banner' : 'Add Dashboard Banner'}</h2>
              <button onClick={resetBannerForm} className="hover:opacity-80 transition-opacity p-1">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Banner Image</label>
                {bannerForm.imageUrl ? (
                  <img src={bannerForm.imageUrl} alt="Banner preview" className="w-full h-32 object-cover rounded-xl border border-slate-200" />
                ) : (
                  <div className="w-full h-32 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-sm">
                    No image selected
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBannerImageUpload}
                  disabled={bannerUploading}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-semibold"
                />
                {bannerUploading && <p className="text-xs text-slate-500">Uploading image...</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Caption (optional)</label>
                <input
                  type="text"
                  value={bannerForm.text}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, text: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  placeholder="Short text shown on the banner"
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={bannerForm.isActive}
                  onChange={(e) => setBannerForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Active
              </label>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetBannerForm}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveBannerForm}
                  disabled={bannerUploading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs disabled:opacity-60"
                >
                  {editingBannerIndex !== null ? 'Update Banner' : 'Add Banner'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default WorkerPlans;
