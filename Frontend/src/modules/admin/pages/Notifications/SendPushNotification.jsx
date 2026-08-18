import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { FiSend, FiSearch, FiUser, FiBriefcase, FiUsers } from 'react-icons/fi';
import adminPushNotificationService from '../../services/adminPushNotificationService';

const TARGET_REQUIRED_ACTIONS = ['open_job_details', 'open_booking_details'];
const SPECIFIC_AUDIENCES = ['specific_user', 'specific_worker', 'specific_vendor'];

const audienceIcon = (role) => {
  if (role === 'worker') return FiBriefcase;
  if (role === 'vendor') return FiUser;
  return FiUsers;
};

const SendPushNotification = () => {
  const [options, setOptions] = useState({ audienceTypes: [], notificationTypes: [], clickActions: [] });
  const [allowedActions, setAllowedActions] = useState([]);
  const [recipientResults, setRecipientResults] = useState([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [searchingRecipients, setSearchingRecipients] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    title: '',
    message: '',
    audienceType: 'workers',
    notificationType: 'admin_notification',
    action: 'none',
    targetId: ''
  });

  const isSpecificAudience = SPECIFIC_AUDIENCES.includes(form.audienceType);
  const targetRequired = TARGET_REQUIRED_ACTIONS.includes(form.action);

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const response = await adminPushNotificationService.getOptions();
        if (response.success) {
          setOptions(response.data);
        }
      } catch (error) {
        console.error(error);
        toast.error('Failed to load notification options');
      } finally {
        setLoadingOptions(false);
      }
    };
    loadOptions();
  }, []);

  useEffect(() => {
    const loadActions = async () => {
      try {
        const response = await adminPushNotificationService.getAllowedActions(form.audienceType);
        if (response.success) {
          setAllowedActions(response.data || []);
          if (!response.data.some((item) => item.value === form.action)) {
            setForm((prev) => ({ ...prev, action: response.data[0]?.value || 'none', targetId: '' }));
          }
        }
      } catch (error) {
        console.error(error);
      }
    };
    loadActions();
  }, [form.audienceType]);

  useEffect(() => {
    if (!isSpecificAudience) {
      setRecipientResults([]);
      setSelectedRecipient(null);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setSearchingRecipients(true);
      try {
        const response = await adminPushNotificationService.searchRecipients({
          audienceType: form.audienceType,
          search: recipientSearch
        });
        if (response.success) {
          setRecipientResults(response.data || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setSearchingRecipients(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [form.audienceType, isSpecificAudience, recipientSearch]);

  const actionOptions = useMemo(() => {
    if (allowedActions.length) return allowedActions;
    return options.clickActions || [];
  }, [allowedActions, options.clickActions]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'audienceType' ? { targetId: '' } : {}),
      ...(name === 'action' && !TARGET_REQUIRED_ACTIONS.includes(value) ? { targetId: '' } : {})
    }));
    if (name === 'audienceType') {
      setSelectedRecipient(null);
      setRecipientSearch('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.title.trim() || !form.message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    if (targetRequired && !form.targetId.trim()) {
      toast.error('Target ID is required for the selected action');
      return;
    }
    if (isSpecificAudience && !selectedRecipient) {
      toast.error('Please select a recipient');
      return;
    }

    setSending(true);
    try {
      const response = await adminPushNotificationService.sendNotification({
        title: form.title.trim(),
        message: form.message.trim(),
        audienceType: form.audienceType,
        notificationType: form.notificationType,
        action: form.action,
        targetId: form.targetId.trim(),
        specificRecipientId: selectedRecipient?.id || null
      });

      if (response.success) {
        toast.success(response.message || 'Notification sent successfully');
        setForm({
          title: '',
          message: '',
          audienceType: form.audienceType,
          notificationType: 'admin_notification',
          action: 'none',
          targetId: ''
        });
        setSelectedRecipient(null);
        setRecipientSearch('');
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">Send Push Notification</h2>
        <p className="text-sm text-slate-500 mt-1">
          Notifications are sent only to accounts with valid saved FCM tokens. The backend determines recipients.
        </p>
      </div>

      {loadingOptions ? (
        <div className="py-10 text-center text-slate-500">Loading form...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Notification Title</label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="New Job Available"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Send To</label>
              <select
                name="audienceType"
                value={form.audienceType}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              >
                {options.audienceTypes.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Message</label>
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              placeholder="A new job is available near you."
              required
            />
          </div>

          {isSpecificAudience && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="text-sm font-semibold text-slate-700">Select Recipient</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  placeholder="Search by name, email, or phone"
                />
              </div>

              {selectedRecipient && (
                <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-800">{selectedRecipient.name}</p>
                    <p className="text-xs text-slate-500">{selectedRecipient.email || selectedRecipient.phone} • {selectedRecipient.tokenCount} device(s)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRecipient(null)}
                    className="text-sm font-semibold text-indigo-600"
                  >
                    Change
                  </button>
                </div>
              )}

              {!selectedRecipient && (
                <div className="max-h-56 overflow-y-auto space-y-2">
                  {searchingRecipients ? (
                    <p className="text-sm text-slate-500 py-4 text-center">Searching recipients...</p>
                  ) : recipientResults.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">No FCM-enabled recipients found.</p>
                  ) : (
                    recipientResults.map((recipient) => {
                      const Icon = audienceIcon(recipient.role);
                      return (
                        <button
                          key={recipient.id}
                          type="button"
                          onClick={() => setSelectedRecipient(recipient)}
                          className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                            <Icon className="text-slate-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{recipient.name}</p>
                            <p className="text-xs text-slate-500 truncate">{recipient.email || recipient.phone}</p>
                          </div>
                          <span className="text-xs font-semibold text-emerald-600">{recipient.tokenCount} token(s)</span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Notification Type</label>
              <select
                name="notificationType"
                value={form.notificationType}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {options.notificationTypes.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Action on Click</label>
              <select
                name="action"
                value={form.action}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {actionOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>

          {targetRequired && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Target ID</label>
              <input
                type="text"
                name="targetId"
                value={form.targetId}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="JOB_ID or BOOKING_ID"
                required
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-60"
            >
              <FiSend className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send Notification'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default SendPushNotification;
