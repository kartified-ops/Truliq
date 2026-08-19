import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  FiUser, FiMail, FiPhone, FiFileText, FiUpload, FiX,
  FiArrowRight, FiChevronLeft, FiCheckCircle, FiGlobe,
  FiMapPin, FiCheck, FiLayers, FiNavigation, FiChevronDown, FiChevronUp
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { themeColors } from '../../../theme';
import { workerAuthService } from '../../../services/authService';
import api from '../../../services/api';
import Logo from '../../../components/common/Logo';
import { z } from "zod";

const toAssetUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const backendBase = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000';
  return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

// Zod schema for Worker Signup
const workerSignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").regex(/^[a-zA-Z\s]+$/, "Name can only contain letters"),
  email: z.string()
    .email("Please enter a valid email format (e.g. you@example.com)")
    .refine(val => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "Please enter a valid email format (e.g. you@example.com)"),
  phoneNumber: z.string()
    .length(10, "Mobile number must be exactly 10 digits")
    .regex(/^[6-9]/, "Mobile number must start with 6, 7, 8, or 9"),
  aadhar: z.string().regex(/^\d{12}$/, "Aadhar number must be exactly 12 digits"),
  country: z.string().min(1, "Please select country"),
  state: z.string().min(1, "Please select state"),
  city: z.string().min(1, "Please select city"),
  selectedCategories: z.array(z.string()).min(1, "Please select at least one service category")
});

const INDIAN_STATES = [
  "Madhya Pradesh",
  "Maharashtra",
  "Delhi",
  "Gujarat",
  "Rajasthan",
  "Uttar Pradesh",
  "Karnataka",
  "Tamil Nadu",
  "West Bengal",
  "Telangana",
  "Punjab",
  "Haryana",
  "Bihar",
  "Odisha",
  "Kerala",
  "Assam",
  "Jharkhand",
  "Chhattisgarh",
  "Uttarakhand",
  "Himachal Pradesh",
  "Goa",
  "Other"
];

const CITIES_BY_STATE = {
  "Madhya Pradesh": ["Indore", "Bhopal", "Gwalior", "Jabalpur", "Ujjain", "Sagar", "Dewas", "Satna", "Ratlam", "Rewa", "Katni", "Singrauli", "Burhanpur", "Khandwa", "Morena", "Bhind", "Chhindwara", "Guna", "Shivpuri", "Vidisha"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Pimpri-Chinchwad", "Nashik", "Kalyan-Dombivli", "Vasai-Virar", "Aurangabad", "Navi Mumbai", "Solapur", "Mira-Bhayandar", "Bhiwandi", "Amravati", "Nanded", "Kolhapur", "Akola", "Panvel"],
  "Delhi": ["New Delhi", "North Delhi", "South Delhi", "East Delhi", "West Delhi", "Central Delhi"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Junagadh", "Gandhinagar", "Anand", "Navsari", "Morbi", "Bharuch"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Udaipur", "Bhilwara", "Alwar", "Bharatpur", "Sikar"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Ghaziabad", "Agra", "Varanasi", "Meerut", "Prayagraj", "Noida", "Greater Noida", "Bareilly", "Aligarh", "Moradabad", "Saharanpur", "Gorakhpur", "Jhansi"],
  "Karnataka": ["Bengaluru", "Mysuru", "Hubballi-Dharwad", "Mangaluru", "Belagavi", "Kalaburagi", "Davanagere", "Ballari", "Vijayapura", "Shivamogga"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tiruppur", "Erode", "Vellore", "Tirunelveli", "Thanjavur"],
  "West Bengal": ["Kolkata", "Howrah", "Siliguri", "Asansol", "Durgapur", "Bardhaman", "Malda", "Baharampur"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Khammam", "Karimnagar", "Ramagundam"],
  "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Pathankot", "Hoshiarpur"],
  "Haryana": ["Gurugram", "Faridabad", "Panipat", "Ambala", "Yamunanagar", "Rohtak", "Hisar", "Karnal", "Sonipat"],
  "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", "Bihar Sharif", "Arrah"],
  "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri", "Balasore"],
  "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Kollam", "Thrissur", "Kannur", "Alappuzha"],
  "Assam": ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tinsukia"],
  "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Hazaribagh", "Deoghar"],
  "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Rajnandgaon", "Jagdalpur"],
  "Uttarakhand": ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rishikesh", "Nainital"],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Mandi", "Solan", "Kullu", "Manali"],
  "Goa": ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"]
};

const COUNTRIES = [
  "India",
  "United Arab Emirates",
  "United States",
  "Saudi Arabia",
  "Other"
];

const WorkerSignup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState('details'); // 'details' or 'otp'
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    aadhar: '',
    country: 'India',
    state: 'Madhya Pradesh',
    city: '',
    customCity: '',
    selectedCategories: [],
    aadharDocument: null,
    aadharBackDocument: null
  });

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpToken, setOtpToken] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [documentPreview, setDocumentPreview] = useState({});
  const [resendTimer, setResendTimer] = useState(0);

  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableCities, setAvailableCities] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);

  // Fetch categories and cities from public API
  useEffect(() => {
    const fetchCatalogOptions = async () => {
      setIsDataLoading(true);
      try {
        const [catRes, cityRes] = await Promise.allSettled([
          api.get('/public/categories'),
          api.get('/public/cities')
        ]);

        if (catRes.status === 'fulfilled' && catRes.value.data?.success) {
          setAvailableCategories(catRes.value.data.categories || []);
        }

        if (cityRes.status === 'fulfilled' && cityRes.value.data?.success) {
          const citiesList = cityRes.value.data.cities || [];
          setAvailableCities(citiesList);
          if (citiesList.length > 0 && !formData.city) {
            setFormData(prev => ({ ...prev, city: citiesList[0].name }));
          }
        }
      } catch (err) {
        console.error('Failed to load registration catalog options:', err);
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchCatalogOptions();
  }, []);

  // Timer countdown effect
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Refs for auto-focus
  const nameInputRef = useRef(null);
  const otpInputRefs = useRef([]);

  // Pre-fill from navigation state (Unified Flow)
  useEffect(() => {
    if (location.state?.phone && location.state?.verificationToken) {
      setFormData(prev => ({ ...prev, phoneNumber: location.state.phone }));
      setVerificationToken(location.state.verificationToken);
    }
  }, [location.state]);

  // Clear any existing worker tokens on page load
  useEffect(() => {
    localStorage.removeItem('workerAccessToken');
    localStorage.removeItem('workerRefreshToken');
    localStorage.removeItem('workerData');
  }, []);

  // Auto-focus logic
  useEffect(() => {
    if (step === 'otp' && otpInputRefs.current[0]) {
      setTimeout(() => otpInputRefs.current[0].focus(), 100);
    }
  }, [step]);

  const handleFocus = (e) => {
    const target = e.target;
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  // Derive cities list dynamically based on selected state + API cities
  const currentCityOptions = useMemo(() => {
    const stateCities = CITIES_BY_STATE[formData.state] || [];
    const apiCities = availableCities.map(c => (typeof c === 'string' ? c : c?.name)).filter(Boolean);
    const combined = Array.from(new Set([...stateCities, ...apiCities]));
    return combined;
  }, [formData.state, availableCities]);

  // Auto set default city when currentCityOptions change
  useEffect(() => {
    if (currentCityOptions.length > 0 && (!formData.city || (!currentCityOptions.includes(formData.city) && formData.city !== 'Other'))) {
      setFormData(prev => ({ ...prev, city: currentCityOptions[0] }));
    }
  }, [currentCityOptions]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phoneNumber' && verificationToken && value !== location.state?.phone) {
      setVerificationToken('');
    }
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const toggleCategorySelection = (catTitle) => {
    setFormData(prev => {
      const exists = prev.selectedCategories.includes(catTitle);
      const updated = exists
        ? prev.selectedCategories.filter(c => c !== catTitle)
        : [...prev.selectedCategories, catTitle];
      return { ...prev, selectedCategories: updated };
    });
  };

  const handleDocumentUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image or PDF');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const fieldName = type === 'aadhar' ? 'aadharDocument' : 'aadharBackDocument';
      setFormData(prev => ({
        ...prev,
        [fieldName]: file
      }));
      setDocumentPreview(prev => ({
        ...prev,
        [type]: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeDocument = (type) => {
    const fieldName = type === 'aadhar' ? 'aadharDocument' : 'aadharBackDocument';
    setFormData(prev => ({
      ...prev,
      [fieldName]: null
    }));
    setDocumentPreview(prev => ({
      ...prev,
      [type]: null
    }));
  };

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();

    const effectiveCity = formData.city === 'Other' ? formData.customCity : formData.city;

    // Zod Validation
    const validationResult = workerSignupSchema.safeParse({
      name: formData.name,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      aadhar: formData.aadhar,
      country: formData.country,
      state: formData.state,
      city: effectiveCity,
      selectedCategories: formData.selectedCategories
    });

    if (!validationResult.success) {
      const errorList = validationResult.error.errors || validationResult.error.issues || [];
      const uniqueErrors = [...new Set(errorList.map(err => err.message))];
      uniqueErrors.forEach(msg => toast.error(msg));
      return;
    }

    // Manual Document Check
    if (!formData.aadharDocument && !documentPreview.aadhar) {
      toast.error('Please upload Aadhar Front document');
      return;
    }
    if (!formData.aadharBackDocument && !documentPreview.aadharBack) {
      toast.error('Please upload Aadhar Back document');
      return;
    }

    setIsLoading(true);

    const aadharDoc = documentPreview.aadhar || null;
    const aadharBackDoc = documentPreview.aadharBack || null;

    if (verificationToken) {
      try {
        const registerData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phoneNumber,
          aadhar: formData.aadhar,
          aadharDocument: aadharDoc,
          aadharBackDocument: aadharBackDoc,
          country: formData.country,
          state: formData.state,
          city: effectiveCity,
          serviceCategories: formData.selectedCategories,
          verificationToken
        };

        const response = await workerAuthService.register(registerData);
        if (response.success) {
          toast.success(
            <div className="flex flex-col">
              <span className="font-bold">Welcome Onboard!</span>
              <span className="text-xs">Your worker account has been created.</span>
            </div>,
            { icon: <FiCheckCircle className="text-green-500" /> }
          );
          navigate('/worker');
        } else {
          toast.error(response.message || 'Registration failed');
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'Registration failed');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const response = await workerAuthService.sendOTP(formData.phoneNumber, formData.email);
      if (response.success) {
        setOtpToken(response.token);
        setIsLoading(false);
        setStep('otp');
        setResendTimer(120); // Start timer
        toast.success('OTP sent successfully');
      } else {
        setIsLoading(false);
        toast.error(response.message || 'Failed to send OTP');
      }
    } catch (error) {
      setIsLoading(false);
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    }
  };

  const handleOtpChange = (index, value) => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 1);
    const newOtp = [...otp];
    newOtp[index] = cleanValue;
    setOtp(newOtp);

    if (cleanValue && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Auto-verify as last digit enters
  useEffect(() => {
    const otpValue = otp.join('');
    if (otpValue.length === 6 && !isLoading && otpToken) {
      handleOtpSubmit();
    }
  }, [otp]);

  const handleOtpSubmit = async (e) => {
    if (e) e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      toast.error('Please enter complete OTP');
      return;
    }
    if (!otpToken) {
      toast.error('Please request OTP first');
      return;
    }
    setIsLoading(true);
    try {
      const aadharDoc = documentPreview.aadhar || null;
      const aadharBackDoc = documentPreview.aadharBack || null;
      const effectiveCity = formData.city === 'Other' ? formData.customCity : formData.city;
      const registerData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phoneNumber,
        aadhar: formData.aadhar,
        aadharDocument: aadharDoc,
        aadharBackDocument: aadharBackDoc,
        country: formData.country,
        state: formData.state,
        city: effectiveCity,
        serviceCategories: formData.selectedCategories,
        otp: otpValue,
        token: otpToken
      };

      const response = await workerAuthService.register(registerData);
      if (response.success) {
        setIsLoading(false);
        toast.success('Registration successful! Welcome to Truliq.');
        navigate('/worker');
      } else {
        setIsLoading(false);
        toast.error(response.message || 'Registration failed');
      }
    } catch (error) {
      setIsLoading(false);
      toast.error(error.response?.data?.message || 'Registration failed');
    }
  };

  const brandColor = themeColors.brand?.teal || '#347989';

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col justify-start sm:justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-x-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#347989] opacity-[0.03] rounded-full blur-3xl animate-floating" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#D68F35] opacity-[0.03] rounded-full blur-3xl animate-floating" style={{ animationDelay: '2s' }} />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center mb-8 relative z-10 animate-fade-in">
        <Logo className="h-16 w-auto mx-auto transform hover:scale-110 transition-transform duration-500" />
        <h2 className="mt-4 text-3xl font-extrabold text-gray-900 tracking-tight">
          {step === 'details' ? 'Xpert Registration' : 'Confirm Phone'}
        </h2>
        <p className="mt-2 text-sm text-gray-600 animate-stagger-1 animate-fade-in">
          Join the pros. Set your schedule, earn more.
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl px-0 relative z-10">
        <div className="bg-white py-8 px-4 shadow-2xl shadow-gray-200/50 sm:rounded-2xl sm:px-10 border border-gray-100 relative overflow-hidden animate-slide-in-bottom">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#347989] via-[#D68F35] to-[#BB5F36]" />

          {step === 'details' ? (
            <form onSubmit={handleDetailsSubmit} className="space-y-6" noValidate>
              {/* Full Name & Email Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <div className="relative rounded-xl shadow-sm group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                      <FiUser className="text-gray-400" />
                    </div>
                    <input
                      ref={nameInputRef}
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                        handleInputChange({ target: { name: 'name', value: val } });
                      }}
                      onFocus={handleFocus}
                      className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-offset-2 outline-none transition-all duration-300 hover:border-gray-400"
                      style={{ '--tw-ring-color': brandColor }}
                      placeholder="Enter your name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative rounded-xl shadow-sm group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                      <FiMail className="text-gray-400" />
                    </div>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      onFocus={handleFocus}
                      className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-offset-2 outline-none transition-all duration-300 hover:border-gray-400"
                      style={{ '--tw-ring-color': brandColor }}
                      placeholder="name@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Phone & Aadhar Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!verificationToken && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <div className="relative rounded-xl shadow-sm group">
                      <div className="absolute inset-y-0 left-0 pl-3 border-r pr-2 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                        <span className="text-gray-500 font-bold text-sm">+91</span>
                      </div>
                      <input
                        type="tel"
                        required
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData(p => ({ ...p, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                        onFocus={handleFocus}
                        className="block w-full pl-14 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-offset-2 outline-none transition-all duration-300 hover:border-gray-400"
                        style={{ '--tw-ring-color': brandColor }}
                        placeholder="9876543210"
                      />
                    </div>
                  </div>
                )}

                <div className={verificationToken ? 'col-span-2' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Number</label>
                  <div className="relative rounded-xl shadow-sm group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                      <FiFileText className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.aadhar}
                      onChange={(e) => setFormData(p => ({ ...p, aadhar: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                      onFocus={handleFocus}
                      className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-offset-2 outline-none transition-all duration-300 hover:border-gray-400"
                      style={{ '--tw-ring-color': brandColor }}
                      placeholder="12-digit Aadhar"
                    />
                  </div>
                </div>
              </div>

              {/* Location Section: Country, State, City */}
              <div className="pt-2 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                  <FiMapPin className="text-[#347989]" />
                  <span>Work Location Details</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Country */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Country</label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <FiGlobe />
                      </div>
                      <select
                        name="country"
                        value={formData.country}
                        onChange={handleInputChange}
                        className="block w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-offset-1 outline-none text-sm transition-all cursor-pointer font-medium text-gray-800"
                        style={{ '--tw-ring-color': brandColor }}
                      >
                        {COUNTRIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">State</label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <FiMapPin />
                      </div>
                      <select
                        name="state"
                        value={formData.state}
                        onChange={handleInputChange}
                        className="block w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-offset-1 outline-none text-sm transition-all cursor-pointer font-medium text-gray-800"
                        style={{ '--tw-ring-color': brandColor }}
                      >
                        {INDIAN_STATES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">City</label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <FiNavigation />
                      </div>
                      <select
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        className="block w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-offset-1 outline-none text-sm transition-all cursor-pointer font-medium text-gray-800"
                        style={{ '--tw-ring-color': brandColor }}
                      >
                        <option value="">Select City</option>
                        {currentCityOptions.map(cityName => (
                          <option key={cityName} value={cityName}>
                            {cityName}
                          </option>
                        ))}
                        <option value="Other">Other / Custom</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Custom City input if Other selected */}
                {formData.city === 'Other' && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Enter City Name</label>
                    <input
                      type="text"
                      name="customCity"
                      value={formData.customCity}
                      onChange={handleInputChange}
                      className="block w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 outline-none text-sm"
                      placeholder="Type your city name"
                    />
                  </div>
                )}
              </div>

              {/* Service Categories Selection (Collapsible Dropdown) */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex flex-col gap-1.5">
                  <label className="block text-xs font-semibold text-gray-600">Select Service Categories / Skills</label>
                  
                  <button
                    type="button"
                    onClick={() => setIsCategoriesOpen(prev => !prev)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-offset-1 outline-none transition-all duration-200 cursor-pointer group"
                    style={{ '--tw-ring-color': brandColor }}
                  >
                    <div className="flex items-center gap-2 overflow-hidden text-left">
                      <FiLayers className="text-[#347989] flex-shrink-0 w-4 h-4" />
                      <span className="text-sm font-semibold text-gray-800 truncate">
                        {formData.selectedCategories.length === 0
                          ? 'None'
                          : `${formData.selectedCategories.length} selected (${formData.selectedCategories.join(', ')})`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold transition-colors ${
                        formData.selectedCategories.length > 0
                          ? 'bg-[#347989]/10 text-[#347989]'
                          : 'bg-gray-200 text-gray-500'
                      }`}>
                        {formData.selectedCategories.length === 0 ? 'None' : `${formData.selectedCategories.length} Selected`}
                      </span>
                      {isCategoriesOpen ? (
                        <FiChevronUp className="w-5 h-5 text-gray-500 group-hover:text-[#347989] transition-colors" />
                      ) : (
                        <FiChevronDown className="w-5 h-5 text-gray-500 group-hover:text-[#347989] transition-colors" />
                      )}
                    </div>
                  </button>
                </div>

                {/* Expandable Category Chips Grid */}
                {isCategoriesOpen && (
                  <div className="mt-3 p-3 bg-gray-50/80 border border-gray-200 rounded-2xl animate-fade-in transition-all">
                    <p className="text-xs text-gray-500 mb-2.5 font-medium">
                      Choose the categories you provide services for (Select one or more):
                    </p>

                    {availableCategories.length === 0 ? (
                      <div className="p-4 bg-white rounded-xl text-center text-xs text-gray-500 border border-gray-100">
                        {isDataLoading ? 'Loading categories...' : 'No categories found'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1 scrollbar-thin">
                        {availableCategories.map(cat => {
                          const isSelected = formData.selectedCategories.includes(cat.title);
                          const iconUrl = cat.icon ? toAssetUrl(cat.icon) : null;

                          return (
                            <button
                              key={cat.id || cat._id || cat.title}
                              type="button"
                              onClick={() => toggleCategorySelection(cat.title)}
                              className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs font-semibold transition-all duration-200 cursor-pointer min-h-[44px] ${
                                isSelected
                                  ? 'border-[#347989] bg-white text-[#347989] shadow-sm ring-2 ring-[#347989]'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {iconUrl ? (
                                <img src={iconUrl} alt={cat.title} className="w-6 h-6 object-contain flex-shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0">
                                  <FiLayers className="w-3.5 h-3.5" />
                                </div>
                              )}
                              <span className="flex-1 whitespace-normal break-words leading-snug">{cat.title}</span>
                              {isSelected && (
                                <div className="w-4 h-4 rounded-full bg-[#347989] text-white flex items-center justify-center flex-shrink-0">
                                  <FiCheck className="w-3 h-3 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Aadhar Upload Section */}
              <div className="pt-2 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                  <FiFileText className="text-[#347989]" />
                  <span>Aadhar Verification Documents</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Front Upload */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Aadhar Front</label>
                    {documentPreview.aadhar ? (
                      <div className="relative group overflow-hidden rounded-xl border">
                        <img src={documentPreview.aadhar} className="w-full h-28 object-cover transform group-hover:scale-105 transition-transform duration-500" alt="Aadhar Front" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button type="button" onClick={() => removeDocument('aadhar')} className="bg-red-500 text-white rounded-full p-2 shadow-xl hover:bg-red-600 transition-colors">
                            <FiX size={18} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-300 hover:border-[#347989] group bg-white">
                        <label className="flex flex-col items-center cursor-pointer w-full h-full justify-center">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-full mb-1 hover:bg-blue-100 transition-colors">
                            <FiUpload className="w-5 h-5" />
                          </div>
                          <span className="text-xs text-gray-500 font-bold">Upload Front</span>
                          <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleDocumentUpload(e, 'aadhar')} />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Back Upload */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Aadhar Back</label>
                    {documentPreview.aadharBack ? (
                      <div className="relative group overflow-hidden rounded-xl border">
                        <img src={documentPreview.aadharBack} className="w-full h-28 object-cover transform group-hover:scale-105 transition-transform duration-500" alt="Aadhar Back" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button type="button" onClick={() => removeDocument('aadharBack')} className="bg-red-500 text-white rounded-full p-2 shadow-xl hover:bg-red-600 transition-colors">
                            <FiX size={18} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-300 hover:border-[#347989] group bg-white">
                        <label className="flex flex-col items-center cursor-pointer w-full h-full justify-center">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-full mb-1 hover:bg-blue-100 transition-colors">
                            <FiUpload className="w-5 h-5" />
                          </div>
                          <span className="text-xs text-gray-500 font-bold">Upload Back</span>
                          <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleDocumentUpload(e, 'aadharBack')} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-base font-bold rounded-xl text-white transition-all transform hover:-translate-y-1 shadow-lg disabled:opacity-50 overflow-hidden mt-6"
                  style={{ backgroundColor: brandColor, boxShadow: `0 10px 15px -3px ${brandColor}4D` }}
                >
                  <span className="absolute inset-0 w-full h-full bg-white/10 group-hover:translate-x-full transition-transform duration-700 -translate-x-full" />
                  {isLoading ? 'Processing...' : (
                    <span className="flex items-center relative z-10">
                      {verificationToken ? 'Finish Registration' : 'Verify & Join'}
                      <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <button
                onClick={() => setStep('details')}
                className="flex items-center text-sm text-gray-500 hover:text-[#347989] transition-colors mb-4 animate-fade-in"
              >
                <FiChevronLeft className="mr-1" /> Edit details
              </button>

              <div className="text-center animate-fade-in">
                <h3 className="text-xl font-bold text-gray-900">Enter OTP</h3>
                <p className="text-sm text-gray-600">Waiting for 6-digit code...</p>
              </div>

              <form onSubmit={handleOtpSubmit} className="space-y-8">
                <div className="flex justify-between gap-2 animate-stagger-1 animate-fade-in">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpInputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-full h-14 text-center text-xl font-bold border border-gray-300 rounded-xl focus:ring-2 focus:ring-offset-2 outline-none transition-all duration-300 hover:border-gray-400"
                      style={{ '--tw-ring-color': brandColor, backgroundColor: digit ? `${brandColor}05` : 'white' }}
                    />
                  ))}
                </div>

                <div className="text-center animate-stagger-2 animate-fade-in">
                  <button
                    type="button"
                    onClick={async () => {
                      if (resendTimer > 0) return;
                      try {
                        const response = await workerAuthService.sendOTP(formData.phoneNumber, formData.email);
                        if (response.success) {
                          setOtpToken(response.token);
                          setResendTimer(120);
                          toast.success('OTP sent again');
                        }
                      } catch (e) { toast.error('Resend failed'); }
                    }}
                    className="text-sm font-semibold transition-colors duration-300 opacity-70 hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={resendTimer > 0}
                    style={{ color: brandColor }}
                  >
                    {resendTimer > 0
                      ? `Resend in ${Math.floor(resendTimer / 60)}:${String(resendTimer % 60).padStart(2, '0')}`
                      : 'Resend Code'}
                  </button>
                </div>

                <div className="animate-stagger-3 animate-fade-in">
                  <button
                    type="submit"
                    disabled={isLoading || otp.join('').length !== 6}
                    className="group relative w-full py-4 rounded-xl text-white font-bold transform hover:-translate-y-1 transition-all shadow-lg disabled:opacity-50 overflow-hidden"
                    style={{ backgroundColor: brandColor, boxShadow: `0 10px 15px -3px ${brandColor}4D` }}
                  >
                    <span className="absolute inset-0 w-full h-full bg-white/10 group-hover:translate-x-full transition-transform duration-700 -translate-x-full" />
                    <span className="relative z-10">
                      {isLoading ? 'Verifying...' : 'Complete Sign Up'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-gray-500 animate-fade-in animate-stagger-4">
          Already an Xpert?{' '}
          <Link to="/worker/login" className="font-semibold hover:text-[#D68F35] transition-colors" style={{ color: brandColor }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default WorkerSignup;
