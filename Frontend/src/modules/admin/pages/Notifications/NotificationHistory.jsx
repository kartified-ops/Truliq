import React, { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';
import { FiClock, FiEye, FiX } from 'react-icons/fi';
import adminPushNotificationService from '../../services/adminPushNotificationService';

const audienceLabel = (value) => ({
  all: 'All',
  users: 'Users',
  workers: 'Workers',
  vendors: 'Vendors',
  specific_user: 'Specific User',
  specific_worker: 'Specific Worker',
  specific_vendor: 'Specific Vendor'
}[value] || value);

const NotificationHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminPushNotificationService.getHistory({ page: 1, limit: 50 });
      if (response.success) {
        setHistory(response.data || []);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load notification history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const openDetails = async (id) => {
    setDetailLoading(true);
    try {
      const response = await adminPushNotificationService.getHistoryById(id);
      if (response.success) {
        setSelectedItem(response.data);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load notification details');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Notification History</h2>
          <p className="text-sm text-slate-500">Review admin-sent push notifications and delivery counts.</p>
        </div>
        <button
          type="button"
          onClick={fetchHistory}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-slate-700"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading history...</div>
      ) : history.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <FiClock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          No admin push notifications sent yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-5 py-3 text-left">Title</th>
                <th className="px-5 py-3 text-left">Recipient Type</th>
                <th className="px-5 py-3 text-left">Recipients</th>
                <th className="px-5 py-3 text-left">Success</th>
                <th className="px-5 py-3 text-left">Failed</th>
                <th className="px-5 py-3 text-left">Sent By</th>
                <th className="px-5 py-3 text-left">Sent At</th>
                <th className="px-5 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((item) => (
                <tr key={item._id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-1">{item.message}</p>
                  </td>
                  <td className="px-5 py-4">{audienceLabel(item.audienceType)}</td>
                  <td className="px-5 py-4">{item.totalRecipients || 0}</td>
                  <td className="px-5 py-4 text-emerald-600 font-semibold">{item.successfulCount || 0}</td>
                  <td className="px-5 py-4 text-red-500 font-semibold">{item.failedCount || 0}</td>
                  <td className="px-5 py-4">{item.adminId?.name || 'Admin'}</td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    {item.sentAt ? formatDistanceToNow(new Date(item.sentAt), { addSuffix: true }) : '-'}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => openDetails(item._id)}
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-semibold"
                    >
                      <FiEye className="w-4 h-4" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Notification Details</h3>
              <button type="button" onClick={() => setSelectedItem(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <FiX />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              {detailLoading ? (
                <p className="text-slate-500">Loading details...</p>
              ) : (
                <>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">Title</p>
                    <p className="font-semibold text-slate-800">{selectedItem.title}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">Message</p>
                    <p className="text-slate-700">{selectedItem.message}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">Recipient Type</p>
                      <p className="font-semibold text-slate-800">{audienceLabel(selectedItem.audienceType)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">Notification Type</p>
                      <p className="font-semibold text-slate-800">{selectedItem.type}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">Click Action</p>
                      <p className="font-semibold text-slate-800">{selectedItem.action || 'none'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">Target ID</p>
                      <p className="font-semibold text-slate-800">{selectedItem.targetId || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">Total Recipients</p>
                      <p className="font-semibold text-slate-800">{selectedItem.totalRecipients || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">Delivery</p>
                      <p className="font-semibold text-slate-800">
                        {selectedItem.successfulCount || 0} success / {selectedItem.failedCount || 0} failed
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 font-bold mb-2">Recipient IDs</p>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 max-h-40 overflow-y-auto text-xs text-slate-600">
                      {(selectedItem.recipientIds || []).length
                        ? selectedItem.recipientIds.join(', ')
                        : 'No recipient IDs recorded.'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationHistory;
