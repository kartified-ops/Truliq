import api from '../../../services/api';

export const fetchIntegrations = () => api.get('/admin/integrations');
export const fetchIntegrationCatalog = () => api.get('/admin/integrations/catalog');
export const fetchIntegration = (serviceName) => api.get(`/admin/integrations/${serviceName}`);
export const saveIntegration = (serviceName, payload) => api.put(`/admin/integrations/${serviceName}`, payload);
export const switchActiveProvider = (serviceName, provider) =>
  api.patch(`/admin/integrations/${serviceName}/active-provider`, { provider });
export const toggleIntegration = (serviceName, enabled) =>
  api.patch(`/admin/integrations/${serviceName}/status`, { enabled });
export const testIntegration = (serviceName, payload = {}) =>
  api.post(`/admin/integrations/${serviceName}/test`, payload);
export const fetchIntegrationAuditLogs = (params = {}) =>
  api.get('/admin/integrations/audit-logs', { params });
