import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { FiBell, FiSend, FiClock } from 'react-icons/fi';

const NotificationsLayout = () => {
  const tabs = [
    { to: '/admin/notifications/send', label: 'Send Push Notification', icon: FiSend },
    { to: '/admin/notifications/history', label: 'History', icon: FiClock },
    { to: '/admin/notifications/inbox', label: 'Admin Inbox', icon: FiBell }
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <FiBell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
            <p className="text-sm text-slate-500">Send role-based push notifications and review delivery history.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) => `inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </NavLink>
            );
          })}
        </div>
      </div>

      <Outlet />
    </div>
  );
};

export default NotificationsLayout;
