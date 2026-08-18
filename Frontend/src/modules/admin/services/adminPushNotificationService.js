import api from '../../../services/api';

const adminPushNotificationService = {
  getOptions: async () => {
    const response = await api.get('/admin/push-notifications/options');
    return response.data;
  },

  getAllowedActions: async (audienceType) => {
    const response = await api.get('/admin/push-notifications/actions', {
      params: { audienceType }
    });
    return response.data;
  },

  searchRecipients: async ({ audienceType, search = '' }) => {
    const response = await api.get('/admin/push-notifications/recipients', {
      params: { audienceType, search }
    });
    return response.data;
  },

  sendNotification: async (payload) => {
    const response = await api.post('/admin/push-notifications/send', payload);
    return response.data;
  },

  getHistory: async ({ page = 1, limit = 20 } = {}) => {
    const response = await api.get('/admin/push-notifications/history', {
      params: { page, limit }
    });
    return response.data;
  },

  getHistoryById: async (id) => {
    const response = await api.get(`/admin/push-notifications/history/${id}`);
    return response.data;
  }
};

export default adminPushNotificationService;
