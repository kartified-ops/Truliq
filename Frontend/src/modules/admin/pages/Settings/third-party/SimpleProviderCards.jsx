import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { FiSave, FiRefreshCw, FiDatabase, FiCloud, FiEye, FiEyeOff, FiPlus, FiX } from 'react-icons/fi';
import {
  fetchIntegration,
  fetchIntegrationCatalog,
  saveIntegration,
  testIntegration,
  switchActiveProvider,
  revealIntegrationSecret
} from '../../../services/integrationService';

/* ── Secret Input ── */
const SecretField = ({ label, value, onChange, configured, maskedValue, onReveal }) => {
  const [editing, setEditing] = useState(false);
  const [revealedValue, setRevealedValue] = useState(null);
  const [revealing, setRevealing] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => { if (value === undefined) setEditing(false); }, [value]);

  const handleEyeClick = async () => {
    if (revealedValue) {
      setRevealedValue(null);
      return;
    }
    if (!onReveal) return;
    setRevealing(true);
    try {
      const res = await onReveal();
      if (res?.data?.value) {
        setRevealedValue(res.data.value);
        toast.success('Secret revealed (Audit Logged)');
        setTimeout(() => setRevealedValue(null), 5000);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reveal secret');
    } finally {
      setRevealing(false);
    }
  };

  if (configured && !editing) {
    const displayVal = revealedValue || maskedValue || '••••••••••••••••';
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600">{label}</label>
        <div className="flex items-center gap-2">
          <input readOnly value={displayVal} className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono text-slate-600" />
          <button
            type="button"
            onClick={handleEyeClick}
            disabled={revealing}
            className="p-2.5 text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50"
            title="Reveal Secret (Audit Logged)"
          >
            {revealing ? <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /> : (revealedValue ? <FiEyeOff size={14} /> : <FiEye size={14} />)}
          </button>
          <button type="button" onClick={() => { setEditing(true); onChange(''); setRevealedValue(null); }}
            className="px-3 py-2 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label}`}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm pr-10"
          autoComplete="new-password"
        />
        <button type="button" onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
          {visible ? <FiEyeOff size={14} /> : <FiEye size={14} />}
        </button>
      </div>
    </div>
  );
};

/* ── Provider Card ── */
const ProviderCard = ({ serviceName, providerId, providerDef, integration, onRefresh, catalog }) => {
  const isActive = integration?.activeProvider === providerId;
  const [credentials, setCredentials] = useState({});
  const [environment, setEnvironment] = useState('production');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Build initial state from integration data
  useEffect(() => {
    if (!integration) return;
    const profile = integration.providerProfiles?.[providerId] || {};
    const isThisActive = integration.activeProvider === providerId;
    const creds = profile.credentials || (isThisActive ? integration.credentials : {}) || {};
    const config = integration.configuration || {};

    const initial = {};
    (providerDef.publicFields || []).forEach((f) => {
      const val = creds[f] !== undefined ? creds[f] : config[f];
      if (val !== undefined && val !== null && val !== '') initial[f] = val;
    });

    (providerDef.sensitiveFields || []).forEach((f) => {
      const hasValue = creds[`${f}Configured`] || creds[f] || (isThisActive && (integration.credentials?.[f] || config[f]));
      if (hasValue) initial[f] = undefined;
    });

    setCredentials(initial);
    setEnvironment(profile.environment || integration.environment || 'production');
  }, [integration, providerId, providerDef]);

  const updateField = (key, value) => setCredentials((p) => ({ ...p, [key]: value }));

  const isConfigured = (fieldKey) => {
    const profile = integration?.providerProfiles?.[providerId] || {};
    const isThisActive = integration?.activeProvider === providerId;
    const creds = profile.credentials || (isThisActive ? integration?.credentials : {}) || {};
    const config = integration?.configuration || {};
    return !!(creds[`${fieldKey}Configured`] || creds[fieldKey] || (isThisActive && (integration?.credentials?.[fieldKey] || config[fieldKey])));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build payload — only send non-undefined, non-empty-for-secrets values
      const payload = {};
      Object.entries(credentials).forEach(([k, v]) => {
        if (v === undefined) return; // keep existing
        if (v === '' && (providerDef.sensitiveFields || []).includes(k)) return; // keep existing
        payload[k] = v;
      });

      await saveIntegration(serviceName, {
        provider: providerId,
        credentials: payload,
        environment
      });
      toast.success('Configuration saved');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await testIntegration(serviceName, { provider: providerId });
      if (res.data?.success) toast.success(res.data.message || 'Connection successful');
      else toast.error(res.data?.message || 'Test failed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleActivate = async () => {
    const profile = integration?.providerProfiles?.[providerId] || {};
    const creds = profile.credentials || {};
    const hasConfigured = profile.configured ||
      (providerDef.sensitiveFields || []).some((f) => creds[`${f}Configured`] || creds[f] || credentials[f]) ||
      (providerDef.publicFields || []).some((f) => creds[f] || credentials[f]);

    if (!hasConfigured) {
      toast.error(`Please fill and save ${providerDef.label} credentials before activating.`);
      return;
    }

    try {
      await switchActiveProvider(serviceName, providerId);
      toast.success(`${providerDef.label} is now the active provider`);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Activation failed');
    }
  };

  const source = integration?.providerProfiles?.[providerId]?.source || integration?.source || 'env';

  return (
    <div className={`bg-white rounded-2xl border-2 p-6 transition-all ${isActive ? 'border-indigo-400 shadow-sm' : 'border-slate-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {providerDef.label.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-slate-800">{providerDef.label}</h3>
            {isActive && <span className="text-[10px] font-bold text-indigo-600 uppercase">Active Provider</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${source === 'database' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
            {source === 'database' ? <><FiDatabase size={10} /> DATABASE</> : <><FiCloud size={10} /> ENV</>}
          </span>
          {!isActive && (
            <button onClick={handleActivate} className="px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">
              Activate
            </button>
          )}
        </div>
      </div>

      {/* Environment */}
      {providerDef.supportsEnvironment && (
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-600">Environment</label>
          <select value={environment} onChange={(e) => setEnvironment(e.target.value)}
            className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
            <option value="production">Production</option>
            <option value="test">Test</option>
          </select>
        </div>
      )}

      {/* Fields */}
      <div className="space-y-4 mb-5">
        {(providerDef.fields || []).map((field) => {
          if (field.type === 'secret') {
            const profile = integration?.providerProfiles?.[providerId] || {};
            const isThisActive = integration?.activeProvider === providerId;
            const creds = profile.credentials || (isThisActive ? integration?.credentials : {}) || {};
            const maskedVal = creds[field.key] || '';

            return (
              <SecretField
                key={field.key}
                label={field.label}
                value={credentials[field.key]}
                onChange={(v) => updateField(field.key, v)}
                configured={isConfigured(field.key)}
                maskedValue={maskedVal}
                onReveal={() => revealIntegrationSecret(serviceName, { provider: providerId, field: field.key })}
              />
            );
          }
          if (field.type === 'json') {
            return (
              <div key={field.key} className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">{field.label}</label>
                <textarea
                  rows={6}
                  value={credentials[field.key] || ''}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={`Enter ${field.label}`}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
                />
              </div>
            );
          }
          if (field.type === 'select') {
            return (
              <div key={field.key} className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">{field.label}</label>
                <select value={credentials[field.key] || ''} onChange={(e) => updateField(field.key, e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
                  <option value="">Select…</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>
                  ))}
                </select>
              </div>
            );
          }
          return (
            <div key={field.key} className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">{field.label}</label>
              <input
                type={field.type === 'url' ? 'url' : 'text'}
                value={credentials[field.key] || ''}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={`Enter ${field.label}`}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
          <FiSave size={14} /> {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={handleTest} disabled={testing}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl hover:bg-slate-50 disabled:opacity-50">
          <FiRefreshCw size={14} className={testing ? 'animate-spin' : ''} /> Test Connection
        </button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════ */
/* Main page component */
/* ══════════════════════════════════════════════════════════════════════════ */
const enrichProvider = (id, provider) => {
  const fields = provider.fields || [];
  return {
    id,
    ...provider,
    publicFields: provider.publicFields || fields.filter((f) => f.type !== 'secret' && f.type !== 'json').map((f) => f.key),
    sensitiveFields: provider.sensitiveFields || fields.filter((f) => f.type === 'secret' || f.type === 'json').map((f) => f.key)
  };
};

const normalizeCatalog = (data) => {
  if (!data) return null;
  if (!Array.isArray(data)) {
    const keyed = {};
    Object.entries(data).forEach(([serviceKey, service]) => {
      const providers = Array.isArray(service.providers)
        ? Object.fromEntries(service.providers.map((p) => [p.id, enrichProvider(p.id, p)]))
        : Object.fromEntries(Object.entries(service.providers || {}).map(([id, p]) => [id, enrichProvider(id, p)]));
      keyed[serviceKey] = { ...service, providers };
    });
    return keyed;
  }

  const keyed = {};
  data.forEach((service) => {
    const key = service.serviceKey || service.routeKey;
    if (!key) return;
    const providers = Array.isArray(service.providers)
      ? Object.fromEntries(service.providers.map((p) => [p.id, enrichProvider(p.id, p)]))
      : Object.fromEntries(Object.entries(service.providers || {}).map(([id, p]) => [id, enrichProvider(id, p)]));
    keyed[key] = { ...service, providers };
  });
  return keyed;
};

const slugify = (name) => String(name || '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '')
  .slice(0, 40);

const AddProviderForm = ({ serviceName, template, existingIds, onCancel, onSaved }) => {
  const [name, setName] = useState('');
  const [credentials, setCredentials] = useState({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const label = name.trim();
    const slug = slugify(label);
    if (!label || !slug) {
      toast.error('Enter a provider name.');
      return;
    }
    if (existingIds.includes(slug)) {
      toast.error('A provider with this name already exists.');
      return;
    }
    setSaving(true);
    try {
      await saveIntegration(serviceName, {
        provider: slug,
        providerLabel: label,
        credentials,
        configuration: { activeProvider: slug }
      });
      toast.success(`${label} saved and activated`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-slate-800">Add Provider</h3>
        <button type="button" onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-700"><FiX /></button>
      </div>
      <div className="space-y-4 mb-5">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">Provider Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SMS Ala"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm" />
        </div>
        {(template.fields || []).map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">{field.label}</label>
            {field.type === 'json' ? (
              <textarea rows={5} value={credentials[field.key] || ''} onChange={(e) => setCredentials((p) => ({ ...p, [field.key]: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono" />
            ) : (
              <input
                type={field.type === 'secret' ? 'password' : 'text'}
                value={credentials[field.key] || ''}
                onChange={(e) => setCredentials((p) => ({ ...p, [field.key]: e.target.value }))}
                placeholder={`Enter ${field.label}`}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                autoComplete="new-password"
              />
            )}
          </div>
        ))}
      </div>
      <button onClick={handleSave} disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
        <FiSave size={14} /> {saving ? 'Saving…' : 'Save & Activate'}
      </button>
    </div>
  );
};

const DEFAULT_ADD_FIELDS = {
  payment_gateway: [
    { key: 'testKeyId', label: 'Test API Key', type: 'text' },
    { key: 'testSecretKey', label: 'Test Secret Key', type: 'secret' },
    { key: 'liveKeyId', label: 'Live API Key', type: 'text' },
    { key: 'liveSecretKey', label: 'Live Secret Key', type: 'secret' }
  ],
  sms: [
    { key: 'apiKey', label: 'API Key', type: 'secret' },
    { key: 'senderId', label: 'Sender ID', type: 'text' },
    { key: 'apiUrl', label: 'API URL', type: 'url' },
    { key: 'dltTemplateId', label: 'Template ID', type: 'text' }
  ],
  maps: [{ key: 'apiKey', label: 'API Key', type: 'secret' }],
  firebase: [
    { key: 'databaseUrl', label: 'Database URL', type: 'url' },
    { key: 'projectId', label: 'Project ID', type: 'text' },
    { key: 'serviceAccountJson', label: 'Service Account JSON', type: 'json' }
  ],
  storage: [
    { key: 'cloudName', label: 'Cloud Name', type: 'text' },
    { key: 'apiKey', label: 'API Key', type: 'text' },
    { key: 'apiSecret', label: 'API Secret', type: 'secret' }
  ],
  email: [
    { key: 'host', label: 'SMTP Host', type: 'text' },
    { key: 'port', label: 'SMTP Port', type: 'text' },
    { key: 'user', label: 'Username', type: 'text' },
    { key: 'password', label: 'Password', type: 'secret' },
    { key: 'from', label: 'From Email', type: 'text' },
    { key: 'fromName', label: 'From Name', type: 'text' }
  ],
  recaptcha: [
    { key: 'siteKey', label: 'Site Key', type: 'text' },
    { key: 'secretKey', label: 'Secret Key', type: 'secret' }
  ],
  kyc: [
    { key: 'clientId', label: 'Client ID', type: 'text' },
    { key: 'clientSecret', label: 'Client Secret', type: 'secret' }
  ],
  notification_channel: [
    { key: 'appId', label: 'App ID', type: 'text' },
    { key: 'restApiKey', label: 'REST API Key', type: 'secret' }
  ]
};

const SimpleProviderCards = ({ serviceName, title, description }) => {
  const [catalog, setCatalog] = useState(null);
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [catRes, intRes] = await Promise.all([
        fetchIntegrationCatalog(),
        fetchIntegration(serviceName).catch(() => null)
      ]);
      if (catRes.data?.success) setCatalog(normalizeCatalog(catRes.data.data));
      if (intRes?.data?.success) setIntegration(intRes.data.data);
    } catch (err) {
      const offline = err.code === 'ERR_NETWORK' || err.message?.includes('Network Error');
      setLoadError(offline
        ? 'Cannot reach the backend API. Start the server on port 5000 and refresh.'
        : (err.response?.data?.message || 'Failed to load third-party settings.'));
    }
    setLoading(false);
  }, [serviceName]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="py-16 text-center text-slate-400">Loading…</div>;

  if (loadError) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-slate-700 font-semibold">{loadError}</p>
        <button onClick={load} className="px-4 py-2 text-sm font-semibold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50">
          Retry
        </button>
      </div>
    );
  }

  const serviceDef = catalog?.[serviceName];

  if (!serviceDef) return <div className="py-16 text-center text-slate-500">Service not found in catalog.</div>;

  const mergedProviders = { ...(serviceDef.providers || {}) };
  const customProviders = integration?.configuration?.customProviders || {};
  Object.entries(customProviders).forEach(([id, meta]) => {
    if (!mergedProviders[id]) mergedProviders[id] = enrichProvider(id, { label: meta.label || id, status: 'active', ...meta });
  });
  Object.keys(integration?.providerProfiles || {}).forEach((id) => {
    if (!mergedProviders[id]) mergedProviders[id] = enrichProvider(id, { label: id, status: 'active', fields: DEFAULT_ADD_FIELDS[serviceName] || [] });
  });

  const providers = Object.entries(mergedProviders);
  const activeProviderLabel = mergedProviders[integration?.activeProvider]?.label
    || integration?.activeProvider
    || 'None';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title || serviceDef.label}</h1>
          {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
        </div>
        <button type="button" onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 shrink-0">
          <FiPlus size={14} /> Add Provider
        </button>
      </div>

      <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3">
        <span className="text-sm font-semibold text-slate-700">Active Provider:</span>
        <span className="text-sm font-bold text-indigo-600">
          {activeProviderLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {adding && (
          <AddProviderForm
            serviceName={serviceName}
            template={{ fields: DEFAULT_ADD_FIELDS[serviceName] || DEFAULT_ADD_FIELDS.sms }}
            existingIds={Object.keys(mergedProviders)}
            onCancel={() => setAdding(false)}
            onSaved={() => { setAdding(false); load(); }}
          />
        )}
        {providers.map(([pid, pdef]) => (
          <ProviderCard
            key={pid}
            serviceName={serviceName}
            providerId={pid}
            providerDef={pdef}
            integration={integration}
            onRefresh={load}
            catalog={catalog}
          />
        ))}
      </div>
    </div>
  );
};

export default SimpleProviderCards;
