import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiChevronDown, FiChevronRight, FiShield } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { getAdminProfile } from '../../../services/settingsService';

const THIRD_PARTY_LINKS = [
  { key: 'payment-gateway', label: 'Payment Gateway Settings', serviceKey: 'payment_gateway' },
  { key: 'sms-gateway', label: 'SMS Gateway Settings', serviceKey: 'sms' },
  { key: 'firebase', label: 'Firebase Settings', serviceKey: 'firebase' },
  { key: 'maps', label: 'Map & Map APIs Settings', serviceKey: 'maps' },
  { key: 'mail', label: 'Mail Configuration', serviceKey: 'email' },
  { key: 'storage', label: 'Media Storage', serviceKey: 'storage' },
  { key: 'recaptcha', label: 'Recaptcha Settings', serviceKey: 'recaptcha' },
  { key: 'kyc', label: 'KYC Settings', serviceKey: 'kyc' },
  { key: 'notification-channel', label: 'Notification Channel', serviceKey: 'notification_channel' }
];

const SETTINGS_LINKS = [
  { path: '/admin/settings', label: 'Business Settings', exact: true },
  { path: '/admin/settings/app', label: 'App Settings' }
];

const ThirdPartyLayout = () => {
  const navigate = useNavigate();
  const [thirdPartyOpen, setThirdPartyOpen] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(true);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await getAdminProfile();
        const adminData = res?.data || res?.admin || res;
        const role = adminData?.role || JSON.parse(localStorage.getItem('adminData') || '{}').role;
        if (role && role !== 'super_admin') {
          toast.error('Super Admin access required');
          navigate('/admin/settings');
          return;
        }
        setIsSuperAdmin(true);
      } catch (_) {
        const localRole = JSON.parse(localStorage.getItem('adminData') || '{}').role;
        if (localRole && localRole !== 'super_admin') {
          navigate('/admin/settings');
        } else {
          setIsSuperAdmin(true);
        }
      } finally {
        setChecking(false);
      }
    };
    check();
  }, [navigate]);

  if (checking) {
    return <div className="py-16 text-center text-slate-500 font-medium">Loading settings...</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="w-full lg:w-64 shrink-0">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-4">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FiShield className="text-indigo-600" />
              Settings
            </h2>
          </div>
          <nav className="p-2 space-y-0.5">
            {SETTINGS_LINKS.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.exact}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}

            <button
              type="button"
              onClick={() => setThirdPartyOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-50 mt-2"
            >
              <span>Third-party Settings</span>
              {thirdPartyOpen ? <FiChevronDown className="text-slate-400" /> : <FiChevronRight className="text-slate-400" />}
            </button>

            {thirdPartyOpen && (
              <div className="ml-2 pl-2 border-l border-slate-100 space-y-0.5">
                {THIRD_PARTY_LINKS.map((link) => (
                  <NavLink
                    key={link.key}
                    to={`/admin/settings/third-party/${link.key}`}
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                      } ${link.comingSoon ? 'opacity-70' : ''}`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </div>
            )}
          </nav>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
};

export default ThirdPartyLayout;
