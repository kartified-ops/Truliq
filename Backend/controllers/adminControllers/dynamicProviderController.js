const {
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  activateProvider,
  deactivateProvider,
  deleteProvider,
  testProvider,
  testUnsavedProvider
} = require('../../services/dynamicProviderService');
const { SERVICE_TYPES } = require('../../models/ThirdPartyProvider');

exports.list = async (req, res) => {
  try {
    const { serviceType } = req.query;
    if (serviceType && !SERVICE_TYPES.includes(serviceType)) {
      return res.status(400).json({ success: false, message: 'Invalid service type.' });
    }
    const data = await listProviders(serviceType || null);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to list providers.' });
  }
};

exports.get = async (req, res) => {
  try {
    const data = await getProvider(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Provider not found.' });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load provider.' });
  }
};

exports.create = async (req, res) => {
  try {
    if (!req.body.providerName || !req.body.serviceType) {
      return res.status(400).json({ success: false, message: 'Provider name and service type are required.' });
    }
    if (!SERVICE_TYPES.includes(req.body.serviceType)) {
      return res.status(400).json({ success: false, message: 'Invalid service type.' });
    }
    const data = await createProvider(req.body, req.user.id);
    res.status(201).json({ success: true, message: 'Provider created.', data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Failed to create provider.' });
  }
};

exports.update = async (req, res) => {
  try {
    const data = await updateProvider(req.params.id, req.body, req.user.id);
    res.json({ success: true, message: 'Provider updated.', data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update provider.' });
  }
};

exports.activate = async (req, res) => {
  try {
    const data = await activateProvider(req.params.id, req.user.id);
    res.json({ success: true, message: `${data.providerName} is now the active provider.`, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Failed to activate provider.' });
  }
};

exports.deactivate = async (req, res) => {
  try {
    const data = await deactivateProvider(req.params.id, req.user.id);
    res.json({ success: true, message: `${data.providerName} deactivated.`, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Failed to deactivate provider.' });
  }
};

exports.remove = async (req, res) => {
  try {
    await deleteProvider(req.params.id, req.user.id);
    res.json({ success: true, message: 'Provider deleted.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Failed to delete provider.' });
  }
};

exports.test = async (req, res) => {
  try {
    const result = await testProvider(req.params.id, req.body || {}, req.user.id);
    res.json({ success: result.success, message: result.message, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Test failed.' });
  }
};

exports.testUnsaved = async (req, res) => {
  try {
    if (!req.body.apiUrl) {
      return res.status(400).json({ success: false, message: 'API URL is required.' });
    }
    const result = await testUnsavedProvider(req.body, req.body.testParams || {});
    res.json({ success: result.success, message: result.message, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Test failed.' });
  }
};
