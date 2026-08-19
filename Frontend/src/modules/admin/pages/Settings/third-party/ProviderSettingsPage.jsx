import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  FiSave,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertCircle,
  FiEye,
  FiEyeOff,
  FiDatabase,
  FiCloud
} from 'react-icons/fi';
import {
  fetchIntegration,
  saveIntegration,
  testIntegration,
  toggleIntegration
} from '../../../services/integrationService';

const STATUS_META = {
  connected: { label: 'Connected', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  configured: { label: 'Configured', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  not_configured: { label: 'Configuration Required', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  failed: { label: 'Connection Failed', className: 'bg-red-50 text-red-700 border-red-200' },
  disabled: { label: 'Disabled', className: 'bg-slate-100 text-slate-600 border-slate-200' }
};

/* ── Secret field with "Change" button ─────────────────────────────────── */
const SecretInput = ({ label, fieldKey, formValue, onChange, configured, placeholder }) => {
  const [editing, setEditing] = useState(false);
  const [visible, setVisible] = useState(false);

  /* When another provider is selected the parent resets form.credentials → reset local editing too */
  useEffect(() => {
    if (formValue === '' && !configured) setEditing(false);
    if (formValue === undefined) setEditing(false);
  }, [formValue, configured]);

  if (configured && !editing) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700">{label}</label>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value="••••••••••••••••"
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500"
          />
          <button
            type="button"
            onClick={() => { setEditing(true); onChange(fieldKey, ''); }}
            className="px-3 py-2 text-xs font-bold rounded-xl border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 whitespace-nowrap"
          >
            Change
          </button>
        </div>
        <p className="text-[11px] text-slate-400">Secret is stored. Leave unchanged or click Change to replace.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-700">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={formValue ?? ''}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          placeholder={placeholder || `Enter ${label}`}
          className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {visible ? <FiEyeOff size={14} /> : <FiEye size={14} />}
        </button>
      </div>
      {configured && editing && (
        <button
          type="button"
          onClick={() => { setEditing(false); onChange(fieldKey, undefined); }}
          className="text-[11px] text-slate-500 underline"
        >
          Cancel — keep existing secret
        </button>
      )}
    </div>
  );
};

/* ── Build initial credential form from the serialized integration ──────── */
const buildInitialCredentials = (integration, providerId) => {
  if (!integration?.credentials) return {};
  const creds = integration.credentials;
  const fields = integration.providers?.find((p) => p.id === providerId)?.fields || [];
  const result = {};
  fields.forEach((field) => {
    // For public / non-secret fields: pre-fill from saved value
    // For secret fields: leave undefined (show "configured" badge instead)
    if (field.type !== 'secret' && field.type !== 'json') {
      const saved = creds[field.key];
      if (saved !== undefined && saved !== null && saved !== '') {
        result[field.key] = saved;
      }
    }
    // secrets: will use getConfiguredFlag — don't pre-fill
  });
  return result;
};

/* ══════════════════════════════════════════════════════════════════════════
   ProviderSettingsPage — single reusable page for all six providers
══════════════════════════════════════════════════════════════════════════ */
const ProviderSettingsPage = ({
  serviceKey,
  title,
  description,
  testExtras = null,
  showEnvironment = false,
  headerSlot = null
}) => {
  const [integration, setIntegration] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [form, setForm] = useState({ enabled: true, environment: 'production', credentials: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const initialRef = useRef('');

  /* Derived: full provider list from catalog */
  const catalogEntry = useMemo(() => {
    if (!integration?.providers) return null;
    return { providers: integration.providers };
  }, [integration]);

  /* Derived: field schema for the selected provider */
  const activeProviderMeta = useMemo(() => {
    if (!catalogEntry || !selectedProvider) return null;
    return catalogEntry.providers.find((p) => p.id === selectedProvider) || null;
  }, [catalogEntry, selectedProvider]);

  /* ── Load integration from backend ─────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchIntegration(serviceKey);
      if (res.data.success) {
        const data = res.data.data;
        setIntegration(data);
        const provider = data.activeProvider || data.provider;
        setSelectedProvider(provider);
        const initialCredentials = buildInitialCredentials(data, provider);
        const nextForm = {
          enabled: data.enabled !== false,
          environment: data.environment || 'production',
          credentials: initialCredentials
        };
        setForm(nextForm);
        initialRef.current = JSON.stringify(nextForm);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [serviceKey]);

  useEffect(() => { load(); }, [load]);

  /* ── Switch provider ────────────────────────────────────────────────── */
  const handleProviderChange = (providerId) => {
    const meta = catalogEntry?.providers.find((p) => p.id === providerId);
    if (meta?.status === 'coming_soon') {
      toast.error(`${meta.label} is not yet available.`);
      return;
    }
    setSelectedProvider(providerId);
    const initialCredentials = buildInitialCredentials(integration, providerId);
    setForm((prev) => ({ ...prev, credentials: initialCredentials }));
  };

  /* ── Credential helpers ─────────────────────────────────────────────── */
  const updateCredential = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, credentials: { ...prev.credentials } };
      if (value === undefined) {
        delete next.credentials[key];
      } else {
        next.credentials[key] = value;
      }
      return next;
    });
  };

  const isConfigured = (fieldKey) =>
    integration?.credentials?.[`${fieldKey}Configured`] === true;

  /* ── Save ───────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!selectedProvider) return;
    setSaving(true);
    try {
      /* Strip undefined values — empty string on a secret means "keep existing" */
      const credentialsToSend = {};
      Object.entries(form.credentials).forEach(([k, v]) => {
        if (v !== undefined) credentialsToSend[k] = v;
      });

      const payload = {
        provider: selectedProvider,
        enabled: form.enabled,
        environment: form.environment,
        credentials: credentialsToSend,
        configuration: { activeProvider: selectedProvider }
      };
      const res = await saveIntegration(serviceKey, payload);
      if (res.data.success) {
        toast.success('Settings saved successfully');
        const data = res.data.data;
        setIntegration(data);
        // Re-build form from fresh server response
        const initialCredentials = buildInitialCredentials(data, selectedProvider);
        const nextForm = {
          enabled: data.enabled !== false,
          environment: data.environment || 'production',
          credentials: initialCredentials
        };
        setForm(nextForm);
        initialRef.current = JSON.stringify(nextForm);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  /* ── Test ───────────────────────────────────────────────────────────── */
  const handleTest = async () => {
    setTesting(true);
    try {
      /* Send current form credentials for test (may be unsaved) */
      const credentialsToSend = {};
      Object.entries(form.credentials).forEach(([k, v]) => {
        if (v !== undefined && v !== '') credentialsToSend[k] = v;
      });

      const payload = {
        provider: selectedProvider,
        environment: form.environment,
        ...(Object.keys(credentialsToSend).length ? { credentials: credentialsToSend } : {}),
        ...(testExtras?.testPhone ? { testPhone: testExtras.testPhone } : {}),
        ...(testExtras?.testEmail ? { testEmail: testExtras.testEmail } : {}),
        ...(testExtras?.testToken ? { testToken: testExtras.testToken } : {})
      };
      const res = await testIntegration(serviceKey, payload);
      if (res.data.success) {
        toast.success(res.data.message || 'Connection successful');
        load();
      } else {
        toast.error(res.data.message || 'Connection failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  /* ── Enable / Disable toggle ────────────────────────────────────────── */
  const handleToggle = async () => {
    const newEnabled = !form.enabled;
    try {
      const res = await toggleIntegration(serviceKey, newEnabled);
      if (res.data.success) {
        setForm((prev) => ({ ...prev, enabled: newEnabled }));
        setIntegration(res.data.data);
        toast.success(newEnabled ? 'Integration enabled' : 'Integration disabled');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    }
  };

  const statusMeta = STATUS_META[integration?.status] || STATUS_META.not_configured;

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
        <p className="text-sm text-slate-500">Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {description && <p className="text-sm text-slate-500 mt-1 max-w-2xl">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusMeta.className}`}>
            {statusMeta.label}
          </span>
          {integration?.source && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border
              bg-slate-50 text-slate-500 border-slate-200">
              {integration.source === 'database' ? <FiDatabase size={10} /> : <FiCloud size={10} />}
              Source: {integration.source}
            </span>
          )}
        </div>
      </div>

      {headerSlot}

      {/* ── Provider Configuration Card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h2 className="font-bold text-slate-800">Provider Configuration</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {integration?.source === 'database'
                ? 'Using database credentials — changes save to DB instantly'
                : 'Using .env fallback — saving will store credentials in database'}
            </p>
          </div>
          {/* Enable toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm font-medium text-slate-600">
              {form.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              type="button"
              onClick={handleToggle}
              className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                form.enabled ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                form.enabled ? 'translate-x-5' : ''
              }`} />
            </button>
          </label>
        </div>

        <div className="p-6 space-y-6">
          {/* Provider + Environment row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Provider</label>
              <select
                value={selectedProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {catalogEntry?.providers.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.status === 'coming_soon'}>
                    {p.label}{p.status === 'coming_soon' ? ' (Coming Soon)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {showEnvironment && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Environment</label>
                <select
                  value={form.environment}
                  onChange={(e) => setForm((prev) => ({ ...prev, environment: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="test">Test</option>
                  <option value="production">Production</option>
                </select>
              </div>
            )}
          </div>

          {/* Dynamic credential fields */}
          {activeProviderMeta && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {activeProviderMeta.fields.map((field) => {
                const formValue = form.credentials[field.key];
                const configured = isConfigured(field.key);

                /* ── Secret / password field ── */
                if (field.type === 'secret') {
                  return (
                    <SecretInput
                      key={field.key}
                      label={field.label}
                      fieldKey={field.key}
                      formValue={formValue}
                      configured={configured}
                      onChange={updateCredential}
                    />
                  );
                }

                /* ── Large JSON / textarea field ── */
                if (field.type === 'json') {
                  return (
                    <div key={field.key} className="sm:col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">{field.label}</label>
                      <textarea
                        rows={7}
                        value={formValue ?? ''}
                        onChange={(e) => updateCredential(field.key, e.target.value)}
                        placeholder={
                          configured
                            ? 'Service Account JSON is configured. Paste new JSON here to replace it.'
                            : 'Paste Firebase Service Account JSON here'
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                        autoComplete="off"
                      />
                      {configured && !formValue && (
                        <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                          <FiCheckCircle size={11} /> JSON is configured — leave blank to keep existing.
                        </p>
                      )}
                    </div>
                  );
                }

                /* ── Select / dropdown field ── */
                if (field.type === 'select') {
                  return (
                    <div key={field.key} className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">{field.label}</label>
                      <select
                        value={formValue ?? field.options?.[0] ?? ''}
                        onChange={(e) => updateCredential(field.key, e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {(field.options || []).map((opt) => (
                          <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  );
                }

                /* ── Text / number / url field ── */
                return (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">{field.label}</label>
                    <input
                      type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
                      value={formValue ?? ''}
                      onChange={(e) => updateCredential(field.key, e.target.value)}
                      placeholder={`Enter ${field.label}`}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Slot for test-specific inputs (phone, email, etc.) */}
          {testExtras?.render && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Test Options</p>
              {testExtras.render()}
            </div>
          )}

          {/* Actions row */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <FiRefreshCw size={14} className={testing ? 'animate-spin' : ''} />
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <FiSave size={14} />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>

            {/* Last test timestamp */}
            {integration?.lastTestedAt && (
              <span className="ml-auto text-xs text-slate-400 flex items-center gap-1">
                {integration.lastTestStatus === 'success'
                  ? <FiCheckCircle size={12} className="text-emerald-500" />
                  : <FiAlertCircle size={12} className="text-red-400" />}
                Last tested: {new Date(integration.lastTestedAt).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}
                {integration.lastTestMessage && ` — ${integration.lastTestMessage}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Source / Info Banner ── */}
      {integration?.source === 'env' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <FiCloud className="mt-0.5 shrink-0" size={15} />
          <span>
            Currently using credentials from the <strong>.env</strong> file.
            Enter and save new credentials above to switch to database-managed configuration.
            The .env file will not be modified.
          </span>
        </div>
      )}
      {integration?.source === 'database' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2">
          <FiDatabase className="mt-0.5 shrink-0" size={15} />
          <span>
            Using <strong>database</strong> credentials. Changes saved here take effect immediately
            for all future requests. The .env file is not used.
          </span>
        </div>
      )}
    </div>
  );
};

export default ProviderSettingsPage;
