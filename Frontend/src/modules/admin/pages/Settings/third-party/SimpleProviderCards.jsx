import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { FiSave, FiRefreshCw, FiDatabase, FiCloud, FiEye, FiEyeOff } from 'react-icons/fi';
import {
  fetchIntegration,
  fetchIntegrationCatalog,
  saveIntegration,
  testIntegration,
  switchActiveProvider
} from '../../../services/integrationService';

/* ── Secret Input ── */
const SecretField = ({ label, value, onChange, configured, maskedValue }) => {
  const [editing, setEditing] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => { if (value === undefined) setEditing(false); }, [value]);

  if (configured && !editing) {
    const displayVal = maskedValue || '••••••••••••••••';
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600">{label}</label>
        <div className="flex items-center gap-2">
          <input readOnly value={displayVal} className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono text-slate-600" />
          <button type="button" onClick={() => { setEditing(true); onChange(''); }}
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
  const isComingSoon = providerDef.status === 'coming_soon';
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
    try {
      await switchActiveProvider(serviceName, providerId);
      toast.success(`${providerDef.label} is now the active provider`);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Activation failed');
    }
  };

  if (isComingSoon) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 opacity-60">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">
              {providerDef.label.charAt(0)}
            </div>
            <h3 className="font-bold text-slate-700">{providerDef.label}</h3>
          </div>
          <span className="px-3 py-1 text-[11px] font-bold uppercase bg-slate-100 text-slate-500 rounded-full">
            Coming Soon
          </span>
        </div>
        <p className="text-sm text-slate-400">Backend integration not yet implemented.</p>
      </div>
    );
  }

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
              />
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
const SimpleProviderCards = ({ serviceName, title, description }) => {
  const [catalog, setCatalog] = useState(null);
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, intRes] = await Promise.all([
        fetchIntegrationCatalog(),
        fetchIntegration(serviceName).catch(() => null)
      ]);
      if (catRes.data?.success) setCatalog(catRes.data.data);
      if (intRes?.data?.success) setIntegration(intRes.data.data);
    } catch (_) { /* */ }
    setLoading(false);
  }, [serviceName]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="py-16 text-center text-slate-400">Loading…</div>;

  const serviceDef = Array.isArray(catalog)
    ? catalog.find((c) => c.serviceKey === serviceName)
    : catalog?.[serviceName];

  if (!serviceDef) return <div className="py-16 text-center text-slate-500">Service not found in catalog.</div>;

  const providers = Array.isArray(serviceDef.providers)
    ? serviceDef.providers.map((p) => [p.id, p])
    : Object.entries(serviceDef.providers || {});

  const activeProviderObj = Array.isArray(serviceDef.providers)
    ? serviceDef.providers.find((p) => p.id === integration?.activeProvider)
    : serviceDef.providers?.[integration?.activeProvider];

  const activeProviderLabel = activeProviderObj?.label || integration?.activeProvider || 'None';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title || serviceDef.label}</h1>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>

      {/* Active provider selector */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3">
        <span className="text-sm font-semibold text-slate-700">Active Provider:</span>
        <span className="text-sm font-bold text-indigo-600">
          {activeProviderLabel}
        </span>
      </div>

      {/* Provider cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
