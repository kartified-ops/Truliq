import React from 'react';
import { FiClock } from 'react-icons/fi';

const ComingSoonSettings = ({ title, description }) => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-500 mt-1">{description}</p>
    </div>
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
      <FiClock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
      <h2 className="text-lg font-bold text-slate-700">Coming Soon</h2>
      <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
        This integration is not yet implemented in the Truliq backend. It will appear here once a provider adapter is available.
      </p>
    </div>
  </div>
);

export default ComingSoonSettings;
