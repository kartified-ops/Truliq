import api from './api';

export const configService = {
  getSettings: async () => {
    try {
      const response = await api.get('/public/config');
      return response.data;
    } catch (error) {
      console.error('Error getting public settings', error);
      // No made-up rates: when the admin config can't be loaded callers must treat it as unavailable.
      return { success: false, settings: {} };
    }
  }
};

