import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

const PromoAdSection = ({ onBookClick }) => {
  const [copied, setCopied] = useState(false);
  const couponCode = 'COOL20';

  const handleCopyCode = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(couponCode);
    setCopied(true);
    toast.success('Coupon code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-xl mx-4 mt-4 relative border cursor-pointer active:scale-[0.99] transition-all"
      onClick={onBookClick}
      style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #0369a1 50%, #0891b2 100%)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        boxShadow: '0 12px 24px -10px rgba(14, 116, 144, 0.4)'
      }}
    >
      {/* Cool Airflow Wave Illustration */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 80% 20%, #ffffff 0%, transparent 60%)`
        }}
      />

      <div className="p-5 flex items-center justify-between relative z-10">
        <div className="flex-1 pr-3">
          {/* Badge */}
          <span 
            className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full text-white mb-2 bg-white/10 backdrop-blur-md border border-white/20"
          >
            <span>❄️</span> Summer Special
          </span>

          <h3 className="text-xl font-black text-white leading-tight tracking-tight">
            Beat The Heat!
          </h3>
          <p className="text-sm font-semibold text-cyan-200">
            AC Wet Service & Repair
          </p>
          
          <p className="text-xs text-cyan-100/90 mt-1.5 font-medium leading-relaxed">
            Get professional AC Gas Refills, Servicing, and Repairs at <span className="font-bold text-white text-yellow-300">flat 20% off</span>.
          </p>

          {/* Coupon Code Block */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] text-cyan-100 font-bold uppercase">Use Code:</span>
            <button
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-dashed border-yellow-300/60 bg-yellow-400/10 text-yellow-300 text-xs font-bold transition-all hover:bg-yellow-400/20 active:scale-95"
            >
              <span>{couponCode}</span>
              <span className="text-[10px] text-yellow-400 font-normal">
                {copied ? 'Copied! ✓' : '📋 Copy'}
              </span>
            </button>
          </div>
        </div>

        {/* Floating Air Conditioner / Snowflake Icon */}
        <div className="relative flex items-center justify-center mr-1">
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-inner border animate-pulse"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 100%)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.2)'
            }}
          >
            <span className="text-4xl select-none animate-spin" style={{ animationDuration: '8s' }}>🌬️</span>
          </div>
          <span className="absolute -bottom-2 -left-2 text-lg animate-bounce" style={{ animationDuration: '2s' }}>❄️</span>
          <span className="absolute -top-1 -right-1 text-sm animate-ping">✨</span>
        </div>
      </div>

      <div
        className="w-full text-white font-bold py-3 text-center text-sm flex items-center justify-center gap-2 border-t border-white/10 hover:bg-white/5 transition-all"
        style={{
          background: 'rgba(0, 0, 0, 0.15)'
        }}
      >
        <span>Book AC Service Now</span>
        <span className="text-xs transition-transform group-hover:translate-x-1">➔</span>
      </div>
    </div>
  );
};

export default PromoAdSection;
