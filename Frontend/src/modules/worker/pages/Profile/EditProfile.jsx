import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiSave, FiUser, FiPhone, FiMail,
  FiMapPin, FiBriefcase, FiCamera, FiCheck,
  FiChevronDown, FiX, FiTrash2
} from 'react-icons/fi';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import workerService from '../../../../services/workerService';
import { publicCatalogService } from '../../../../services/catalogService';
import { toast } from 'react-hot-toast';
import AddressSelectionModal from '../../../user/pages/Checkout/components/AddressSelectionModal';
import { z } from "zod";
import flutterBridge from '../../../../utils/flutterBridge';

// Zod schema
const workerProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  serviceCategories: z.array(z.string()).min(1, "Select at least one category"),
  address: z.object({
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    pincode: z.string().optional(),
    landmark: z.string().optional(),
    fullAddress: z.string().optional(),
    location: z.any().optional()
  }).optional()
});

const EditProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  // Initialize from localStorage if available so refreshing never clears values
  const [formData, setFormData] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('workerData') || '{}');
      if (saved && Object.keys(saved).length > 0) {
        const fullAddr = saved.address?.fullAddress || [
          saved.address?.addressLine1,
          saved.address?.addressLine2,
          saved.address?.city,
          saved.address?.state,
          saved.address?.pincode
        ].filter(Boolean).join(', ') || '';

        return {
          name: saved.name || '',
          phone: saved.phone || '',
          email: saved.email || '',
          address: {
            addressLine1: saved.address?.addressLine1 || '',
            addressLine2: saved.address?.addressLine2 || '',
            city: saved.address?.city || '',
            state: saved.address?.state || '',
            country: saved.address?.country || 'India',
            pincode: saved.address?.pincode || '',
            landmark: saved.address?.landmark || '',
            fullAddress: fullAddr,
            location: saved.address?.location || saved.location || null
          },
          serviceCategories: Array.isArray(saved.serviceCategories) && saved.serviceCategories.length > 0
            ? saved.serviceCategories
            : (saved.serviceCategory ? [saved.serviceCategory] : []),
          profilePhoto: saved.profilePhoto || null,
          status: saved.status || 'OFFLINE'
        };
      }
    } catch (e) {
      // Fallback
    }

    return {
      name: '',
      phone: '',
      email: '',
      address: {
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        country: 'India',
        pincode: '',
        landmark: '',
        fullAddress: '',
        location: null
      },
      serviceCategories: [],
      profilePhoto: null,
      status: 'OFFLINE'
    };
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [errors, setErrors] = useState({});

  const handleNativeCamera = async () => {
    const file = await flutterBridge.openCamera();
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      flutterBridge.hapticFeedback('success');
    }
  };

  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        const [profileRes, catalogRes] = await Promise.all([
          workerService.getProfile(),
          publicCatalogService.getCategories()
        ]);

        if (profileRes.success && profileRes.worker) {
          const w = profileRes.worker;
          const fullAddr = w.address?.fullAddress || [
            w.address?.addressLine1,
            w.address?.addressLine2,
            w.address?.city,
            w.address?.state,
            w.address?.pincode
          ].filter(Boolean).join(', ') || '';

          const cats = Array.isArray(w.serviceCategories) && w.serviceCategories.length > 0
            ? w.serviceCategories
            : (w.serviceCategory ? [w.serviceCategory] : []);

          setFormData(prev => ({
            name: w.name || prev.name || '',
            phone: w.phone || prev.phone || '',
            email: w.email || prev.email || '',
            address: {
              addressLine1: w.address?.addressLine1 !== undefined ? w.address.addressLine1 : prev.address?.addressLine1 || '',
              addressLine2: w.address?.addressLine2 !== undefined ? w.address.addressLine2 : prev.address?.addressLine2 || '',
              city: w.address?.city || prev.address?.city || '',
              state: w.address?.state || prev.address?.state || '',
              country: w.address?.country || prev.address?.country || 'India',
              pincode: w.address?.pincode || prev.address?.pincode || '',
              landmark: w.address?.landmark || prev.address?.landmark || '',
              fullAddress: fullAddr || prev.address?.fullAddress || '',
              location: w.address?.location || w.location || prev.address?.location || null
            },
            serviceCategories: cats.length > 0 ? cats : prev.serviceCategories,
            profilePhoto: w.profilePhoto || prev.profilePhoto || null,
            status: w.status || prev.status || 'OFFLINE'
          }));

          // Keep localStorage up to date
          localStorage.setItem('workerData', JSON.stringify(w));
        }

        if (catalogRes.success) {
          setCategories(catalogRes.categories || []);
        }
      } catch (error) {
        console.error('Init error:', error);
        toast.error('Failed to load profile details');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  const uploadFile = async (file) => {
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    let baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    if (!baseUrl) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        baseUrl = 'http://localhost:5000';
      } else {
        baseUrl = window.location.origin;
      }
    }
    baseUrl = baseUrl.replace(/\/api$/, '');
    const response = await fetch(`${baseUrl}/api/image/upload`, {
      method: 'POST',
      body: uploadFormData,
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Upload failed');
    return data.imageUrl;
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size should be less than 5MB');
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleCategoryChange = (val) => {
    setFormData(prev => {
      const current = prev.serviceCategories || [];
      const updated = current.includes(val)
        ? current.filter(c => c !== val)
        : [...current, val];

      return {
        ...prev,
        serviceCategories: updated
      };
    });
  };

  const handleRemoveCategory = (catToRemove, e) => {
    if (e) e.stopPropagation();
    setFormData(prev => ({
      ...prev,
      serviceCategories: (prev.serviceCategories || []).filter(c => c !== catToRemove)
    }));
  };

  const handleAddressSave = (houseNumber, location) => {
    let city = '';
    let state = '';
    let pincode = '';
    let addressLine2 = '';

    if (location.components) {
      location.components.forEach(comp => {
        if (comp.types.includes('locality')) city = comp.long_name;
        if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
        if (comp.types.includes('postal_code')) pincode = comp.long_name;
        if (comp.types.includes('sublocality')) addressLine2 = comp.long_name;
      });
    }

    const fullFormatted = location.address || [houseNumber, addressLine2, city, state, pincode].filter(Boolean).join(', ');

    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        addressLine1: houseNumber || prev.address?.addressLine1 || '',
        addressLine2: addressLine2 || prev.address?.addressLine2 || '',
        city: city || prev.address?.city || '',
        state: state || prev.address?.state || '',
        pincode: pincode || prev.address?.pincode || '',
        fullAddress: fullFormatted,
        location: (location.lat && location.lng) ? { lat: location.lat, lng: location.lng } : prev.address?.location
      }
    }));
    setIsAddressModalOpen(false);
  };

  const handleSubmit = async () => {
    // Zod Validation
    const validationResult = workerProfileSchema.safeParse({
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      serviceCategories: formData.serviceCategories,
      address: formData.address
    });

    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues?.[0]?.message || "Validation failed";
      toast.error(errorMessage);
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: formData.name,
        email: formData.email,
        serviceCategories: formData.serviceCategories,
        serviceCategory: formData.serviceCategories?.[0] || '',
        address: formData.address,
        status: formData.status
      };

      if (photoFile === 'delete') {
        payload.profilePhoto = '';
      } else if (photoFile) {
        try {
          const photoUrl = await uploadFile(photoFile);
          payload.profilePhoto = photoUrl;
        } catch (uploadErr) {
          console.error('Photo upload failed', uploadErr);
          toast.error('Failed to upload photo');
          setSaving(false);
          return;
        }
      }

      const response = await workerService.updateProfile(payload);
      toast.success('Profile updated successfully');

      // Update local storage to keep session and components in sync
      const currentWorker = JSON.parse(localStorage.getItem('workerData') || '{}');
      const updatedWorker = {
        ...currentWorker,
        ...(response?.worker || payload),
        address: response?.worker?.address || payload.address,
        serviceCategories: response?.worker?.serviceCategories || payload.serviceCategories,
        profilePhoto: response?.worker?.profilePhoto || payload.profilePhoto || currentWorker.profilePhoto
      };

      localStorage.setItem('workerData', JSON.stringify(updatedWorker));
      window.dispatchEvent(new Event('workerProfileUpdated'));

      navigate('/worker/profile');
    } catch (error) {
      console.error('Update failed:', error);
      toast.error(error.response?.data?.message || 'Update failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !formData.name) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500 font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  const formattedAddressDisplay = formData.address?.fullAddress || [
    formData.address?.addressLine1,
    formData.address?.addressLine2,
    formData.address?.city,
    formData.address?.state,
    formData.address?.pincode
  ].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title="Edit Profile" />

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">

        {/* Profile Photo */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <div
              className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-md overflow-hidden flex items-center justify-center cursor-pointer"
              onClick={() => setShowPhotoOptions(!showPhotoOptions)}
            >
              {photoPreview || formData.profilePhoto ? (
                <img src={photoPreview || formData.profilePhoto} className="w-full h-full object-cover" alt="Profile" />
              ) : (
                <div className="bg-gray-100 w-full h-full flex items-center justify-center">
                  <FiUser className="w-10 h-10 text-gray-300" />
                </div>
              )}
            </div>
            {/* Camera Icon */}
            <div
              className="absolute bottom-0 right-0 p-2 bg-blue-600 rounded-full text-white ring-2 ring-white shadow-sm cursor-pointer"
              onClick={() => setShowPhotoOptions(!showPhotoOptions)}
            >
              <FiCamera className="w-4 h-4" />
            </div>

            {/* Photo Options Dropdown */}
            {showPhotoOptions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPhotoOptions(false)}></div>
                <div className="absolute top-28 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden transform -translate-x-1/4">
                  <button
                    onClick={() => {
                      setShowPhotoOptions(false);
                      if (flutterBridge.isFlutter) {
                        handleNativeCamera();
                      } else {
                        document.getElementById('camera-upload').click();
                      }
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2"
                  >
                    <FiCamera className="w-4 h-4" /> Take Photo
                  </button>
                  <button
                    onClick={() => { setShowPhotoOptions(false); document.getElementById('photo-upload').click(); }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2"
                  >
                    <FiUser className="w-4 h-4" /> Upload from Gallery
                  </button>
                  {(photoPreview || formData.profilePhoto) && (
                    <button
                      onClick={() => {
                        setShowPhotoOptions(false);
                        setPhotoFile('delete');
                        setPhotoPreview(null);
                        setFormData(prev => ({ ...prev, profilePhoto: '' }));
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm font-medium text-red-600 flex items-center gap-2"
                    >
                      <FiTrash2 className="w-4 h-4" /> Remove Photo
                    </button>
                  )}
                </div>
              </>
            )}

            <input
              type="file"
              id="camera-upload"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                handlePhotoChange(e);
                setShowPhotoOptions(false);
              }}
            />

            <input
              type="file"
              id="photo-upload"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handlePhotoChange(e);
                setShowPhotoOptions(false);
              }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2 font-medium">Tap to change photo</p>
        </div>

        {/* Personal Details */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <FiUser className="text-blue-600" />
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Personal Details</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block ml-1">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all ${errors.name ? 'border-red-500' : 'border-gray-200'}`}
                placeholder="Enter name"
              />
              {errors.name && <p className="text-red-500 text-[10px] mt-1 ml-1">{errors.name}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block ml-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block ml-1">Phone Number</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.phone}
                  readOnly
                  className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded">
                  VERIFIED
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Address & Location Details */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FiMapPin className="text-blue-600" />
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Location & Address</h2>
            </div>
            {formData.address?.city && (
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                {formData.address.city}
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              {formattedAddressDisplay ? (
                <div>
                  <p className="text-sm font-medium text-gray-800 leading-relaxed">
                    {formattedAddressDisplay}
                  </p>
                  {formData.address?.state && (
                    <p className="text-xs text-gray-400 mt-1">
                      {[formData.address?.state, formData.address?.country || 'India', formData.address?.pincode].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No location or address selected yet</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsAddressModalOpen(true)}
              className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm border border-blue-100 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 active:scale-95"
            >
              <FiMapPin className="w-4 h-4" />
              {formattedAddressDisplay ? 'Change Location on Map' : 'Select Location on Map'}
            </button>
          </div>
        </div>

        {/* Work Category */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FiBriefcase className="text-blue-600" />
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Work Profile</h2>
            </div>
            <span className="text-[11px] font-bold text-gray-400">
              {(formData.serviceCategories || []).length} Selected
            </span>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wide">
              Service Categories <span className="text-red-500">*</span>
            </label>

            {/* Selected category chips */}
            {formData.serviceCategories && formData.serviceCategories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {formData.serviceCategories.map((cat, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold border border-blue-100 shadow-sm"
                  >
                    <span>{cat}</span>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveCategory(cat, e)}
                      className="hover:text-red-500 rounded-full p-0.5"
                    >
                      <FiX className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <div
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between cursor-pointer hover:border-blue-400 transition-all"
              >
                <span className="text-sm font-medium text-gray-600">
                  {formData.serviceCategories && formData.serviceCategories.length > 0
                    ? `Click to add or change categories`
                    : 'Select Categories'}
                </span>
                <div className="flex-shrink-0 bg-white p-1 rounded-md border border-gray-200">
                  <FiChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {isCategoryOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsCategoryOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-40 max-h-60 overflow-y-auto custom-scrollbar">
                    {categories.length > 0 ? (
                      categories.map((cat, index) => {
                        const catTitle = cat.title || cat.name;
                        const isSelected = (formData.serviceCategories || []).includes(catTitle) || (formData.serviceCategories || []).includes(cat._id);
                        return (
                          <div
                            key={cat._id || index}
                            onClick={() => handleCategoryChange(catTitle)}
                            className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 font-medium text-sm flex justify-between items-center transition-colors ${isSelected ? 'bg-blue-50/50 text-blue-700 font-bold' : 'text-gray-700'}`}
                          >
                            <span>{catTitle}</span>
                            {isSelected && <FiCheck className="text-blue-600 w-4 h-4" />}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-xs text-gray-400">
                        No categories available
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            {errors.serviceCategories && <p className="text-red-500 text-[10px] mt-1">{errors.serviceCategories}</p>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm uppercase tracking-wider shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              <>
                <FiSave className="w-5 h-5" />
                Save Profile
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/worker/profile')}
            className="w-full py-3.5 bg-white text-gray-500 border border-gray-200 rounded-2xl font-bold text-sm uppercase tracking-wider active:scale-95 transition-all"
          >
            Cancel
          </button>
        </div>

      </main>

      <AddressSelectionModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        address={formData.address?.fullAddress || ''}
        houseNumber={formData.address?.addressLine1 || ''}
        onHouseNumberChange={(val) => handleInputChange('address.addressLine1', val)}
        onSave={handleAddressSave}
      />

      <BottomNav />
    </div>
  );
};

export default EditProfile;
