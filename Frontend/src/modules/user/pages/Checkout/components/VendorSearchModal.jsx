import React, { useEffect, useState } from 'react';
import { themeColors } from '../../../../../theme';

const VendorSearchModal = ({ isOpen, onClose, currentStep, acceptedVendor, onRetry, onTimeout, bookingModel = 'vendor', createdAt }) => {
  const [dots, setDots] = useState('.');
  const [timeLeft, setTimeLeft] = useState(120);

  useEffect(() => {
    if (isOpen && (currentStep === 'searching' || currentStep === 'waiting')) {
      const interval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? '.' : prev + '.');
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isOpen, currentStep]);

  useEffect(() => {
    if (isOpen && (currentStep === 'searching' || currentStep === 'waiting')) {
      let initialTime = 120;
      if (createdAt) {
        const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
        initialTime = Math.max(0, 120 - elapsed);
      }
      setTimeLeft(initialTime);

      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            onTimeout?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isOpen, currentStep, onTimeout, createdAt]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all relative">

        {/* Close/Minimize Button - Top Right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 bg-white/90 rounded-full shadow-sm text-gray-400 hover:text-gray-600 transition-colors hover:bg-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {(currentStep === 'searching' || currentStep === 'waiting') && (
          <div className="flex flex-col items-center justify-center pt-10 pb-16 px-6 relative min-h-[480px]">

            {/* Map-like Background (Subtle) */}
            <div className="absolute inset-0 opacity-5 pointer-events-none">
              <div className="w-full h-full" style={{
                backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}></div>
            </div>

            {/* Central Radar Animation */}
            <div className="relative w-56 h-56 flex items-center justify-center mb-8">
              {/* Outer Ripples */}
              <div className="absolute inset-0 rounded-full border-2 opacity-20 animate-ping"
                style={{ borderColor: themeColors.brand.teal, animationDuration: '3s' }}></div>
              <div className="absolute inset-4 rounded-full border opacity-40 animate-ping"
                style={{ borderColor: themeColors.brand.teal, animationDuration: '3s', animationDelay: '0.6s' }}></div>

              {/* Rotating Scanner Gradient */}
              <div className="absolute inset-0 rounded-full animate-spin-slow opacity-30"
                style={{
                  background: `conic-gradient(transparent 180deg, ${themeColors.brand.teal})`,
                  animationDuration: '4s'
                }}></div>

              {/* Center Core showing Search Icon / Loader */}
              <div className="relative z-10 w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center p-1">
                <div className="w-full h-full rounded-full flex items-center justify-center relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${themeColors.brand.teal}15, ${themeColors.brand.teal}05)` }}>
                  <div className="animate-pulse">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={themeColors.brand.teal} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Floating "Found" Dots Animation */}
              <div className="absolute top-8 right-8 w-2 h-2 rounded-full animate-bounce opacity-50" style={{ backgroundColor: themeColors.brand.orange, animationDelay: '0.2s' }}></div>
              <div className="absolute bottom-6 left-6 w-2 h-2 rounded-full animate-bounce opacity-50" style={{ backgroundColor: themeColors.brand.yellow, animationDelay: '1.5s' }}></div>
            </div>

            {/* Status Text */}
            <div className="text-center relative z-20 px-4 mb-4">
              <h3 className="text-xl font-black text-gray-900 mb-2">Searching nearby {bookingModel === 'worker' ? 'workers' : 'vendors'}</h3>
              <p className="text-gray-500 text-xs font-bold leading-relaxed mb-1">
                Please wait for a few minutes (2-3 minutes){dots}
              </p>
              <p className="text-gray-400 text-[10px] font-medium leading-relaxed">
                This window will close automatically if no worker is assigned.
              </p>
            </div>

            {/* Bottom Pill - Now positioned relative to avoid overlap */}
            <div className="flex justify-center mt-2">
              <div className="px-4 py-2 bg-gray-50 rounded-full border border-gray-100 text-[10px] font-black uppercase tracking-tighter text-gray-400">
                Searching for available {bookingModel}s
              </div>
            </div>

          </div>
        )}

        {currentStep === 'accepted' && acceptedVendor && (
          <div className="flex flex-col items-center pt-12 pb-10 px-6 bg-white w-full h-full min-h-[450px]">
            {/* Success Icon */}
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-2xl animate-bounce-short"
              style={{ background: `linear-gradient(135deg, ${themeColors.brand.teal}, ${themeColors.brand.secondary})` }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>

            <h3 className="text-2xl font-black text-gray-900 mb-2 italic">EXPERT FOUND!</h3>
            <p className="text-gray-400 text-[10px] text-center mb-8 px-4 font-black uppercase tracking-widest">
              Request accepted by professional
            </p>

            {/* Vendor Card */}
            <div className="w-full bg-gray-50 rounded-[32px] p-6 border border-gray-100 mb-10 relative overflow-hidden shadow-sm">
              <div className="relative z-10">
                <h4 className="font-black text-xl text-gray-900 mb-1">{acceptedVendor.businessName}</h4>
                <div className="flex items-center gap-4 text-xs font-bold text-gray-500 mt-3">
                  <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
                    <span className="text-yellow-400">★</span> {acceptedVendor.rating || '4.9'}
                  </span>
                  <span className="flex items-center gap-1.5 bg-green-50 text-green-600 px-3 py-1.5 rounded-full border border-green-100 uppercase tracking-tighter text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    {acceptedVendor.distance || 'Nearby'}
                  </span>
                </div>
              </div>
              {/* Background decoration */}
              <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-10" style={{ backgroundColor: themeColors.brand.teal }}></div>
            </div>

            {/* Action Button */}
            <button
              onClick={onClose}
              className="w-full text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${themeColors.brand.teal}, ${themeColors.brand.secondary})`,
              }}
            >
              Continue to Details
            </button>
          </div>
        )}

        {currentStep === 'failed' && (
          <div className="flex flex-col items-center pt-12 pb-10 px-6 bg-white w-full h-full min-h-[450px]">
            {/* Failed Icon */}
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-2xl bg-red-50 border-2 border-red-100">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>

            <h3 className="text-2xl font-black text-gray-900 mb-2 italic">NO {bookingModel.toUpperCase()} FOUND</h3>
            <p className="text-slate-500 text-sm font-bold text-center mb-10 px-8">
              Request not accepted yet. You can resend it.
            </p>

            <button
              onClick={onRetry}
              className="w-full text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 mb-4"
              style={{ background: themeColors.button }}
            >
              Resend Request
            </button>
            <button
              onClick={onClose}
              className="w-full text-gray-400 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Cancel Booking
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default VendorSearchModal;
