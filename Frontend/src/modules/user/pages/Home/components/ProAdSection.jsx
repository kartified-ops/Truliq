import React from 'react';
import { themeColors } from '../../../../../theme';

const ProAdSection = ({ onJoinClick }) => {
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl mx-4 mt-4 relative border"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderColor: 'rgba(214, 143, 53, 0.3)',
      }}
    >
      {/* Decorative Glow */}
      <div 
        className="absolute top-0 right-0 w-24 h-24 rounded-full filter blur-xl opacity-20 pointer-events-none"
        style={{
          background: themeColors.brand.gradient
        }}
      />

      <div className="p-5 flex items-center justify-between relative z-10">
        <div className="flex-1 pr-2">
          {/* Badge */}
          <span 
            className="inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full text-white mb-2"
            style={{
              background: 'linear-gradient(90deg, #D68F35 0%, #BB5F36 100%)',
              boxShadow: '0 2px 8px rgba(214, 143, 53, 0.4)'
            }}
          >
            Limited Offer
          </span>

          <h3 className="text-lg font-extrabold text-white leading-tight">
            Homster <span style={{ color: '#D68F35' }}>Pro</span> Membership
          </h3>
          
          <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
            Get <span className="font-bold text-white">₹0 visiting fees</span> & flat <span className="font-bold text-white text-emerald-400">15% off</span> on all home services.
          </p>
        </div>

        {/* Crown VIP Icon Container with floating animation */}
        <div className="relative flex items-center justify-center mr-2">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border"
            style={{
              background: 'linear-gradient(135deg, rgba(214, 143, 53, 0.15) 0%, rgba(187, 95, 54, 0.15) 100%)',
              borderColor: 'rgba(214, 143, 53, 0.25)',
            }}
          >
            <span className="text-3xl animate-bounce" style={{ animationDuration: '3s' }}>👑</span>
          </div>
          {/* Sparkles */}
          <span className="absolute -top-1 -right-1 text-xs text-yellow-400 animate-ping">✨</span>
        </div>
      </div>

      <button
        onClick={onJoinClick}
        className="w-full text-white font-bold py-3.5 active:scale-98 transition-all rounded-b-2xl flex items-center justify-center gap-2 border-t"
        style={{
          background: 'linear-gradient(95deg, #347989 0%, #2a616e 100%)',
          borderColor: 'rgba(52, 121, 137, 0.3)',
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'linear-gradient(95deg, #2a616e 0%, #1e4650 100%)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'linear-gradient(95deg, #347989 0%, #2a616e 100%)';
        }}
      >
        <span>Unlock Pro Benefits for ₹99/mo</span>
        <span className="text-sm">➔</span>
      </button>
    </div>
  );
};

export default ProAdSection;
