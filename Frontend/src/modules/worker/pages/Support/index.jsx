import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiLifeBuoy } from 'react-icons/fi';
import { gsap } from 'gsap';
import Logo from '../../../../components/common/Logo';
import { configService } from '../../../../services/configService';

const Support = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Scroll to top on load
    window.scrollTo(0, 0);

    // Fetch dynamic content
    const fetchContent = async () => {
      const data = await configService.getSettings();
      if (data?.success && data.settings?.supportPageContent) {
        setContent(data.settings.supportPageContent);
      } else {
        setContent('<p>Support content will be updated soon.</p>');
      }
      setLoading(false);
    };

    fetchContent();
  }, []);

  useEffect(() => {
    if (!loading) {
      // Simple entrance animation
      const ctx = gsap.context(() => {
        gsap.from('.animate-item', {
          y: 20,
          opacity: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: 'power2.out'
        });
      }, containerRef);

      return () => ctx.revert();
    }
  }, [loading]);

  // Gradient Definition for re-use in inline styles
  const TruliqGradient = 'linear-gradient(135deg, #347989 0%, #BB5F36 100%)';
  const TruliqTextGradient = {
    background: TruliqGradient,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans" ref={containerRef}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm animate-item">
        <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={() => navigate('/worker/login')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-600 hover:bg-[#347989] hover:text-white transition-all shadow-sm"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <Logo className="h-10 md:h-12 w-auto absolute left-1/2 -translate-x-1/2" />
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-8 pb-6 px-6 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#347989]/5 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#BB5F36]/5 rounded-full blur-3xl -ml-32 -mb-32" />
        
        <div className="max-w-3xl mx-auto relative z-10 text-center animate-item">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg mb-6 text-[#347989]">
            <FiLifeBuoy className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
            Support & <span style={TruliqTextGradient}>Help</span>
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed max-w-2xl mx-auto">
            We are here to assist you with any questions or issues.
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="pb-8 px-6 relative z-10 animate-item">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-3xl p-8 md:p-10 shadow-xl shadow-gray-200/50 border border-gray-100">
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3 mt-8"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </div>
            ) : (
              <div 
                className="prose prose-slate prose-h3:text-gray-900 prose-h3:font-bold prose-h3:text-xl prose-p:text-gray-600 prose-p:leading-relaxed prose-a:text-[#347989] prose-a:no-underline hover:prose-a:underline max-w-none whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Support;
