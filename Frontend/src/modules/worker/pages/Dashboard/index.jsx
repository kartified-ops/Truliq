import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBriefcase, FiCheckCircle, FiClock, FiTrendingUp, FiChevronRight, FiUser, FiBell, FiMapPin, FiArrowRight } from 'react-icons/fi';
import { FaWallet } from 'react-icons/fa';
import { workerTheme as themeColors, vendorTheme } from '../../../../theme';
import Header from '../../components/layout/Header';
import workerService from '../../../../services/workerService';
import { registerFCMToken } from '../../../../services/pushNotificationService';
import { SkeletonProfileHeader, SkeletonDashboardStats, SkeletonList } from '../../../../components/common/SkeletonLoaders';
import OptimizedImage from '../../../../components/common/OptimizedImage';
import { useSocket } from '../../../../context/SocketContext';
import LogoLoader from '../../../../components/common/LogoLoader';


const Dashboard = () => {
  const navigate = useNavigate();

  // Helper function to convert hex to rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Helper function to get status label
  const getStatusLabel = (status) => {
    const statusMap = {
      'PENDING': 'Pending',
      'ACCEPTED': 'Accepted',
      'REJECTED': 'Rejected',
      'COMPLETED': 'Completed',
      'ASSIGNED': 'Assigned',
      'VISITED': 'Visited',
      'WORK_DONE': 'Work Done',
    };
    return statusMap[status] || status;
  };

  // Cache check
  const cachedData = React.useRef(null);
  try {
    const cached = sessionStorage.getItem('workerDashboardCache');
    if (cached) {
      cachedData.current = JSON.parse(cached);
    }
  } catch (e) { /* ignore parse errors */ }

  const [stats, setStats] = useState(cachedData.current?.stats || {
    pendingJobs: 0,
    acceptedJobs: 0,
    completedJobs: 0,
    totalEarnings: 0,
    thisMonthEarnings: 0,
    rating: 0,
  });
  const [workerProfile, setWorkerProfile] = useState(cachedData.current?.workerProfile || {
    name: 'Worker Name',
    phone: '+91 9876543210',
    photo: null,
    categories: [],
    address: null,
  });
  const [subscriptionStatus, setSubscriptionStatus] = useState(cachedData.current?.subscriptionStatus || null);
  const [recentJobs, setRecentJobs] = useState(cachedData.current?.recentJobs || []);

  const [loading, setLoading] = useState(!cachedData.current);

  // Set background gradient
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const bgStyle = themeColors.backgroundGradient;

    if (html) html.style.background = bgStyle;
    if (body) body.style.background = bgStyle;
    if (root) root.style.background = bgStyle;

    return () => {
      if (html) html.style.background = '';
      if (body) body.style.background = '';
      if (root) root.style.background = '';
    };
  }, []);

  const [error, setError] = useState(null);
  const socket = useSocket();
  const [socketStatus, setSocketStatus] = useState('Checking...');
  const [isOnline, setIsOnline] = useState(cachedData.current?.isOnline || false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [locationWatchId, setLocationWatchId] = useState(null);

  // Get current GPS position as a promise
  const getCurrentPosition = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });
  };

  // Toggle online/offline with GPS
  const handleToggleOnline = async () => {
    setTogglingOnline(true);
    const goingOnline = !isOnline;

    try {
      let lat, lng;
      if (goingOnline) {
        // Get GPS location before going online
        try {
          const pos = await getCurrentPosition();
          lat = pos.lat;
          lng = pos.lng;
        } catch (geoErr) {
          console.error('GPS error:', geoErr);
          const { toast } = await import('react-hot-toast');
          toast.error('Location permission required to go online. Please enable GPS.');
          setTogglingOnline(false);
          return;
        }
      }

      const res = await workerService.toggleOnline(goingOnline, lat, lng);
      if (res.success) {
        setIsOnline(goingOnline);
        
        // Update cache
        try {
          const cached = JSON.parse(sessionStorage.getItem('workerDashboardCache') || '{}');
          cached.isOnline = goingOnline;
          sessionStorage.setItem('workerDashboardCache', JSON.stringify(cached));
        } catch(e) {}

        const { toast } = await import('react-hot-toast');
        toast.success(res.message);

        // Start periodic location updates when online
        if (goingOnline) {
          startLocationTracking();
        } else {
          stopLocationTracking();
        }
      }
    } catch (error) {
      console.error('Toggle online error:', error);
      const { toast } = await import('react-hot-toast');
      toast.error('Failed to update status');
    } finally {
      setTogglingOnline(false);
    }
  };

  // Periodic location tracking (every 2 minutes when online)
  const startLocationTracking = () => {
    stopLocationTracking(); // clear any existing
    const id = setInterval(async () => {
      try {
        const pos = await getCurrentPosition();
        await workerService.updateLocation(pos.lat, pos.lng);
      } catch (err) {
        console.warn('Background location update failed:', err.message);
      }
    }, 2 * 60 * 1000); // Every 2 minutes
    setLocationWatchId(id);
  };

  const stopLocationTracking = () => {
    if (locationWatchId) {
      clearInterval(locationWatchId);
      setLocationWatchId(null);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopLocationTracking();
  }, [locationWatchId]);

  // Fetch Dashboard Data Function
  const fetchDashboardData = async (isBackground = false) => {
    try {
      if (!isBackground && !cachedData.current) setLoading(true);

      // Fetch Profile, Stats and Recent Jobs in parallel (Stats also includes recent jobs but let's be robust)
      const [profileRes, statsRes, subRes] = await Promise.all([
        workerService.getProfile(),
        workerService.getDashboardStats(),
        workerService.getSubscriptionStatus()
      ]);

      let newWorkerProfile = { ...workerProfile };
      let newStats = { ...stats };
      let newSubscriptionStatus = subscriptionStatus;
      let newRecentJobs = [...recentJobs];

      if (profileRes.success) {
        const profile = profileRes.worker;
        newWorkerProfile = {
          name: profile.name || 'Worker Name',
          phone: profile.phone || '',
          photo: profile.profilePhoto || null,
          categories: profile.serviceCategories || (profile.serviceCategory ? [profile.serviceCategory] : []),
          address: profile.address,
        };
        setWorkerProfile(newWorkerProfile);
        // Sync online status from DB
        setIsOnline(profile.isOnline || false);
      }

      if (statsRes.success) {
        const { totalEarnings, activeJobs, pendingJobs, completedJobs, rating, recentJobs: apiRecentJobs } = statsRes.data;
        newStats = {
          ...newStats,
          totalEarnings: totalEarnings || 0,
          thisMonthEarnings: totalEarnings || 0,
          pendingJobs: pendingJobs || 0,
          acceptedJobs: activeJobs || 0,
          completedJobs: completedJobs || 0,
          rating: rating || 0
        };
        setStats(newStats);

        if (apiRecentJobs && apiRecentJobs.length > 0) {
          newRecentJobs = apiRecentJobs.map(job => ({
            id: job._id,
            serviceType: job.serviceId?.title || job.serviceName || 'Service',
            customerName: job.userId?.name || 'Customer',
            location: job.address?.city || 'Location N/A',
            time: job.scheduledTime || 'N/A',
            status: job.status,
            price: job.finalAmount,
            workerResponse: job.workerResponse,
            cancellationReason: job.cancellationReason,
          }));
          setRecentJobs(newRecentJobs);
        }
      }

      if (subRes && subRes.success) {
        newSubscriptionStatus = subRes.data;
        setSubscriptionStatus(newSubscriptionStatus);
      }

      // Save to cache
      try {
        sessionStorage.setItem('workerDashboardCache', JSON.stringify({
          workerProfile: newWorkerProfile,
          stats: newStats,
          subscriptionStatus: newSubscriptionStatus,
          recentJobs: newRecentJobs,
          isOnline: profileRes.success ? profileRes.worker.isOnline : isOnline
        }));
      } catch (e) { /* ignore quota errors */ }

      setLoading(false);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data');
      setLoading(false);
    }
  };

  // Load real data from API
  useEffect(() => {
    fetchDashboardData();

    // Ask for notification permission and register FCM
    registerFCMToken('worker', true).catch(err => console.error('FCM registration failed:', err));

    // Listen for updates
    const handleUpdate = () => {
      fetchDashboardData(true);
    };
    window.addEventListener('workerJobsUpdated', handleUpdate);

    return () => {
      window.removeEventListener('workerJobsUpdated', handleUpdate);
    };

  }, []);



  // Socket Listener for New Jobs
  useEffect(() => {
    if (!socket) return;
    
    // Test type notifications or other minor notifications can be handled here if needed in future
    
    return () => {
    };
  }, [socket, recentJobs]);

  // Test Push Notification
  const handleTestPush = async () => {
    try {
      const { toast } = await import('react-hot-toast');
      const loadingToast = toast.loading('Sending test push...');

      const res = await workerService.testPushNotification();

      toast.dismiss(loadingToast);
      if (res.success) {
        toast.success('Test push sent! Check your notification tray.');
      } else {
        toast.error(res.error || 'Failed to send test push');
      }
    } catch (err) {
      console.error('Test push error:', err);
      const { toast } = await import('react-hot-toast');
      toast.error('Error triggering test push');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-20" style={{ background: themeColors.backgroundGradient }}>
        <Header title="Dashboard" showBack={false} />
        <main className="px-4 py-4 space-y-6">
          <SkeletonProfileHeader />
          <SkeletonDashboardStats />
          <div className="space-y-4">
            <div className="h-6 w-32 bg-slate-200 rounded animate-pulse"></div>
            <SkeletonList count={3} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: themeColors.backgroundGradient }}>
      <Header title="Dashboard" showBack={false} notificationCount={stats.pendingJobs} />

      <main className="pt-0">
        {/* Profile Card Section */}
        <div className="px-4 pt-4 pb-2">
          <div
            className="rounded-2xl p-4 cursor-pointer active:scale-98 transition-all duration-200 relative overflow-hidden shadow-sm"
            onClick={() => navigate('/worker/profile')}
            style={{
              background: hexToRgba(themeColors.button, 0.04),
              border: `1px solid ${hexToRgba(themeColors.button, 0.1)}`,
            }}
          >
            {/* Decorative Pattern */}
            <div
              className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10"
              style={{
                background: `radial-gradient(circle, ${themeColors.button} 0%, transparent 70%)`,
                transform: 'translate(20px, -20px)',
              }}
            />

            <div className="relative z-10 flex items-center gap-3">
              {/* Profile Photo */}
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${themeColors.button}20 0%, ${themeColors.button}10 100%)`,
                  border: `2.5px solid ${themeColors.button}40`,
                }}
              >

                {workerProfile.photo ? (
                  <OptimizedImage
                    src={workerProfile.photo}
                    alt={workerProfile.name}
                    className="w-full h-full object-cover"
                    width={56}
                    height={56}
                  />
                ) : (
                  <FiUser className="w-7 h-7" style={{ color: themeColors.button }} />
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold uppercase tracking-wider mb-0.5 text-gray-700" style={{
                  letterSpacing: '0.12em',
                }}>
                  WELCOME !
                </p>
                <h2 className="text-base font-bold text-gray-800 truncate mb-0.5">{workerProfile.name}</h2>
                {workerProfile.categories && workerProfile.categories.length > 0 && (
                  <p className="text-xs text-gray-500 truncate font-medium">
                    {workerProfile.categories.join(', ')}
                  </p>
                )}
              </div>

              {/* Arrow Icon */}
              <div
                className="p-2.5 rounded-lg shrink-0 bg-gray-50"
                style={{
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                }}
              >
                <FiChevronRight className="w-6 h-6 text-gray-400" style={{ fontWeight: 'bold' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Status Alert */}
        {subscriptionStatus && (
          <div className="px-4 pt-2 -mb-2">
            {!subscriptionStatus.isActive ? (() => {
              const hasExpiredPlan = subscriptionStatus.expiryDate && new Date(subscriptionStatus.expiryDate).getFullYear() > 2000;
              return (
                <div
                  onClick={() => navigate('/worker/subscription')}
                  className={`${hasExpiredPlan ? 'bg-red-50 border-red-500 hover:bg-red-100' : 'bg-blue-50 border-blue-500 hover:bg-blue-100'} border-l-4 p-4 rounded-r shadow-sm cursor-pointer transition-colors`}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {hasExpiredPlan ? (
                        <FiClock className="h-5 w-5 text-red-500" />
                      ) : (
                        <FiBriefcase className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                    <div className="ml-3">
                      <p className={`text-sm font-bold ${hasExpiredPlan ? 'text-red-700' : 'text-blue-700'}`}>
                        {hasExpiredPlan ? 'Plan Expired!' : 'Buy Plan to start getting booking'}
                      </p>
                      <p className={`text-xs mt-0.5 ${hasExpiredPlan ? 'text-red-600' : 'text-blue-600'}`}>
                        {hasExpiredPlan
                          ? `Your subscription ended on ${new Date(subscriptionStatus.expiryDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}.`
                          : 'Get a subscription plan to receive unlimited bookings.'}
                      </p>
                    </div>
                    <div className="ml-auto">
                      <FiArrowRight className={`h-4 w-4 ${hasExpiredPlan ? 'text-red-500' : 'text-blue-500'}`} />
                    </div>
                  </div>
                </div>
              );
            })() : (() => {
              const diff = new Date(subscriptionStatus.expiryDate) - new Date();
              const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
              if (days <= 3) {
                return (
                  <div
                    onClick={() => navigate('/worker/subscription')}
                    className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r shadow-sm cursor-pointer hover:bg-amber-100 transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <FiClock className="h-5 w-5 text-amber-500" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-bold text-amber-700">Plan Expiring Soon!</p>
                        <p className="text-xs text-amber-600">
                          Expires on {new Date(subscriptionStatus.expiryDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}.
                        </p>
                      </div>
                      <div className="ml-auto">
                        <FiArrowRight className="h-4 w-4 text-amber-500" />
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* Incomplete Profile Prompt */}
        {((!workerProfile.categories || workerProfile.categories.length === 0) ||
          (!workerProfile.address || Object.keys(workerProfile.address).length === 0)) && (
            <div className="px-4 pt-2 -mb-2">
              <div
                onClick={() => navigate('/worker/profile')}
                className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r shadow-sm cursor-pointer hover:bg-orange-100 transition-colors"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FiClock className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-bold text-orange-700">Profile Incomplete</p>
                    <p className="text-sm text-orange-600">
                      Complete your profile (Address and Category) to start receiving jobs.
                    </p>
                  </div>
                  <div className="ml-auto">
                    <FiArrowRight className="h-4 w-4 text-orange-500" />
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Online/Offline Toggle */}
        <div className="px-4 pt-3 pb-1">
          <div
            className="rounded-2xl p-4 flex items-center justify-between transition-all duration-500 shadow-sm"
            style={{
              background: isOnline ? 'rgba(16, 185, 129, 0.05)' : '#ffffff',
              border: isOnline 
                ? '1px solid rgba(16, 185, 129, 0.2)'
                : '1px solid rgba(0, 0, 0, 0.05)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${isOnline ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: isOnline ? '#10b981' : '#9ca3af' }}
              />
              <div>
                <p className="font-bold text-sm text-gray-800">
                  {isOnline ? 'You are Online' : 'You are Offline'}
                </p>
                <p className="text-gray-500 text-xs">
                  {isOnline ? 'Receiving job alerts • GPS active' : 'Go online to receive jobs'}
                </p>
              </div>
            </div>

            <button
              onClick={handleToggleOnline}
              disabled={togglingOnline}
              className="px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-60"
              style={{
                background: isOnline ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                color: isOnline ? '#ef4444' : '#10b981',
                border: 'none',
              }}
            >
              {togglingOnline ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>...</span>
                </div>
              ) : isOnline ? 'Go Offline' : 'Go Online'}
            </button>
          </div>
        </div>

        {/* TEST CALL CARD (Commented out as per request)
        <div className="px-4 pt-2 pb-1">
          <button
            onClick={() => {
              const testJob = {
                id: 'test-id-' + Date.now(),
                _id: 'test-id-' + Date.now(),
                serviceType: 'AC Service (Test)',
                customerName: 'Test Customer',
                customerPhone: '9876543210',
                location: { address: '123 Test Street, Test City' },
                price: 499,
                status: 'ASSIGNED',
                createdAt: new Date().toISOString()
              };
              window.dispatchEvent(new CustomEvent('showWorkerJobAlert', { detail: testJob }));
            }}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all"
          >
            TEST CALL CARD
          </button>
        </div>
        */}

        {/* Notification Status & Debug - NEW */}
        {/* <div className="px-4 py-2">
          <div className="bg-white/50 backdrop-blur-md rounded-2xl p-3 border border-white/20 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${Notification.permission === 'granted' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}
              />
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Notification Status</p>
                <p className={`text-xs font-bold ${Notification.permission === 'granted' ? 'text-green-600' : 'text-red-600'}`}>
                  {Notification.permission === 'granted' ? '✅ Active & Ready' : '❌ Blocked / Not Setup'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (window.fcmDebug) window.fcmDebug();
                  if (window.testLocalFCMUI) window.testLocalFCMUI();
                }}
                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 active:scale-95 transition-all"
              >
                TEST UI
              </button>
              <button
                onClick={async () => {
                  const { registerFCMToken } = await import('../../../../services/pushNotificationService');
                  registerFCMToken('worker', true);
                }}
                className="p-2 bg-orange-50 text-orange-600 rounded-lg text-[10px] font-bold hover:bg-orange-100 active:scale-95 transition-all"
              >
                RE-REGISTER
              </button>
            </div>
          </div>
          {Notification.permission !== 'granted' && (
            <p className="text-[9px] text-red-500 font-bold mt-1 px-1">
              ⚠️ Notifications are disabled in your browser. Click the lock icon in the URL bar to fix.
            </p>
          )}
        </div> */}

        {/* Stats Cards - Outside Gradient */}
        <div className="px-4 pt-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Card 1: This Month Earnings - White Look */}
            <div
              onClick={() => navigate('/worker/jobs')}
              className="rounded-xl p-4 relative overflow-hidden cursor-pointer active:scale-95 transition-transform shadow-sm"
              style={{
                background: 'rgba(59, 130, 246, 0.04)',
                border: '1px solid rgba(59, 130, 246, 0.1)',
              }}
            >
              {/* Decorative Pattern */}
              <div
                className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10"
                style={{
                  background: 'radial-gradient(circle, #e5e7eb 0%, transparent 70%)',
                  transform: 'translate(20px, -20px)',
                }}
              />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider leading-tight">This Month</p>
                  <FaWallet className="w-5 h-5 text-blue-500 opacity-80 shrink-0" />
                </div>
                <div className="mb-2">
                  <p className="text-xl font-bold text-gray-800 leading-tight truncate">
                    ₹{stats.thisMonthEarnings.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <FiTrendingUp className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Earnings</span>
                </div>
              </div>
            </div>

            {/* Card 2: Pending Jobs - White Look */}
            <div
              onClick={() => navigate('/worker/jobs', { state: { filter: 'confirmed' } })}
              className="rounded-xl p-4 relative overflow-hidden cursor-pointer active:scale-95 transition-transform shadow-sm"
              style={{
                background: 'rgba(249, 115, 22, 0.04)',
                border: '1px solid rgba(249, 115, 22, 0.1)',
              }}
            >
              {/* Decorative Pattern */}
              <div
                className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10"
                style={{
                  background: 'radial-gradient(circle, #e5e7eb 0%, transparent 70%)',
                  transform: 'translate(20px, -20px)',
                }}
              />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider leading-tight">Pending Jobs</p>
                  <FiClock className="w-5 h-5 text-orange-500 opacity-80 shrink-0" />
                </div>
                <div className="mb-2">
                  <p className="text-xl font-bold text-gray-800 leading-tight truncate">
                    {stats.pendingJobs}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <FiCheckCircle className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Waiting</span>
                </div>
              </div>
            </div>

            {/* Card 3: Accepted Jobs - White Look */}
            <div
              onClick={() => navigate('/worker/jobs', { state: { filter: 'in_progress' } })}
              className="rounded-xl p-4 relative overflow-hidden cursor-pointer active:scale-95 transition-transform shadow-sm"
              style={{
                background: 'rgba(59, 130, 246, 0.04)',
                border: '1px solid rgba(59, 130, 246, 0.1)',
              }}
            >
              {/* Decorative Pattern */}
              <div
                className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10"
                style={{
                  background: 'radial-gradient(circle, #e5e7eb 0%, transparent 70%)',
                  transform: 'translate(20px, -20px)',
                }}
              />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider leading-tight">Accepted</p>
                  <FiCheckCircle className="w-5 h-5 text-blue-500 opacity-80 shrink-0" />
                </div>
                <div className="mb-2">
                  <p className="text-xl font-bold text-gray-800 leading-tight truncate">
                    {stats.acceptedJobs}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <FiBriefcase className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Active</span>
                </div>
              </div>
            </div>

            {/* Card 4: Completed Jobs - White Look */}
            <div
              onClick={() => navigate('/worker/jobs', { state: { filter: 'completed' } })}
              className="rounded-xl p-4 relative overflow-hidden cursor-pointer active:scale-95 transition-transform shadow-sm"
              style={{
                background: 'rgba(34, 197, 94, 0.04)',
                border: '1px solid rgba(34, 197, 94, 0.1)',
              }}
            >
              {/* Decorative Pattern */}
              <div
                className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10"
                style={{
                  background: 'radial-gradient(circle, #e5e7eb 0%, transparent 70%)',
                  transform: 'translate(20px, -20px)',
                }}
              />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider leading-tight">Completed</p>
                  <FiBriefcase className="w-5 h-5 text-green-500 opacity-80 shrink-0" />
                </div>
                <div className="mb-2">
                  <p className="text-xl font-bold text-gray-800 leading-tight truncate">
                    {stats.completedJobs}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <FiCheckCircle className="w-3.5 h-3.5 text-green-500 opacity-80" />
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Done</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Jobs Section */}
        <div className="px-4 pt-4 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Recent Jobs</h2>
            {recentJobs.length > 0 && (
              <button
                onClick={() => navigate('/worker/jobs')}
                className="px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 active:scale-95"
                style={{
                  background: hexToRgba(themeColors.button, 0.05),
                  color: themeColors.button,
                  border: `1px solid ${hexToRgba(themeColors.button, 0.2)}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = hexToRgba(themeColors.button, 0.1);
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = hexToRgba(themeColors.button, 0.05);
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                View All
              </button>
            )}
          </div>
          {recentJobs.length > 0 ? (
            <div className="space-y-3">
              {recentJobs.map((job, index) => {
                const accentColor = themeColors.button;

                return (
                  <div
                    key={job.id}
                    onClick={() => navigate(`/worker/job/${job.id}`)}
                    className="bg-white rounded-xl shadow-sm cursor-pointer active:scale-98 transition-all duration-200 relative overflow-hidden"
                    style={{
                      border: '1px solid rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    {/* Left accent border */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl"
                      style={{
                        background: hexToRgba(accentColor, 0.15),
                      }}
                    />

                    {/* Compact Content */}
                    <div className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        {/* Profile Image Circle */}
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                          style={{
                            border: `1px solid ${hexToRgba(accentColor, 0.2)}`,
                            background: hexToRgba(accentColor, 0.05),
                          }}
                        >
                          <FiUser className="w-5 h-5" style={{ color: accentColor }} />
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          {/* Name and Service in one line */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <p className="text-sm font-bold text-gray-800 truncate">{job.customerName}</p>
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-lg shrink-0"
                              style={{
                                background: hexToRgba(accentColor, 0.1),
                                color: accentColor,
                                border: `1px solid ${hexToRgba(accentColor, 0.2)}`,
                              }}
                            >
                              {job.serviceType || 'Service'}
                            </span>
                          </div>

                          {/* Address, Time, Status in one line */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <div
                              className="flex items-center gap-1 px-2 py-0.5 rounded"
                              style={{
                                background: 'rgba(0, 166, 166, 0.1)',
                                border: '1px solid rgba(0, 166, 166, 0.2)',
                              }}
                            >
                              <FiMapPin className="w-3 h-3" style={{ color: themeColors.button }} />
                              <span className="text-xs font-semibold text-gray-700 truncate max-w-[100px]">{job.location}</span>
                            </div>
                            <div
                              className="flex items-center gap-1 px-2 py-0.5 rounded"
                              style={{
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.2)',
                              }}
                            >
                              <FiClock className="w-3 h-3" style={{ color: '#F59E0B' }} />
                              <span className="text-xs font-semibold text-gray-700">{job.time}</span>
                            </div>
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: `${accentColor}15`,
                                color: accentColor,
                                border: `1px solid ${accentColor}30`,
                              }}
                            >
                              {job.status?.toLowerCase() === 'cancelled' && (job.workerResponse !== 'ACCEPTED' || job.cancellationReason?.toLowerCase().includes('timeout'))
                                ? 'Expired'
                                : getStatusLabel(job.status)}
                            </span>
                          </div>
                        </div>

                        {/* Navigate Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/worker/job/${job.id}`);
                          }}
                          className="p-2 rounded-lg shrink-0 transition-all duration-300 active:scale-95 bg-gray-50 hover:bg-gray-100"
                          style={{
                            border: '1px solid rgba(0, 0, 0, 0.05)',
                          }}
                        >
                          <FiArrowRight className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="bg-white rounded-xl p-8 text-center shadow-md"
              style={{
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              }}
            >
              <FiBriefcase className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-600 font-semibold mb-2">No jobs assigned yet</p>
              <p className="text-sm text-gray-500">
                You'll see assigned jobs here when partners or admin assign work to you
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Test Push Notification Floating Button (Commented out)
      <div className="fixed bottom-24 right-4 z-40">
        <button
          onClick={handleTestPush}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 16px rgba(245, 124, 0, 0.4)',
          }}
          title="Test Push Notification"
        >
          <FiBell className="w-7 h-7 text-white" />
        </button>
      </div>
      */}

    </div >
  );
};

export default Dashboard;


