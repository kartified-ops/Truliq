const {
  SERVICE_NAMES,
  MANAGED_SERVICES,
  listIntegrations,
  serializeIntegration,
  upsertIntegration,
  updateIntegrationStatus,
  setActiveProvider,
  getCatalog,
  testIntegration
} = require('../../services/integrationConfigService');
const IntegrationAuditLog = require('../../models/IntegrationAuditLog');

exports.listIntegrations = async (req, res) => {
  try {
    const data = await listIntegrations();
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[Integrations] List error:', error);
    res.status(500).json({ success: false, message: 'Failed to load integrations.' });
  }
};

exports.getCatalog = async (req, res) => {
  try {
    const data = getCatalog();
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[Integrations] Catalog error:', error);
    res.status(500).json({ success: false, message: 'Failed to load provider catalog.' });
  }
};

const isManagedService = (serviceName) => MANAGED_SERVICES.includes(serviceName)
  || Object.values(SERVICE_NAMES).includes(serviceName);

exports.getIntegration = async (req, res) => {
  try {
    const { serviceName } = req.params;
    if (!isManagedService(serviceName)) {
      return res.status(404).json({ success: false, message: 'Integration not found.' });
    }
    const data = await serializeIntegration(serviceName);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[Integrations] Get error:', error);
    res.status(500).json({ success: false, message: 'Failed to load integration.' });
  }
};

exports.updateIntegration = async (req, res) => {
  try {
    const { serviceName } = req.params;
    if (!isManagedService(serviceName)) {
      return res.status(404).json({ success: false, message: 'Integration not found.' });
    }
    const data = await upsertIntegration(serviceName, req.body, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Integration saved successfully.',
      data
    });
  } catch (error) {
    console.error('[Integrations] Update error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to save integration.' });
  }
};

exports.updateIntegrationStatus = async (req, res) => {
  try {
    const { serviceName } = req.params;
    if (!isManagedService(serviceName)) {
      return res.status(404).json({ success: false, message: 'Integration not found.' });
    }
    const data = await updateIntegrationStatus(serviceName, req.body, req.user.id);
    res.status(200).json({
      success: true,
      message: req.body.enabled === false ? 'Integration disabled.' : 'Integration enabled.',
      data
    });
  } catch (error) {
    console.error('[Integrations] Status error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update integration status.' });
  }
};

exports.testIntegration = async (req, res) => {
  try {
    const { serviceName } = req.params;
    if (!isManagedService(serviceName)) {
      return res.status(404).json({ success: false, message: 'Integration not found.' });
    }
    const result = await testIntegration(serviceName, req.body || {}, req.user.id);
    res.status(200).json({
      success: result.success,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('[Integrations] Test error:', error);
    res.status(400).json({ success: false, message: error.message || 'Connection test failed.' });
  }
};

exports.switchActiveProvider = async (req, res) => {
  try {
    const { serviceName } = req.params;
    const { provider } = req.body || {};
    if (!isManagedService(serviceName)) {
      return res.status(404).json({ success: false, message: 'Integration not found.' });
    }
    if (!provider) {
      return res.status(400).json({ success: false, message: 'Provider is required.' });
    }
    const data = await setActiveProvider(serviceName, provider, req.user.id);
    res.status(200).json({
      success: true,
      message: `Active provider switched to ${provider}.`,
      data
    });
  } catch (error) {
    console.error('[Integrations] Switch provider error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to switch provider.' });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const query = {};
    if (req.query.serviceName) query.serviceName = req.query.serviceName;
    const logs = await IntegrationAuditLog.find(query)
      .populate('adminId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(req.query.limit, 10) || 50, 100))
      .lean();
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error('[Integrations] Audit log error:', error);
    res.status(500).json({ success: false, message: 'Failed to load audit logs.' });
  }
};
