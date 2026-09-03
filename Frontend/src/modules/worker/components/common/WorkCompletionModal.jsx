import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiTrash, FiCamera, FiDollarSign, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import flutterBridge from '../../../../utils/flutterBridge';

const WorkCompletionModal = ({ isOpen, onClose, job, onComplete, loading }) => {
  const [workPhotos, setWorkPhotos] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const cameraInputRef = React.useRef(null);

  const handleNativeCamera = async () => {
    try {
      setIsUploading(true);
      const file = await flutterBridge.openCamera();
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setWorkPhotos(prev => [...prev, reader.result]);
          setIsUploading(false);
          flutterBridge.hapticFeedback('success');
        };
        reader.readAsDataURL(file);
      } else {
        setIsUploading(false);
      }
    } catch (error) {
      console.error('Native camera failed:', error);
      setIsUploading(false);
    }
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    const uploadPromises = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(uploadPromises).then(urls => {
      setWorkPhotos(prev => [...prev, ...urls]);
      setIsUploading(false);
    });
  };

  const handleRemovePhoto = (index) => {
    setWorkPhotos(prev => prev.filter((_, i) => i !== index));
    flutterBridge.hapticFeedback('light');
  };

  const calculateTotal = () => {
    // For Plan Benefit, user only pays for Extra Charges
    if (job?.paymentMethod === 'plan_benefit') {
      return job?.extraChargesTotal || 0;
    }

    // For normal bookings, prefer finalAmount (even if 0)
    if (typeof job?.finalAmount === 'number') {
      return job.finalAmount;
    }

    return ((job?.basePrice || 0) + (job?.tax || 0) - (job?.discount || 0));
  };

  const handleSubmit = () => {
    if (workPhotos.length === 0) {
      toast.error('At least one photo from camera is mandatory');
      flutterBridge.hapticFeedback('error');
      return;
    }
    onComplete(workPhotos);
  };

  if (typeof document === 'undefined') return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="bg-white w-full max-w-md rounded-[28px] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex justify-between items-start border-b border-gray-100/80 shrink-0 bg-white">
              <div>
                <h3 className="text-2xl font-black text-gray-900 leading-tight">Complete Work</h3>
                <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider mt-1">Final Step</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 active:scale-95"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="px-6 py-4 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                Please upload proof of work from your camera to confirm completion.
              </p>

              {/* Photo Upload Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Work Photos <span className="text-red-500 font-bold">(Mandatory)</span>
                  </p>
                  <span className="text-[10px] bg-red-50 text-red-500 px-2 py-0.5 rounded-md font-bold">
                    {workPhotos.length}/5 (Min 1)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {workPhotos.map((photo, index) => (
                    <div key={index} className="aspect-square rounded-2xl bg-gray-100 border border-gray-100 relative overflow-hidden group">
                      <img src={photo} className="w-full h-full object-cover" alt="work" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <button
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow-md active:scale-90 transition-transform opacity-0 group-hover:opacity-100"
                      >
                        <FiTrash className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {workPhotos.length < 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (flutterBridge.isFlutter) {
                          handleNativeCamera();
                        } else {
                          cameraInputRef.current?.click();
                        }
                      }}
                      className="aspect-square rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/30 flex flex-col items-center justify-center text-gray-400 hover:text-emerald-500 cursor-pointer active:scale-95 transition-all"
                    >
                      <FiCamera className="w-7 h-7 mb-1" />
                      <span className="text-[10px] font-bold uppercase">Camera Only</span>
                    </button>
                  )}
                </div>

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={cameraInputRef}
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {isUploading && <p className="text-blue-500 text-[10px] font-bold mt-2 ml-1 animate-pulse">Uploading photos...</p>}
              </div>

              {/* Quality Checklist */}
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-700 mb-2.5">
                  <FiCheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-bold text-sm text-emerald-900">Quality Checklist</span>
                </div>
                <ul className="space-y-1.5">
                  {[
                    'Double checked the results',
                    'Cleaned up work area',
                    'Customer satisfaction confirmed'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Payment Info */}
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Bill Value</p>
                  <p className="text-xl font-black text-gray-900 mt-0.5">₹{calculateTotal().toFixed(2)}</p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <FiDollarSign className="w-5 h-5 font-bold" />
                </div>
              </div>
            </div>

            {/* Pinned Footer Action Buttons */}
            <div className="p-4 sm:px-6 sm:py-4 bg-white border-t border-gray-100 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3.5 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 active:scale-95 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || isUploading}
                className="flex-1 py-3.5 rounded-xl font-bold text-white shadow-lg shadow-emerald-500/25 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
              >
                {loading ? 'Confirming...' : 'Complete Work'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export default WorkCompletionModal;
