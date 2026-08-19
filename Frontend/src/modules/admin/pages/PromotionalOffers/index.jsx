import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiGift, FiSearch, FiClock, FiUsers, FiEye } from 'react-icons/fi';
import api from '../../../../services/api';

const emptyForm = {
  name: '',
  description: '',
  offerType: 'FREE_PLATFORM_FEE',
  targetType: 'ALL_WORKERS',
  selectedWorkers: [],
  startDate: '',
  endDate: '',
  isActive: true
};

const statusStyles = {
  SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EXPIRED: 'bg-slate-100 text-slate-600 border-slate-200',
  INACTIVE: 'bg-amber-50 text-amber-700 border-amber-200'
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
};

const toIstDateInput = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
};

const addInclusiveDays = (startDate, days) => {
  if (!startDate || !days) return '';
  const [year, month, day] = startDate.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + (days - 1)));
  return next.toISOString().slice(0, 10);
};

const DURATION_PRESETS = [1, 2, 3, 7, 10];

const PromotionalOffers = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [workerSearch, setWorkerSearch] = useState('');
  const [workerResults, setWorkerResults] = useState([]);
  const [searchingWorkers, setSearchingWorkers] = useState(false);
  const [detailsOffer, setDetailsOffer] = useState(null);

  const durationDays = useMemo(() => {
    if (!form.startDate || !form.endDate) return 0;
    const start = new Date(`${form.startDate}T00:00:00`);
    const end = new Date(`${form.endDate}T00:00:00`);
    if (end < start) return 0;
    return Math.round((end - start) / 86400000) + 1;
  }, [form.startDate, form.endDate]);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/promotional-offers');
      if (res.data.success) setOffers(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load promotional offers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  useEffect(() => {
    if (form.targetType !== 'SELECTED_WORKERS') return undefined;
    const timer = setTimeout(async () => {
      setSearchingWorkers(true);
      try {
        const res = await api.get('/admin/promotional-offers/workers', { params: { search: workerSearch } });
        if (res.data.success) setWorkerResults(res.data.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setSearchingWorkers(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [form.targetType, workerSearch]);

  const openCreate = () => {
    setEditingOffer(null);
    setForm(emptyForm);
    setWorkerSearch('');
    setIsModalOpen(true);
  };

  const openEdit = (offer) => {
    setEditingOffer(offer);
    setForm({
      name: offer.name || '',
      description: offer.description || '',
      offerType: offer.offerType || 'FREE_PLATFORM_FEE',
      targetType: offer.targetType || 'ALL_WORKERS',
      selectedWorkers: (offer.selectedWorkers || []).map((worker) => (
        typeof worker === 'object' ? { id: worker._id, name: worker.name, phone: worker.phone } : { id: worker }
      )),
      startDate: toIstDateInput(offer.startDate),
      endDate: toIstDateInput(offer.endDate),
      isActive: offer.isActive !== false
    });
    setIsModalOpen(true);
  };

  const toggleWorker = (worker) => {
    setForm((prev) => {
      const exists = prev.selectedWorkers.some((item) => item.id === worker.id);
      return {
        ...prev,
        selectedWorkers: exists
          ? prev.selectedWorkers.filter((item) => item.id !== worker.id)
          : [...prev.selectedWorkers, worker]
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return toast.error('Offer name is required');
    if (!form.startDate || !form.endDate) return toast.error('Start date and end date are required');
    if (form.endDate < form.startDate) return toast.error('End date must be on or after start date.');
    if (form.targetType === 'SELECTED_WORKERS' && form.selectedWorkers.length === 0) {
      return toast.error('Select at least one worker');
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        offerType: form.offerType,
        targetType: form.targetType,
        selectedWorkers: form.selectedWorkers.map((worker) => worker.id),
        startDate: form.startDate,
        endDate: form.endDate,
        isActive: form.isActive
      };
      const res = editingOffer
        ? await api.put(`/admin/promotional-offers/${editingOffer._id}`, payload)
        : await api.post('/admin/promotional-offers', payload);
      if (res.data.success) {
        toast.success(res.data.message);
        setIsModalOpen(false);
        fetchOffers();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save promotional offer');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (offer) => {
    try {
      const res = await api.patch(`/admin/promotional-offers/${offer._id}/status`, { isActive: !offer.isActive });
      if (res.data.success) {
        toast.success(res.data.message);
        fetchOffers();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update offer status');
    }
  };

  const openDetails = async (offer) => {
    try {
      const res = await api.get(`/admin/promotional-offers/${offer._id}`);
      setDetailsOffer(res.data.success ? res.data.data : offer);
    } catch (error) {
      setDetailsOffer(offer);
    }
  };

  const handleDelete = async (offer) => {
    if (!window.confirm('Cancel this promotional offer? Future pause days will stop applying.')) return;
    try {
      const res = await api.delete(`/admin/promotional-offers/${offer._id}`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchOffers();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete offer');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Promotional Offers</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Festival offers that pause worker subscriptions and waive platform fees.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm"
        >
          <FiPlus className="w-4 h-4" />
          Create Offer
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-500">Loading promotional offers...</div>
        ) : offers.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <FiGift className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            No promotional offers found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left">Offer</th>
                  <th className="px-5 py-3 text-left">Duration</th>
                  <th className="px-5 py-3 text-left">Audience</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Benefited</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offers.map((offer) => (
                  <tr key={offer._id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">{offer.name}</p>
                      <p className="text-xs text-slate-500 line-clamp-1">{offer.description || 'Free platform fee'}</p>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <p>{formatDate(offer.startDate)} → {formatDate(offer.endDate)}</p>
                      <p className="text-xs text-slate-500">{offer.durationDays} day{offer.durationDays === 1 ? '' : 's'}</p>
                    </td>
                    <td className="px-5 py-4">{offer.targetType === 'ALL_WORKERS' ? 'All Workers' : 'Selected Workers'}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyles[offer.status] || statusStyles.EXPIRED}`}>
                        {offer.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">{offer.stats?.workersBenefited || 0}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => openDetails(offer)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg" title="View">
                          <FiEye className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => openEdit(offer)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleToggle(offer)} className="px-2 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200">
                          {offer.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button type="button" onClick={() => handleDelete(offer)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
              <h2 className="font-bold">{editingOffer ? 'Edit Promotional Offer' : 'Create Promotional Offer'}</h2>
              <button type="button" onClick={() => setIsModalOpen(false)}><FiX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Offer Name</label>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" placeholder="Independence Day Special" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Offer Description</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 resize-none" placeholder="Enjoy free platform fee during the festival." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Offer Type</label>
                  <select value={form.offerType} onChange={(e) => setForm((p) => ({ ...p, offerType: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                    <option value="FREE_PLATFORM_FEE">Free Platform Fee</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Applicable To</label>
                  <select value={form.targetType} onChange={(e) => setForm((p) => ({ ...p, targetType: e.target.value, selectedWorkers: e.target.value === 'ALL_WORKERS' ? [] : p.selectedWorkers }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                    <option value="ALL_WORKERS">All Workers</option>
                    <option value="SELECTED_WORKERS">Selected Workers</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Start Date</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">End Date</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" required />
                </div>
              </div>
              <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-sm text-indigo-800">
                Duration: <strong>{durationDays || 0} day{durationDays === 1 ? '' : 's'}</strong> (inclusive)
                <div className="flex flex-wrap gap-2 mt-3">
                  {DURATION_PRESETS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => {
                        const startDate = form.startDate || toIstDateInput(new Date());
                        setForm((prev) => ({
                          ...prev,
                          startDate,
                          endDate: addInclusiveDays(startDate, days)
                        }));
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border ${durationDays === days ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-700 border-indigo-200'}`}
                    >
                      {days} day{days === 1 ? '' : 's'}
                    </button>
                  ))}
                </div>
              </div>

              {form.targetType === 'SELECTED_WORKERS' && (
                <div className="space-y-3 rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <label className="text-xs font-bold text-slate-700">Select Workers</label>
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={workerSearch} onChange={(e) => setWorkerSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white" placeholder="Search workers by name, phone, or email" />
                  </div>
                  {form.selectedWorkers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.selectedWorkers.map((worker) => (
                        <button key={worker.id} type="button" onClick={() => toggleWorker(worker)} className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                          {worker.name || worker.id} ×
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {searchingWorkers ? (
                      <p className="text-sm text-slate-500 text-center py-3">Searching...</p>
                    ) : workerResults.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-3">No workers found.</p>
                    ) : workerResults.map((worker) => (
                      <button key={worker.id} type="button" onClick={() => toggleWorker(worker)} className={`w-full text-left px-3 py-2 rounded-xl border ${form.selectedWorkers.some((item) => item.id === worker.id) ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                        <p className="font-semibold text-slate-800 text-sm">{worker.name}</p>
                        <p className="text-xs text-slate-500">{worker.phone} {worker.hasActiveSubscription ? '• Active subscription' : ''}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 bg-slate-100 rounded-xl font-bold text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm disabled:opacity-60">
                  {saving ? 'Saving...' : editingOffer ? 'Update Offer' : 'Create Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailsOffer && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Offer Details</h3>
              <button type="button" onClick={() => setDetailsOffer(null)}><FiX /></button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <p><span className="text-slate-400 font-bold uppercase text-xs">Name</span><br />{detailsOffer.name}</p>
              <p><span className="text-slate-400 font-bold uppercase text-xs">Type</span><br />{detailsOffer.offerType === 'FREE_PLATFORM_FEE' ? 'Free Platform Fee' : detailsOffer.offerType}</p>
              <p><span className="text-slate-400 font-bold uppercase text-xs">Dates</span><br />{formatDate(detailsOffer.startDate)} → {formatDate(detailsOffer.endDate)} ({detailsOffer.durationDays} days)</p>
              <p><span className="text-slate-400 font-bold uppercase text-xs">Audience</span><br />{detailsOffer.targetType === 'ALL_WORKERS' ? 'All Workers' : 'Selected Workers'}</p>
              <p><span className="text-slate-400 font-bold uppercase text-xs">Status</span><br />{detailsOffer.status}</p>
              <p><span className="text-slate-400 font-bold uppercase text-xs">Created</span><br />{formatDate(detailsOffer.createdAt)}</p>
              {detailsOffer.targetType === 'SELECTED_WORKERS' && Array.isArray(detailsOffer.selectedWorkers) && detailsOffer.selectedWorkers.length > 0 && (
                <div>
                  <p className="text-slate-400 font-bold uppercase text-xs mb-1">Selected Workers</p>
                  <div className="flex flex-wrap gap-2">
                    {detailsOffer.selectedWorkers.map((worker) => (
                      <span key={worker._id || worker} className="px-2 py-1 rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                        {worker.name || worker.phone || worker._id || worker}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="rounded-xl bg-slate-50 p-3"><FiUsers className="text-slate-400 mb-1" /><p className="text-xs text-slate-500">Eligible</p><p className="font-bold">{detailsOffer.stats?.eligibleWorkers || 0}</p></div>
                <div className="rounded-xl bg-emerald-50 p-3"><FiGift className="text-emerald-500 mb-1" /><p className="text-xs text-slate-500">Benefited</p><p className="font-bold">{detailsOffer.stats?.workersBenefited || 0}</p></div>
                <div className="rounded-xl bg-indigo-50 p-3"><FiClock className="text-indigo-500 mb-1" /><p className="text-xs text-slate-500">Pause Days</p><p className="font-bold">{detailsOffer.stats?.totalPromotionalDaysUsed || 0}</p></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromotionalOffers;
